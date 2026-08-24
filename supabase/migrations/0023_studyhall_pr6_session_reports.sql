-- =============================================================================
-- Study Hall PR6 — post-session reports (Guide → parent accountability summary)
--
-- Goals:
--   * One structured report per completed Study Hall booking
--   * Concise: focus, what they worked on, redirection, optional Guide note
--   * NOT academic grading / mastery / tutoring progress
--   * Explicit RLS: Guide (assigned) submit+read; parent (own account) read-only;
--     admin read; no unrelated access
--   * Writes only via SECURITY DEFINER RPC (no client INSERT)
--   * Reports are FINAL on submission (no edit path in this PR)
--
-- Historical safety: additive only. Does not change PR2 pricing, PR3 free trial,
-- PR4 matching/T−5/whole-hour rules, PR5 Guide workspace, or compensation.
--
-- Do NOT apply this migration to production from the agent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- session_reports — 1:1 with a completed booking
-- ---------------------------------------------------------------------------
create table if not exists public.session_reports (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null unique references public.bookings (id) on delete restrict,
  tutor_id            uuid not null references public.profiles (id) on delete restrict,
  account_id          uuid not null references public.profiles (id) on delete restrict,
  focus_rating        text not null
                        check (focus_rating in (
                          'great_focus',
                          'good_focus',
                          'needed_redirection',
                          'difficult_session'
                        )),
  work_summary        text not null
                        check (char_length(btrim(work_summary)) between 1 and 280),
  redirection_level   text not null
                        check (redirection_level in ('none', 'a_little', 'several_times')),
  guide_note          text
                        check (guide_note is null or char_length(btrim(guide_note)) between 1 and 280),
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists session_reports_account_idx
  on public.session_reports (account_id, submitted_at desc);
create index if not exists session_reports_tutor_idx
  on public.session_reports (tutor_id, submitted_at desc);

comment on table public.session_reports is
  'Study Hall PR6: short Guide post-session accountability summary for the parent. One per booking; final on submit.';

-- ---------------------------------------------------------------------------
-- submit_session_report — assigned Guide (or admin) only; booking must be
-- completed; one report per booking; final (no update RPC).
-- ---------------------------------------------------------------------------
create or replace function public.submit_session_report(
  p_booking uuid,
  p_focus text,
  p_work_summary text,
  p_redirection text,
  p_guide_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bk record;
  v_id uuid;
  v_work text := btrim(coalesce(p_work_summary, ''));
  v_note text := nullif(btrim(coalesce(p_guide_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, tutor_id, account_id, status
    into v_bk
    from public.bookings
   where id = p_booking;

  if v_bk.id is null then
    raise exception 'Booking not found';
  end if;

  if v_bk.tutor_id is null then
    raise exception 'This booking has no assigned Guide';
  end if;

  if v_uid is distinct from v_bk.tutor_id and not public.is_admin(v_uid) then
    raise exception 'Not authorized';
  end if;

  if v_bk.status is distinct from 'completed' then
    raise exception 'Reports can only be submitted for completed Study Hall sessions';
  end if;

  if p_focus is null or p_focus not in (
    'great_focus', 'good_focus', 'needed_redirection', 'difficult_session'
  ) then
    raise exception 'A valid focus rating is required';
  end if;

  if p_redirection is null or p_redirection not in ('none', 'a_little', 'several_times') then
    raise exception 'A valid redirection level is required';
  end if;

  if char_length(v_work) < 1 or char_length(v_work) > 280 then
    raise exception 'What they worked on is required (1–280 characters)';
  end if;

  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'Guide note must be at most 280 characters';
  end if;

  begin
    insert into public.session_reports (
      booking_id, tutor_id, account_id,
      focus_rating, work_summary, redirection_level, guide_note
    ) values (
      p_booking, v_bk.tutor_id, v_bk.account_id,
      p_focus, v_work, p_redirection, v_note
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A report has already been submitted for this session';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — SELECT for assigned Guide, owning parent account, or admin.
-- No INSERT / UPDATE / DELETE for authenticated (writes via DEFINER only).
-- ---------------------------------------------------------------------------
alter table public.session_reports enable row level security;

drop policy if exists session_reports_select on public.session_reports;
create policy session_reports_select on public.session_reports
  for select to authenticated
  using (
    tutor_id = auth.uid()
    or account_id = auth.uid()
    or public.is_admin(auth.uid())
  );

revoke all on public.session_reports from public;
grant select on public.session_reports to authenticated;
grant all on public.session_reports to service_role;

revoke all on function public.submit_session_report(uuid, text, text, text, text) from public;
grant execute on function public.submit_session_report(uuid, text, text, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
