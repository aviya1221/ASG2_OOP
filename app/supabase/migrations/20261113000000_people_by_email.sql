-- Users are identified by email instead of ID number (2026-11-13).
-- A person's key becomes an internal id that no screen shows, and each person has an email,
-- which is what they type to sign in. Renaming the columns keeps every foreign key, access rule
-- and view working; only functions whose text names the old columns are written again.

-- 1. People: an internal id and an email.
alter table public.people rename column id_number to id;
alter table public.people drop constraint people_id_number_check;
alter table public.people alter column id set default gen_random_uuid()::text;

alter table public.people add column email text;
update public.people p set email = lower(u.email) from auth.users u where u.id = p.user_id and u.email is not null;
update public.people set email = id || '@users.lesson.invalid' where email is null;
alter table public.people alter column email set not null;
alter table public.people add constraint people_email_format
  check (email = lower(trim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table public.people add constraint people_email_unique unique (email);

alter table public.courses rename column teacher_id_number to teacher_id;
alter table public.course_students rename column student_id_number to student_id;

-- 2. "Who is asking" gives the internal id. The access rules point to the function itself, not to its
-- name, so they keep working under the new name.
alter function public.my_id_number() rename to my_person_id;

create or replace function public.my_person_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.people where user_id = auth.uid()
$$;

-- 3. The functions whose text names the old columns or the old function.
create or replace function public.teaches_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = course and c.teacher_id = public.my_person_id()
  )
$$;

create or replace function public.studies_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_students cs
    where cs.course_id = course and cs.student_id = public.my_person_id()
  )
$$;

create or replace function public.teaches_student(student text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.course_students cs
    join public.courses c on c.id = cs.course_id
    where cs.student_id = student and c.teacher_id = public.my_person_id()
  )
$$;

create or replace function public.may_override(lesson uuid, student text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teaches_lesson(lesson) and exists (
    select 1
    from public.lessons l
    join public.course_students cs on cs.course_id = l.course_id
    where l.id = lesson and cs.student_id = student
  )
$$;

create or replace function public.can_claim_number(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.shared_photos s
    join public.lessons l on l.id = s.lesson_id
    where s.lesson_id = lesson
      and s.expires_at > now()
      and public.studies_course(l.course_id)
      and exists (
        select 1 from public.attendance_confirmations c
        where c.lesson_id = lesson and c.student_id = public.my_person_id()
      )
  )
$$;

create or replace function public.post_message(p_lesson uuid, p_text text, p_reply_to uuid, p_show_name boolean)
returns public.forum_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_writer text := public.my_person_id();
  v_teacher boolean := public.teaches_lesson(p_lesson);
  v_name text;
  v_message public.forum_messages;
begin
  if v_writer is null or not public.linked_to_lesson(p_lesson) then
    raise exception 'not_linked' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'empty_message'; end if;
  if length(p_text) > 2000 then raise exception 'message_too_long'; end if;
  if p_reply_to is not null and not exists (select 1 from public.forum_messages where id = p_reply_to and lesson_id = p_lesson) then
    raise exception 'bad_reply';
  end if;

  if v_teacher or coalesce(p_show_name, false) then
    select name into v_name from public.people where id = v_writer;
  end if;

  insert into public.forum_messages (lesson_id, reply_to, text, writer_name, writer_is_teacher)
  values (p_lesson, p_reply_to, trim(p_text), v_name, v_teacher)
  returning * into v_message;
  insert into public.message_writers (message_id, writer_id) values (v_message.id, v_writer);
  return v_message;
end
$$;

-- A first sign-in creates the account. It succeeds only for an email on the admin's list that has
-- no account yet, so a failed check cancels the new account.
create or replace function public.link_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.people set user_id = new.id where email = lower(trim(new.email)) and user_id is null;
  if not found then
    raise exception 'not_on_the_list';
  end if;
  return new;
end
$$;

-- Creates a course, its students and all its lessons in one step (REQ-02, UC-07).
-- The teacher is {"email", "name"}, and each student is {"email", "name"}.
create or replace function public.create_course(
  p_number text,
  p_name text,
  p_teacher jsonb,
  p_weekly_hours jsonb,
  p_first_date date,
  p_weeks integer,
  p_students jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_course uuid;
  v_teacher_email text := lower(trim(coalesce(p_teacher ->> 'email', '')));
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(trim(p_number), '') = '' then raise exception 'missing_number'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'missing_name'; end if;
  if v_teacher_email = '' or coalesce(trim(p_teacher ->> 'name'), '') = '' then
    raise exception 'missing_teacher';
  end if;
  if jsonb_typeof(p_weekly_hours) <> 'array' or jsonb_array_length(p_weekly_hours) = 0 then
    raise exception 'missing_hours';
  end if;
  if p_first_date is null or coalesce(p_weeks, 0) < 1 then raise exception 'missing_dates'; end if;
  if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) = 0 then
    raise exception 'missing_students';
  end if;
  if exists (select 1 from public.courses where number = trim(p_number)) then
    raise exception 'course_number_exists';
  end if;

  insert into public.people (email, name, role)
  values (v_teacher_email, trim(p_teacher ->> 'name'), 'teacher')
  on conflict (email) do update set name = excluded.name;

  insert into public.courses (number, name, teacher_id, weekly_hours)
  select trim(p_number), trim(p_name), p.id, p_weekly_hours
  from public.people p where p.email = v_teacher_email
  returning id into v_course;

  insert into public.people (email, name, role)
  select distinct on (lower(trim(s ->> 'email'))) lower(trim(s ->> 'email')), trim(s ->> 'name'), 'student'::public.user_role
  from jsonb_array_elements(p_students) s
  on conflict (email) do update set name = excluded.name;

  insert into public.course_students (course_id, student_id)
  select distinct v_course, p.id
  from jsonb_array_elements(p_students) s
  join public.people p on p.email = lower(trim(s ->> 'email'));

  insert into public.lessons (course_id, lecture_number, starts_at, ends_at)
  select v_course, row_number() over (order by sessions.starts_at), sessions.starts_at, sessions.ends_at
  from (
    select
      (d::date + (slot ->> 'start')::time) at time zone 'Asia/Jerusalem' as starts_at,
      (d::date + (slot ->> 'end')::time) at time zone 'Asia/Jerusalem' as ends_at
    from jsonb_array_elements(p_weekly_hours) slot
    cross join generate_series(
      p_first_date::timestamp,
      (p_first_date + (p_weeks * 7 - 1))::timestamp,
      interval '1 day'
    ) d
    where extract(dow from d) = (slot ->> 'day')::integer
  ) sessions;

  return v_course;
end
$$;

-- 4. The teacher's attendance sheet gives each student's internal id and email, and no ID number.
drop view public.attendance_sheet;
create view public.attendance_sheet as
  select
    st.lesson_id,
    p.id as student_id,
    p.email,
    p.name,
    st.attendance,
    st.decided_by,
    st.confirmed,
    st.teacher_present is not null as changed_by_teacher,
    st.claim_number,
    st.claim_status,
    st.claim_contested,
    claims.rejected > 0 as flagged
  from public.attendance_status st
  join public.people p on p.id = st.student_id
  cross join lateral (
    select count(*) as rejected
    from public.number_claims nc
    join public.lessons cl on cl.id = nc.lesson_id
    join public.lessons sl on sl.id = st.lesson_id
    where nc.student_id = st.student_id and nc.status = 'rejected' and cl.course_id = sl.course_id
  ) claims
  where public.teaches_lesson(st.lesson_id);
revoke all on public.attendance_sheet from anon;
grant select on public.attendance_sheet to authenticated;

-- 5. No function may still name the ID number.
do $$
begin
  if exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and prosrc ~ '(id_number|my_id_number)'
  ) then
    raise exception 'a function still names the ID number';
  end if;
end
$$;
