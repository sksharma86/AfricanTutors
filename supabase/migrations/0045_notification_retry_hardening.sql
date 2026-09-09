-- =============================================================================
-- 0045_notification_retry_hardening.sql
-- PR7E — retry + stale-pending recovery for email_deliveries
-- =============================================================================
-- Prospective only. Does NOT backfill pre-PR7E failed or pending rows.
-- Adds next_retry_at and auto_retry_eligible (default false).
-- New claims set auto_retry_eligible=true. complete_email_delivery schedules
-- next_retry_at only for future failures. Idempotent. Do not apply from this agent.
-- =============================================================================

alter table public.email_deliveries
  add column if not exists next_retry_at timestamptz;

alter table public.email_deliveries
  add column if not exists auto_retry_eligible boolean not null default false;

create index if not exists email_deliveries_retry_idx
  on public.email_deliveries (status, next_retry_at, updated_at)
  where status in ('failed', 'pending');

comment on column public.email_deliveries.next_retry_at is
  'PR7E: earliest automatic retry. Null means terminal, not scheduled, or pre-PR7E.';

comment on column public.email_deliveries.auto_retry_eligible is
  'PR7E: true only for deliveries claimed or completed under PR7E. Pre-PR7E rows stay false.';

-- Intentionally no UPDATE of existing failed/pending rows.

-- New claims are prospectively eligible for stale-pending recovery.
create or replace function public.claim_email_delivery(
  p_key text, p_type text, p_account uuid default null, p_to text default null, p_booking uuid default null,
  p_subject text default null, p_html text default null, p_text text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_key is null or btrim(p_key) = '' then raise exception 'idempotency key required'; end if;
  insert into public.email_deliveries (
    idempotency_key, notification_type, recipient_account_id, to_email, booking_id,
    status, attempts, subject, body_html, body_text, auto_retry_eligible
  )
  values (p_key, p_type, p_account, p_to, p_booking, 'pending', 1, p_subject, p_html, p_text, true)
  on conflict (idempotency_key) do nothing;
  return found;
end;
$$;

-- complete_email_delivery: on failed, schedule bounded backoff unless the
-- error looks permanent. sent/skipped clear next_retry_at.
-- Sets auto_retry_eligible when a retry is scheduled (prospective failures only).
create or replace function public.complete_email_delivery(
  p_key text, p_status text, p_provider_message_id text default null, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_attempts integer;
  v_permanent boolean;
  v_next timestamptz;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_status not in ('sent', 'failed', 'skipped') then raise exception 'invalid status'; end if;

  select attempts into v_attempts from public.email_deliveries where idempotency_key = p_key;
  v_permanent := coalesce(p_error, '') ~* 'resend 400|resend 403|resend 409|resend 422|invalid recipient|email\.bounced|email\.complained|bounced|complained|permanent';
  if p_status = 'failed' and not v_permanent and coalesce(v_attempts, 0) < 5 then
    v_next := now() + case
      when coalesce(v_attempts, 0) <= 2 then interval '15 minutes'
      when v_attempts = 3 then interval '1 hour'
      else interval '6 hours'
    end;
  else
    v_next := null;
  end if;

  update public.email_deliveries
     set status = p_status,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = p_error,
         next_retry_at = v_next,
         auto_retry_eligible = case
           when v_next is not null then true
           else auto_retry_eligible
         end,
         updated_at = now()
   where idempotency_key = p_key;
end;
$$;

-- Provider webhook: delivered → sent (never retry). Bounce/complaint → failed
-- with next_retry_at null (no automatic resend loop).
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
         error = coalesce(p_error, error),
         next_retry_at = case
           when p_status in ('bounced', 'failed', 'delivered') then null
           else next_retry_at
         end,
         updated_at = now()
   where provider_message_id = p_provider_message_id;
end;
$$;

-- Admin retry stays failed-only. Marks the row prospectively eligible so a
-- crash after this lease can be stale-pending recovered. Still increments attempts.
create or replace function public.retry_email_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_key text; v_to text; v_subject text; v_html text; v_text text;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.email_deliveries
     set status = 'pending',
         attempts = attempts + 1,
         error = null,
         next_retry_at = now(),
         auto_retry_eligible = true,
         updated_at = now()
   where id = p_delivery_id and status = 'failed'
   returning idempotency_key, to_email, subject, body_html, body_text
   into v_key, v_to, v_subject, v_html, v_text;
  if not found then
    return jsonb_build_object('retried', false);
  end if;
  return jsonb_build_object('retried', true, 'key', v_key, 'to', v_to, 'subject', v_subject, 'html', v_html, 'text', v_text);
end;
$$;

-- Atomic lease. Does not increment attempts. Cron counts a provider send
-- immediately before sendEmail; inspect-only skips must not increment.
-- Failed: only rows with next_retry_at (no pre-PR7E backfill).
-- Pending: only auto_retry_eligible rows (new claims / PR7E flow).
create or replace function public.claim_email_delivery_retry_batch(
  p_limit integer default 40,
  p_stale_pending_minutes integer default 15,
  p_max_attempts integer default 5
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_limit is null or p_limit < 1 then p_limit := 40; end if;
  if p_limit > 100 then p_limit := 100; end if;

  with picked as (
    select id
      from public.email_deliveries
     where attempts < p_max_attempts
       and to_email is not null
       and position('@' in to_email) > 1
       and to_email not like 'sms:%'
       and to_email not like 'whatsapp:%'
       and coalesce(error, '') !~* 'resend 400|resend 403|resend 409|resend 422|invalid recipient|email\.bounced|email\.complained'
       and (
         (
           status = 'failed'
           and next_retry_at is not null
           and next_retry_at <= now()
         )
         or (
           status = 'pending'
           and auto_retry_eligible is true
           and provider_message_id is null
           and updated_at <= now() - (p_stale_pending_minutes || ' minutes')::interval
         )
       )
     order by updated_at asc
     limit p_limit
     for update skip locked
  ), leased as (
    update public.email_deliveries d
       set status = 'pending',
           next_retry_at = null,
           updated_at = now()
      from picked
     where d.id = picked.id
     returning d.id, d.idempotency_key, d.notification_type, d.recipient_account_id, d.to_email,
               d.booking_id, d.status, d.attempts, d.subject, d.body_html, d.body_text,
               d.error, d.provider_message_id, d.updated_at, d.auto_retry_eligible
  )
  select coalesce(jsonb_agg(to_jsonb(leased)), '[]'::jsonb) into v_rows from leased;
  return v_rows;
end;
$$;

revoke all on function public.claim_email_delivery(text, text, uuid, text, uuid, text, text, text) from public;
grant execute on function public.claim_email_delivery(text, text, uuid, text, uuid, text, text, text) to authenticated, service_role;

revoke all on function public.claim_email_delivery_retry_batch(integer, integer, integer) from public;
revoke all on function public.claim_email_delivery_retry_batch(integer, integer, integer) from anon;
grant execute on function public.claim_email_delivery_retry_batch(integer, integer, integer) to authenticated, service_role;

revoke all on function public.retry_email_delivery(uuid) from public;
grant execute on function public.retry_email_delivery(uuid) to authenticated, service_role;

comment on function public.claim_email_delivery_retry_batch(integer, integer, integer) is
  'PR7E: lease failed (next_retry_at due) or stale auto_retry_eligible pending email. SKIP LOCKED. No pre-PR7E backfill.';

notify pgrst, 'reload schema';
