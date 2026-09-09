-- =============================================================================
-- 0046_parent_sms_transactional_consent.sql
-- PR7F — parent transactional SMS consent (explicit opt-in; never inferred
-- from phone_e164). Prospective only. Does not backfill consent. Do not apply
-- from this agent.
-- =============================================================================

alter table public.profiles
  add column if not exists sms_transactional_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists sms_transactional_opt_in_at timestamptz;

alter table public.profiles
  add column if not exists sms_transactional_opt_out_at timestamptz;

alter table public.profiles
  add column if not exists sms_transactional_source text;

comment on column public.profiles.sms_transactional_opt_in is
  'PR7F: true only after explicit transactional SMS opt-in. Never inferred from phone_e164.';

comment on column public.profiles.sms_transactional_opt_in_at is
  'PR7F: last time transactional SMS was opted in (account toggle or START).';

comment on column public.profiles.sms_transactional_opt_out_at is
  'PR7F: last time transactional SMS was opted out (account toggle or STOP).';

comment on column public.profiles.sms_transactional_source is
  'PR7F: account | twilio_start | twilio_stop. Audit only.';

-- Authenticated parent (or admin) sets the Account toggle. Saving a phone
-- never writes these columns.
create or replace function public.set_my_sms_transactional_preference(p_opt_in boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_opt_in is null then raise exception 'opt-in required'; end if;
  if not public.is_admin(v_uid) and not exists (
    select 1 from public.profiles where id = v_uid and role = 'student'
  ) then
    raise exception 'Not authorized';
  end if;

  update public.profiles
     set sms_transactional_opt_in = p_opt_in,
         sms_transactional_opt_in_at = case when p_opt_in then now() else sms_transactional_opt_in_at end,
         sms_transactional_opt_out_at = case when not p_opt_in then now() else sms_transactional_opt_out_at end,
         sms_transactional_source = 'account'
   where id = v_uid
   returning * into v_row;

  if not found then raise exception 'Profile not found'; end if;

  return jsonb_build_object(
    'opt_in', v_row.sms_transactional_opt_in,
    'opt_in_at', v_row.sms_transactional_opt_in_at,
    'opt_out_at', v_row.sms_transactional_opt_out_at,
    'source', v_row.sms_transactional_source
  );
end;
$$;

revoke all on function public.set_my_sms_transactional_preference(boolean) from public;
grant execute on function public.set_my_sms_transactional_preference(boolean) to authenticated, service_role;

-- Inbound STOP/START from Twilio webhook (service role). Matches E.164.
-- Does not change phone_e164. Does not send mail.
create or replace function public.apply_inbound_sms_keyword(p_phone text, p_kind text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_n integer := 0;
begin
  if not public.is_financial_actor() then raise exception 'Not authorized'; end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then return 0; end if;
  if p_kind not in ('opt_in', 'opt_out') then raise exception 'invalid kind'; end if;

  if p_kind = 'opt_out' then
    update public.profiles
       set sms_transactional_opt_in = false,
           sms_transactional_opt_out_at = now(),
           sms_transactional_source = 'twilio_stop'
     where phone_e164 = v_phone
       and role = 'student';
    get diagnostics v_n = row_count;
  else
    update public.profiles
       set sms_transactional_opt_in = true,
           sms_transactional_opt_in_at = now(),
           sms_transactional_source = 'twilio_start'
     where phone_e164 = v_phone
       and role = 'student';
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end;
$$;

revoke all on function public.apply_inbound_sms_keyword(text, text) from public;
revoke all on function public.apply_inbound_sms_keyword(text, text) from anon, authenticated;
grant execute on function public.apply_inbound_sms_keyword(text, text) to service_role;

notify pgrst, 'reload schema';
