-- =============================================================================
-- Study Hall at Home — PR10E launch hardening
-- =============================================================================
-- 1) Prevent double-booking the same child into overlapping Study Halls when
--    multiple Guides are free (tutor overlap alone is not enough).
-- 2) Customer cancel of a still-pending (awaiting_payment) booking must restore
--    reserved account credit immediately — not wait for hold expiry.
-- Do not apply from agents until reviewed. Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Same-child overlapping sessions (pending/confirmed only).
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_no_student_overlap;
alter table public.bookings add constraint bookings_no_student_overlap
  exclude using gist (
    student_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  )
  where (
    student_id is not null
    and scheduled_start is not null
    and scheduled_end is not null
    and status in ('pending', 'confirmed')
  );

-- ---------------------------------------------------------------------------
-- customer_cancel_booking — restore reserved credit on pending checkouts.
-- ---------------------------------------------------------------------------
create or replace function public.customer_cancel_booking(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_caller uuid := auth.uid();
  v_status public.booking_status;
  v_start timestamptz;
  v_pay record;
  v_early boolean;
  v_res jsonb := '{}'::jsonb;
  v_credit_restored int := 0;
begin
  select account_id, status, scheduled_start
    into v_account, v_status, v_start
    from public.bookings
   where id = p_booking
   for update;

  if v_account is null then
    raise exception 'Booking not found';
  end if;
  if v_caller is distinct from v_account and not public.is_admin(v_caller) then
    raise exception 'Not authorized';
  end if;
  if v_status not in ('pending', 'confirmed') then
    return jsonb_build_object('status', 'noop', 'booking_status', v_status::text);
  end if;

  v_early := (v_start is null) or (v_start - now() >= interval '24 hours');

  -- Pending Stripe/credit checkout: restore reserved credit immediately.
  select * into v_pay
    from public.payments
   where booking_id = p_booking
     and status = 'requires_payment'
   order by created_at desc
   limit 1
   for update;

  if v_pay.id is not null then
    if coalesce(v_pay.credit_applied_cents, 0) > 0 then
      insert into public.dollar_credit_ledger (
        account_id, amount_cents, entry_type, payment_id, booking_id, reason, reference, created_by
      ) values (
        v_pay.account_id,
        v_pay.credit_applied_cents,
        'restoration',
        v_pay.id,
        p_booking,
        'customer cancellation — reserved credit restored',
        'restore:' || v_pay.id::text,
        v_caller
      )
      on conflict (reference) do nothing;
      v_credit_restored := v_pay.credit_applied_cents;
    end if;

    update public.payments
       set status = 'canceled',
           note = 'customer cancelled pending checkout'
     where id = v_pay.id;

    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           payment_hold_expires_at = null,
           payment_status = 'canceled'
     where id = p_booking;

    perform public.log_admin_action(
      'customer_cancel_booking',
      'bookings',
      p_booking,
      jsonb_build_object('status', v_status::text),
      jsonb_build_object(
        'status', 'cancelled',
        'early', true,
        'pending_checkout', true,
        'restored_credit_cents', v_credit_restored
      ),
      'customer cancelled pending checkout; reserved credit restored'
    );

    return jsonb_build_object(
      'status', 'cancelled',
      'early', true,
      'restored_credit_cents', v_credit_restored,
      'restored_minutes', 0
    );
  end if;

  if v_early then
    v_res := public.restore_booking_value(p_booking, 'customer cancellation 24h+ — value restored');
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;
  else
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = p_booking;
    perform public.try_full_earning(p_booking, 'late customer cancellation (<24h) — full tutor compensation');
    v_res := jsonb_build_object('restored', 0);
  end if;

  perform public.log_admin_action(
    'customer_cancel_booking',
    'bookings',
    p_booking,
    jsonb_build_object('status', v_status::text),
    jsonb_build_object('status', 'cancelled', 'early', v_early) || v_res,
    case
      when v_early then 'early cancellation (value restored)'
      else 'late cancellation (forfeit; tutor paid)'
    end
  );

  return jsonb_build_object('status', 'cancelled', 'early', v_early) || v_res;
end;
$$;

revoke all on function public.customer_cancel_booking(uuid) from public;
grant execute on function public.customer_cancel_booking(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
