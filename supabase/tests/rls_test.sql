-- =====================================================================
--  Privacy & security tests for supabase/schema.sql (Director's Plan §9)
--
--  Two students (Alice, Bob), one admin (Ada), one pending sign-up (Pat).
--  Each check acts as one of them exactly as the website would: role
--  "authenticated" (or "anon" when signed out) with their user id.
--
--  Run on a throwaway local database:   supabase/tests/run.sh
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;
\o /dev/null

-- ---------------------------------------------------------------- helpers
create schema t;
create table t.results (n serial, name text, ok boolean);
create function t.ok(cond boolean, name text) returns void
  language sql security definer as $$ insert into t.results (name, ok) values (name, coalesce(cond, false)); $$;
-- Runs a statement as the current user and passes if the database refuses it.
create function t.refused(stmt text, name text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then perform t.ok(true, name); return; end;
  perform t.ok(false, name || '  [was allowed]');
end $$;
-- Runs a statement as the current user and returns how many rows it touched/returned.
create function t.n(stmt text) returns int language plpgsql as $$
declare c int; begin execute 'with x as (' || stmt || ') select count(*) from x' into c; return c; end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

\set alice '''a0000000-0000-0000-0000-00000000000a'''
\set bob   '''b0000000-0000-0000-0000-00000000000b'''
\set ada   '''ad000000-0000-0000-0000-0000000000ad'''
\set pat   '''9a000000-0000-0000-0000-00000000009a'''

-- ---------------------------------------------------------------- sign-up rules (§9.2)
insert into auth.users (id, email, raw_user_meta_data) values
  (:alice, 'alice.a@student.agoraism.com', '{"full_name":"Alice Arias","class":"4 ESO A","school_id":"1"}'),
  (:bob,   'bob.b@student.agoraism.com',   '{"full_name":"Bob Blanco","class":"4 ESO B","school_id":"1"}'),
  (:ada,   'ada.admin@agoraism.com',       '{"full_name":"Ada Admin","class":"Staff","school_id":"1"}'),
  (:pat,   'pat.p@student.agoraism.com',   '{"full_name":"Pat Pending","class":"1 ESO A","school_id":"1"}');
select t.refused($$insert into auth.users (email, raw_user_meta_data) values ('eve@gmail.com', '{"full_name":"Eve","school_id":"1"}')$$,
  'sign-up with a non-school email domain is refused');
select t.refused($$insert into auth.users (email, raw_user_meta_data) values ('eve@student.agoraism.com', '{"full_name":"Eve"}')$$,
  'sign-up without choosing a school is refused');
select t.ok((select count(*) from profiles) = 4, 'valid sign-ups create a pending profile each');
select t.ok((select bool_and(status = 'pending' and role = 'student') from profiles), 'new profiles start as pending students');

-- ---------------------------------------------------------------- codes
set role authenticated; set request.jwt.claim.sub = :alice;
select t.refused($$select redeem_code('WRONG')$$, 'a wrong code is refused');
select t.ok(redeem_code('recycle26') = 'member', 'the join code (any case) makes a student a member');
set request.jwt.claim.sub = :bob;   select redeem_code('RECYCLE26');
set request.jwt.claim.sub = :ada;   select t.ok(redeem_code('CHANGE-ME-ADMIN') = 'admin', 'the admin code makes an admin');
reset role;
select t.ok((select role from profiles where id = :alice) = 'student', 'the join code does not grant admin');

-- ---------------------------------------------------------------- signed-out visitors
set role anon; set request.jwt.claim.sub = '';
select t.ok(t.n('select * from profiles') = 0,          'signed out: no profiles visible');
select t.ok(t.n('select * from app_secrets') = 0,       'signed out: codes not visible');
select t.ok(t.n('select * from ratings') = 0,           'signed out: no ratings visible');
select t.ok(t.n('select * from schools') = 1,           'signed out: active schools visible for the sign-up form');
select t.ok((public_stats()->>'members')::int = 2,      'signed out: public summary works and counts student members only');
select t.ok(public_stats()::text !~* 'alice|bob|@',     'public summary contains no names or emails');
select t.refused($$select redeem_code('RECYCLE26')$$,   'signed out: cannot redeem a code');
reset role;

-- ---------------------------------------------------------------- profiles (§9.1 rows 1-4)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from profiles') = 1,                         'student sees only their own profile row');
select t.ok(t.n($$select * from profiles where email like 'bob%'$$) = 0, 'student cannot read another student''s email');
select t.ok(t.n('select * from member_directory') = 2,                 'directory lists the student members');
select t.ok(not exists (select 1 from information_schema.columns where table_name = 'member_directory' and column_name in ('email','phone','phone_cc')),
  'directory has no email or phone columns');
select t.ok(t.n('select * from member_directory where group_id is not null') = 0, 'directory hides groups before they are published');
update profiles set role = 'admin', status = 'member', group_id = null, grc_id = 'HAX-00', grc_id_manual = true,
                    email = 'x@x.com', school_id = null, full_name = 'Alice Arias Ruiz', class = '4 ESO B', phone_cc = '+34', phone = '600111222'
  where id = :alice;
reset role;
select t.ok((select role = 'student' and status = 'member' and email = 'alice.a@student.agoraism.com' and school_id = 1
                    and grc_id = 'ALI-22' and not grc_id_manual from profiles where id = :alice),
  'student self-promotion / email / school / GRC ID change is silently undone');
select t.ok((select full_name = 'Alice Arias Ruiz' and class = '4 ESO B' and phone = '600111222' from profiles where id = :alice),
  'student can change their own name, class and WhatsApp');
set role authenticated; set request.jwt.claim.sub = :alice;
select t.ok(t.n($$update profiles set full_name = 'Hacked' where id = 'b0000000-0000-0000-0000-00000000000b' returning 1$$) = 0,
  'student cannot change another student''s profile');
select t.ok(t.n('delete from profiles returning 1') = 0, 'student cannot delete profiles');
select t.refused($$insert into profiles (id, email, full_name) values (gen_random_uuid(), 'z@z.com', 'Z')$$, 'student cannot create profiles');
reset role;

-- ---------------------------------------------------------------- pending accounts
set role authenticated; set request.jwt.claim.sub = :pat;
select t.ok(t.n('select * from member_directory') = 0, 'pending account: directory is empty');
select t.ok(t.n('select * from tasks') = 0,            'pending account: no activities');
select t.ok(t.n('select * from announcements') = 0,    'pending account: no announcements');
select t.refused($$select save_survey('{}'::jsonb, '{}', null)$$, 'pending account: cannot send the survey');
reset role;

-- ---------------------------------------------------------------- survey (§7.6, §9.1 row 5)
set role authenticated; set request.jwt.claim.sub = :alice;
select save_survey(jsonb_build_object(:bob, 5, :ada, 1, :alice, 5, :pat, 2), '{Mon,Tue}', 'Private note from Alice');
select t.ok(t.n('select * from ratings') = 1,                     'survey stores ratings for student members only (not self, admins or pending)');
select t.ok(t.n('select * from survey_submissions') = 1,          'student sees their own submission');
select t.refused($$insert into ratings (rater_id, ratee_id, score) values ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b',1)$$,
  'student cannot write ratings except through the survey');
select t.ok(t.n('delete from ratings returning 1') = 0,           'student cannot delete ratings directly');
set request.jwt.claim.sub = :bob;
select save_survey(jsonb_build_object(:alice, 4), '{}', null);
select t.ok(t.n('select * from ratings') = 1,                     'second student sees only their own rating');
select t.ok(t.n($$select * from ratings where rater_id = 'a0000000-0000-0000-0000-00000000000a'$$) = 0, 'student cannot read who rated them');
select t.ok(t.n($$select * from survey_submissions where user_id = 'a0000000-0000-0000-0000-00000000000a'$$) = 0, 'student cannot read another''s days or note');
select t.refused($$select reset_survey()$$,                       'student cannot reset the survey');
select t.ok((select count(*) from group_league()) = 0,            'group league is empty for students before publishing');
set request.jwt.claim.sub = :ada;
select t.ok(t.n('select * from ratings') = 2,                     'admin reads every rating');
select t.ok(t.n('select * from survey_submissions') = 2,          'admin reads every submission and note');
update app_settings set survey_open = false;
set request.jwt.claim.sub = :alice;
select t.refused($$select save_survey('{}'::jsonb, '{}', null)$$, 'student cannot change answers once the survey is closed');
select t.ok(t.n('update app_settings set survey_open = true returning 1') = 0, 'student cannot reopen the survey');
set request.jwt.claim.sub = :ada; update app_settings set survey_open = true;
reset role;

-- ---------------------------------------------------------------- codes stay secret (§9.1 row 9)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from app_secrets') = 0, 'student cannot read the join or admin code');
select t.ok(t.n($$update app_secrets set admin_code = 'MINE' returning 1$$) = 0, 'student cannot change the codes');
set request.jwt.claim.sub = :ada;
select t.ok(t.n('select * from app_secrets') = 1, 'admin can read the codes');
insert into announcements (title, body, author) values ('Welcome', 'First session soon', 'GRC');
reset role;

-- ---------------------------------------------------------------- groups & sessions (§9.1 row 8)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.refused(format($$select save_groups(2, '{"%s":1}'::jsonb)$$, :alice), 'student cannot build groups');
select t.refused($$insert into sessions (date) values (current_date)$$, 'student cannot create sessions');
set request.jwt.claim.sub = :ada;
select save_groups(2, jsonb_build_object(:alice, 1, :bob, 2));
insert into sessions (id, group_id, date, start_time, end_time, status, kg, bags) overriding system value values
  (101, 1, current_date - 7, '10:50', '11:40', 'done', 12.5, 3),
  (102, 2, current_date - 6, '10:50', '11:40', 'done', 8.0, 2),
  (103, 1, current_date + 7, '10:50', '11:40', 'scheduled', null, null),
  (104, 2, current_date + 8, '10:50', '11:40', 'scheduled', null, null);
set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from sessions') = 0, 'student sees no sessions before groups are published');
select t.ok((select group_id from profiles where id = auth.uid()) = 1, 'student can read their own group');
set request.jwt.claim.sub = :ada; update app_settings set groups_published = true;
set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from sessions') = 2 and t.n('select * from sessions where group_id = 2') = 0,
  'after publishing, student sees only their group''s sessions');
select t.ok(t.n('select * from member_directory where group_id is not null') = 2, 'after publishing, directory shows groups');
select t.ok((select count(*) from group_league()) = 2, 'after publishing, students see the group league');
select t.ok(t.n('update sessions set kg = 999 returning 1') = 0, 'student cannot change session impact');
reset role;

-- ---------------------------------------------------------------- attendance (§9.1 row 6)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.refused($$insert into attendance values (101, 'a0000000-0000-0000-0000-00000000000a', 'present')$$, 'student cannot mark their own attendance');
set request.jwt.claim.sub = :ada;
insert into attendance values (101, :alice, 'present'), (102, :bob, 'absent');
set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from attendance') = 1, 'student sees only their own attendance');
select t.ok(t.n($$update attendance set status = 'present' returning 1$$) = 0, 'student cannot edit attendance');
set request.jwt.claim.sub = :bob;
select t.ok(t.n($$select * from attendance where user_id = 'a0000000-0000-0000-0000-00000000000a'$$) = 0, 'student cannot see another''s attendance');
reset role;

-- ---------------------------------------------------------------- absence requests (§9.1 row 7)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.refused($$insert into absence_requests (session_id, user_id, reason) values (104, auth.uid(), 'x')$$, 'student cannot ask to miss another group''s session');
select t.refused($$insert into absence_requests (session_id, user_id, reason) values (103, 'b0000000-0000-0000-0000-00000000000b', 'x')$$, 'student cannot file a request for someone else');
select t.refused($$insert into absence_requests (session_id, user_id, reason, status) values (103, auth.uid(), 'x', 'approved')$$, 'student cannot pre-approve their own request');
insert into absence_requests (session_id, user_id, reason) values (103, :alice, 'Exam that morning');
select t.ok(t.n($$update absence_requests set status = 'approved' returning 1$$) = 0, 'student cannot approve their own request');
set request.jwt.claim.sub = :bob;
select t.ok(t.n('select * from absence_requests') = 0, 'student cannot see another''s absence request');
set request.jwt.claim.sub = :ada;
update absence_requests set status = 'approved' where session_id = 103;
reset role;
select t.ok((select status from attendance where session_id = 103 and user_id = :alice) = 'excused', 'approving a request marks the student excused');

-- ---------------------------------------------------------------- reflections (§9.1 row 7)
set role authenticated; set request.jwt.claim.sub = :alice;
select t.refused($$insert into reflections (session_id, user_id, did) values (103, auth.uid(), 'x')$$, 'student cannot reflect on a session they did not attend');
insert into reflections (session_id, user_id, did) values (101, :alice, 'Sorted the yellow bins');
select t.refused($$update reflections set session_id = 103 where session_id = 101$$, 'student cannot move a reflection onto a session they did not attend');
select t.refused($$update reflections set user_id = 'b0000000-0000-0000-0000-00000000000b'$$, 'student cannot hand a reflection to someone else');
select t.ok(t.n($$update reflections set learned = 'Teamwork' where session_id = 101 returning 1$$) = 1, 'student can edit their own reflection');
set request.jwt.claim.sub = :bob;
select t.ok(t.n('select * from reflections') = 0, 'student cannot read another''s reflection');
reset role;

-- ---------------------------------------------------------------- activities & announcements
set role authenticated; set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from tasks') = 2, 'member sees the active activities');
select t.refused($$insert into tasks (type, title) values ('link', 'x')$$, 'student cannot create activities');
select t.refused($$insert into task_done (task_id, user_id) select id, 'b0000000-0000-0000-0000-00000000000b' from tasks limit 1$$, 'student cannot tick an activity for someone else');
select t.ok(t.n('select * from announcements') = 1, 'member can read announcements');
select t.refused($$insert into announcements (title, body) values ('x', 'y')$$, 'student cannot post announcements');
select t.refused($$insert into schools (name, student_domain) values ('Fake', 'gmail.com')$$, 'student cannot add a school');
reset role;

-- ---------------------------------------------------------------- regrouping keeps history (§6 done-when)
set role authenticated; set request.jwt.claim.sub = :ada;
select save_groups(2, jsonb_build_object(:alice, 2, :bob, 1));
set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from sessions where id = 101') = 1, 'after regrouping, a student still sees sessions they attended');
select t.ok(t.n('select * from sessions where id = 104') = 1, 'after regrouping, a student sees their new group''s sessions');
reset role;

-- ---------------------------------------------------------------- inactive accounts
set role authenticated; set request.jwt.claim.sub = :ada;
update profiles set status = 'inactive' where id = :alice;
set request.jwt.claim.sub = :alice;
select t.ok(t.n('select * from member_directory') = 0, 'paused account: directory is empty');
select t.ok(t.n('select * from sessions where id = 104') = 0, 'paused account: group sessions hidden');
select redeem_code('RECYCLE26');
reset role;
select t.ok((select status from profiles where id = :alice) = 'inactive', 'paused account cannot reactivate itself with the join code');
-- a paused admin loses admin rights
update profiles set status = 'inactive' where id = :ada;
set role authenticated; set request.jwt.claim.sub = :ada;
select t.ok(t.n('select * from app_secrets') = 0 and t.n('select * from ratings') = 0, 'paused admin loses admin access');
reset role;

-- ---------------------------------------------------------------- GRC IDs use plain letters
select t.ok(make_grc_id('Álvaro Serrano', '619 12 34 37') = 'ALV-37', 'GRC ID drops accents (ALV-37, not ÁLV-37)');
select t.ok(make_grc_id('Íñigo Núñez', null) = 'INI-NU', 'GRC ID without a phone uses plain surname letters (INI-NU)');

-- ---------------------------------------------------------------- report
\o
\set QUIET off
\pset footer off
select case when ok then 'PASS' else 'FAIL' end as result, name from t.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
do $$ begin if exists (select 1 from t.results where not ok) then raise exception 'Some security tests failed'; end if; end $$;
