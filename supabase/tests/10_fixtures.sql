-- Test fixtures: two students, two tutor applicants, one admin.
-- Inserting into auth.users fires the real on_auth_user_created trigger
-- from the actual migration, exactly as it would on a real Supabase
-- project — this is not a hand-rolled substitute for that logic.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'student.alice@example.com',
    '{"requested_role": "student", "display_name": "Alice"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'student.bob@example.com',
    '{"requested_role": "student", "display_name": "Bob"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'tutor.carol@example.com',
    '{"requested_role": "tutor", "display_name": "Carol"}'::jsonb),
  ('00000000-0000-0000-0000-000000000004', 'tutor.dave@example.com',
    '{"requested_role": "tutor", "display_name": "Dave"}'::jsonb),
  ('00000000-0000-0000-0000-000000000005', 'admin.eve@example.com',
    '{"requested_role": "student", "display_name": "Eve"}'::jsonb);

-- Simulates the documented "first administrator" bootstrap process
-- (see SETUP.md): a direct SQL update run by the project owner/developer
-- as the table owner, bypassing RLS and the normal grants entirely.
-- Nothing in the application ever performs this update.
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000005';

-- Approve Carol as a tutor via the real admin RPC, exactly like the admin
-- dashboard will call it, so her "approved tutor" access can be tested.
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}';
set role authenticated;
select public.admin_set_tutor_status(
  '00000000-0000-0000-0000-000000000003',
  'approved',
  'Looks great, approved in test fixtures.'
);
reset role;
reset request.jwt.claims;

-- Dave is left as the default 'pending' status to test the pending-tutor
-- experience.
