-- =============================================================================
-- Study Hall 365 — table ACL hardening + unambiguous booking_quote
-- =============================================================================
-- Additive / idempotent. Does not rewrite bookings, ledgers, Stripe ids, or
-- entitlement math. Does not start Plan My Week.
--
-- Privilege model (tables study_hall_365_subscriptions, study_hall_365_day_usage):
--   * postgres (owner) keeps full control
--   * service_role: ALL — server Stripe sync, membership cancel/resume lookup,
--     webhook upsert, usage writes (service role bypasses RLS)
--   * authenticated: SELECT only — so Management admins can read via the
--     existing is_admin() RLS policies. Parents/Guides still get zero rows.
--     Parent-facing data is get_study_hall_365_membership /
--     get_study_hall_365_entitlement (SECURITY DEFINER, owner postgres).
--   * anon: no table privileges
--   * public: no table privileges
--   * No INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for
--     anon or authenticated. TRUNCATE is not subject to RLS.
--
-- Root cause of extra privileges: postgres ALTER DEFAULT PRIVILEGES IN SCHEMA
-- public granted Dxtm (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN) on new tables
-- to anon/authenticated. 0036/0037 only GRANT/REVOKE SELECT, so Dxtm remained.
--
-- booking_quote: drop the 3-arg wrapper added in 0038. The 4-arg form already
-- defaults p_is_free_trial and p_start, so 3-arg SQL/RPC calls resolve uniquely
-- without PGRST203. Economics / eligibility body is unchanged.
-- =============================================================================

revoke all on table public.study_hall_365_subscriptions from public;
revoke all on table public.study_hall_365_subscriptions from anon;
revoke all on table public.study_hall_365_subscriptions from authenticated;

revoke all on table public.study_hall_365_day_usage from public;
revoke all on table public.study_hall_365_day_usage from anon;
revoke all on table public.study_hall_365_day_usage from authenticated;

grant select on table public.study_hall_365_subscriptions to authenticated;
grant select on table public.study_hall_365_day_usage to authenticated;

grant all on table public.study_hall_365_subscriptions to service_role;
grant all on table public.study_hall_365_day_usage to service_role;

-- One supported booking_quote surface: 4 args, last two defaulted.
drop function if exists public.booking_quote(uuid, integer, boolean);

revoke all on function public.booking_quote(uuid, integer, boolean, timestamp with time zone) from public;
grant execute on function public.booking_quote(uuid, integer, boolean, timestamp with time zone)
  to authenticated, service_role;

notify pgrst, 'reload schema';
