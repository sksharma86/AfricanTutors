-- =============================================================================
-- African Tutors — Phase 6 pre-merge fix: failed-email retry + stored content
-- =============================================================================
-- Stores the rendered email (subject/html/text) on each delivery so a FAILED
-- delivery can be safely retried by an admin without re-running the underlying
-- business operation. retry_email_delivery atomically flips 'failed' → 'pending'
-- and bumps attempts (the UPDATE ... WHERE status='failed' is the concurrency
-- guard: only one concurrent retry wins), returning the stored content for the
-- route to re-send. Idempotent migration. (The tutor-assignment idempotency-key
-- fix is code-only in notify.ts.)
-- =============================================================================

alter table public.email_deliveries add column if not exists subject   text;
alter table public.email_deliveries add column if not exists body_html text;
alter table public.email_deliveries add column if not exists body_text text;

-- Recreate claim to also persist the rendered content (single caller: notify.ts).
drop function if exists public.claim_email_delivery(text, text, uuid, text, uuid);
create or replace function public.claim_email_delivery(
  p_key text, p_type text, p_account uuid default null, p_to text default null, p_booking uuid default null,
  p_subject text default null, p_html text default null, p_text text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if p_key is null or btrim(p_key) = '' then raise exception 'idempotency key required'; end if;
  insert into public.email_deliveries (idempotency_key, notification_type, recipient_account_id, to_email, booking_id, status, attempts, subject, body_html, body_text)
  values (p_key, p_type, p_account, p_to, p_booking, 'pending', 1, p_subject, p_html, p_text)
  on conflict (idempotency_key) do nothing;
  return found;
end;
$$;

-- Admin/service retry of a FAILED delivery. Returns the stored content to re-send,
-- or {retried:false} if it wasn't failed (already sent / concurrently retried).
create or replace function public.retry_email_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_key text; v_to text; v_subject text; v_html text; v_text text;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  update public.email_deliveries
     set status = 'pending', attempts = attempts + 1, error = null, updated_at = now()
   where id = p_delivery_id and status = 'failed'
   returning idempotency_key, to_email, subject, body_html, body_text
   into v_key, v_to, v_subject, v_html, v_text;
  if not found then
    return jsonb_build_object('retried', false);
  end if;
  return jsonb_build_object('retried', true, 'key', v_key, 'to', v_to, 'subject', v_subject, 'html', v_html, 'text', v_text);
end;
$$;

do $$
declare fn text;
begin
  for fn in select unnest(array[
    'claim_email_delivery(text,text,uuid,text,uuid,text,text,text)',
    'retry_email_delivery(uuid)'
  ]) loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
