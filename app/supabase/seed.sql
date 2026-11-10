-- Made-up data for local runs and automated tests. No name or ID number here is real.
-- Students 52 to 99 belong to no course, so browser tests can put them in courses of their own.
-- The sign-in accounts are added by scripts/seed-users.mjs, through the sign-in service.

insert into public.people (id_number, name, role) values
  ('100000001', 'מנהלת המערכת', 'admin'),
  ('200000001', 'מרצה ראשון', 'teacher'),
  ('200000002', 'מרצה שני', 'teacher');

insert into public.people (id_number, name, role)
select '3' || lpad(n::text, 8, '0'), 'סטודנט ' || n, 'student'
from generate_series(1, 99) n;

insert into public.courses (id, number, name, teacher_id_number, weekly_hours) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '1001', 'קורס א', '200000001', '[{"day": 0, "start": "10:00", "end": "12:00"}]'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '2002', 'קורס ב', '200000002', '[{"day": 1, "start": "14:00", "end": "16:00"}]');

insert into public.course_students (course_id, student_id_number)
select 'aaaaaaaa-0000-4000-8000-000000000001', '3' || lpad(n::text, 8, '0')
from generate_series(1, 50) n;

insert into public.course_students (course_id, student_id_number)
values ('bbbbbbbb-0000-4000-8000-000000000002', '300000051');

-- L1 is in progress, L2 has ended, and L3 belongs to the other course.
insert into public.lessons (id, course_id, lecture_number, starts_at, ends_at, topic) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 2, now() - interval '30 minutes', now() + interval '90 minutes', null),
  ('22222222-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 1, now() - interval '7 days', now() - interval '7 days' + interval '2 hours', 'מבוא'),
  ('33333333-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 1, now() - interval '30 minutes', now() + interval '90 minutes', null);
