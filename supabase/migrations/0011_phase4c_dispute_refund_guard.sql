-- =============================================================================
-- African Tutors — Phase 4C pre-merge fix: dispute refund must belong to dispute
-- =============================================================================
-- Hardens admin_resolve_dispute so a Stripe refund included in a resolution is
-- authoritatively tied to the dispute's own account + booking. A dispute for
-- Customer A / Booking A can never refund another customer's payment, another
-- booking's payment, or an unrelated package payment — enforced in the DB, not
-- just the UI. Validation runs BEFORE any financial action so the whole
-- resolution rolls back on a mismatch. Idempotent.
-- =============================================================================

create or replace function public.admin_resolve_dispute(
  p_dispute uuid,
  p_resolution text,                 -- 'denied' | 'courtesy' | 'upheld'
  p_notes text default null,
  p_restore_minutes integer default 0,
  p_credit_cents integer default 0,
  p_refund_payment uuid default null,
  p_refund_cents integer default 0,
  p_refund_stripe_id text default null,
  p_earning_action text default null, -- null | 'void' | 'adjust'
  p_earning_new_cents integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_d record; v_actions jsonb := '{}'::jsonb; v_earn record; v_pay record;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorized'; end if;
  if p_resolution not in ('denied', 'courtesy', 'upheld') then raise exception 'Invalid resolution'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if v_d.id is null then raise exception 'Dispute not found'; end if;
  if v_d.status in ('resolved', 'denied') then
    return jsonb_build_object('status', 'noop', 'dispute_status', v_d.status);
  end if;

  -- Validate the refund payment belongs to THIS dispute BEFORE doing anything.
  if p_refund_payment is not null and p_refund_cents > 0 then
    select account_id, booking_id, purpose into v_pay from public.payments where id = p_refund_payment;
    if v_pay.account_id is null then raise exception 'Refund payment not found'; end if;
    if v_pay.purpose <> 'booking' then
      raise exception 'Refund payment is not a booking payment for this dispute';
    end if;
    if v_pay.account_id is distinct from v_d.account_id then
      raise exception 'Refund payment belongs to a different customer';
    end if;
    if v_pay.booking_id is distinct from v_d.booking_id then
      raise exception 'Refund payment belongs to a different booking';
    end if;
  end if;

  if p_restore_minutes > 0 then
    perform public.admin_adjust_package_minutes(v_d.account_id, p_restore_minutes,
      'dispute resolution: minutes restored', 'dispute:' || p_dispute::text || ':minutes');
    v_actions := v_actions || jsonb_build_object('restored_minutes', p_restore_minutes);
  end if;
  if p_credit_cents > 0 then
    perform public.admin_adjust_dollar_credit(v_d.account_id, p_credit_cents,
      'dispute resolution: account credit', 'dispute:' || p_dispute::text || ':credit');
    v_actions := v_actions || jsonb_build_object('credit_cents', p_credit_cents);
  end if;
  if p_refund_payment is not null and p_refund_cents > 0 then
    perform public.admin_record_refund(p_refund_payment, p_refund_cents, p_refund_stripe_id, 'dispute resolution refund');
    v_actions := v_actions || jsonb_build_object('refund_cents', p_refund_cents);
  end if;
  if p_earning_action = 'void' then
    select id into v_earn from public.tutor_earnings where booking_id = v_d.booking_id;
    if v_earn.id is not null then
      perform public.admin_void_earning(v_earn.id, 'dispute resolution: earning voided');
      v_actions := v_actions || jsonb_build_object('earning', 'voided');
    end if;
  elsif p_earning_action = 'adjust' and p_earning_new_cents is not null then
    select id into v_earn from public.tutor_earnings where booking_id = v_d.booking_id;
    if v_earn.id is not null then
      perform public.admin_adjust_earning(v_earn.id, p_earning_new_cents, 'dispute resolution: earning adjusted');
      v_actions := v_actions || jsonb_build_object('earning_adjusted_cents', p_earning_new_cents);
    end if;
  end if;

  update public.disputes
     set status = case when p_resolution = 'denied' then 'denied' else 'resolved' end,
         resolution = p_resolution, admin_notes = p_notes, financial_actions = v_actions,
         reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_dispute;

  perform public.log_admin_action('dispute_resolved', 'disputes', p_dispute,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object('resolution', p_resolution) || v_actions, p_notes);
  return jsonb_build_object('resolution', p_resolution, 'actions', v_actions);
end;
$$;

revoke all on function public.admin_resolve_dispute(uuid,text,text,integer,integer,uuid,integer,text,text,integer) from public;
grant execute on function public.admin_resolve_dispute(uuid,text,text,integer,integer,uuid,integer,text,text,integer) to authenticated, service_role;

notify pgrst, 'reload schema';
