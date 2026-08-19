-- =============================================================================
-- African Tutors — Phase 6: transactional email delivery log + idempotency
-- =============================================================================
-- Central operational record for outbound transactional email. Its `idempotency_key`
-- (a stable business-event reference, e.g. 'booking-confirmed:<booking_id>' or
-- 'reminder-24h:<booking_id>:<role>') guarantees financial/webhook/cron retries
-- never send the same email twice. Email is best-effort: nothing here ever blocks
-- or rolls back a booking/payment/session/dispute action. Idempotent migration.
-- =============================================================================

create table if not exists public.email_deliveries (
  id                   uuid primary key default gen_random_uuid(),
  idempotency_key      text not null unique,
  notification_type    text not null,
  recipient_account_id uuid references public.profiles (id) on delete set null,
  to_email             text,
  booking_id           uuid references public.bookings (id) on delete set null,
  status               text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id  text,
  error                text,
  attempts             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists email_deliveries_recipient_idx on public.email_deliveries (recipient_account_id);
create index if not exists email_deliveries_status_idx on public.email_deliveries (status);
create index if not exists email_deliveries_provider_idx on public.email_deliveries (provider_message_id) where provider_message_id is not null;

drop trigger if exists email_deliveries_touch on public.email_deliveries;
create trigger email_deliveries_touch before update on public.email_deliveries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- claim_email_delivery — atomically reserve a business-event email. Returns TRUE
-- when this caller newly claimed it (should send), FALSE when it already exists
-- (duplicate delivery → skip). Admin/service only.
-- ---------------------------------------------------------------------------
create or replace function public.claim_email_delivery(
  p_key text, p_type text, p_account uuid default null, p_to text default null, p_booking uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_key is null or btrim(p_key) = '' then raise exception 'idempotency key required'; end if;
  insert into public.email_deliveries (idempotency_key, notification_type, recipient_account_id, to_email, booking_id, status, attempts)
  values (p_key, p_type, p_account, p_to, p_booking, 'pending', 1)
  on conflict (idempotency_key) do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_email_delivery — record the send outcome for a claimed delivery.
-- ---------------------------------------------------------------------------
create or replace function public.complete_email_delivery(
  p_key text, p_status text, p_provider_message_id text default null, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_status not in ('sent', 'failed', 'skipped') then raise exception 'invalid status'; end if;
  update public.email_deliveries
     set status = p_status, provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = p_error, updated_at = now()
   where idempotency_key = p_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_email_provider_status — update delivery state from a verified Resend
-- webhook (delivered / bounced / failed), matched by provider message id.
-- Idempotent (a terminal 'bounced'/'failed' is not overwritten by a later
-- 'sent'). Admin/service only.
-- ---------------------------------------------------------------------------
create or replace function public.record_email_provider_status(
  p_provider_message_id text, p_status text, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_provider_message_id is null then return; end if;
  update public.email_deliveries
     set status = case when p_status in ('bounced', 'failed') then 'failed'
                       when p_status = 'delivered' then 'sent'
                       else status end,
         error = coalesce(p_error, error), updated_at = now()
   where provider_message_id = p_provider_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: recipients may read their OWN delivery history; admins read all
-- (including operational alerts with no recipient). Never client-writable.
-- ---------------------------------------------------------------------------
alter table public.email_deliveries enable row level security;
drop policy if exists email_deliveries_select on public.email_deliveries;
create policy email_deliveries_select on public.email_deliveries for select to authenticated
  using (recipient_account_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.email_deliveries to authenticated;
grant all on public.email_deliveries to service_role;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'claim_email_delivery(text,text,uuid,text,uuid)',
    'complete_email_delivery(text,text,text,text)',
    'record_email_provider_status(text,text,text)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
