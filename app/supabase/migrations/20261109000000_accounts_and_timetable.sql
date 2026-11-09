-- Accounts and timetable (SDD 2.2): who may sign in, the courses, their students and their lessons.
-- Every table is closed by default, and the access rules open only what each role needs.

create type public.user_role as enum ('admin', 'teacher', 'student');

-- The people the admin has listed. A person gets a sign-in account on their first
-- sign-in, and user_id is filled in then.
create table public.people (
  id_number text primary key check (id_number ~ '^[0-9]{5,9}$'),
  name text not null check (length(trim(name)) > 0),
  role public.user_role not null,
  user_id uuid unique references auth.users (id) on delete set null
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (length(trim(number)) > 0),
  name text not null check (length(trim(name)) > 0),
  teacher_id_number text not null references public.people (id_number),
  -- A list of {"day": 0-6, "start": "HH:MM", "end": "HH:MM"}, where day 0 is Sunday.
  weekly_hours jsonb not null
);

create table public.course_students (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id_number text not null references public.people (id_number),
  primary key (course_id, student_id_number)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lecture_number integer not null check (lecture_number > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  topic text,
  unique (course_id, lecture_number)
);

create index course_students_student on public.course_students (student_id_number);
create index courses_teacher on public.courses (teacher_id_number);
create index lessons_course on public.lessons (course_id);

-- Who is asking. These run with the owner's rights, so the access rules can use them
-- without reading each other's tables in a circle.

create function public.my_id_number() returns text
language sql stable security definer set search_path = '' as $$
  select id_number from public.people where user_id = auth.uid()
$$;

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.people where user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.teaches_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = course and c.teacher_id_number = public.my_id_number()
  )
$$;

create function public.studies_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_students cs
    where cs.course_id = course and cs.student_id_number = public.my_id_number()
  )
$$;

create function public.linked_to_course(course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teaches_course(course) or public.studies_course(course)
$$;

create function public.linked_to_lesson(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons l
    where l.id = lesson and public.linked_to_course(l.course_id)
  )
$$;

create function public.teaches_lesson(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons l
    where l.id = lesson and public.teaches_course(l.course_id)
  )
$$;

create function public.teaches_student(student text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.course_students cs
    join public.courses c on c.id = cs.course_id
    where cs.student_id_number = student and c.teacher_id_number = public.my_id_number()
  )
$$;

alter table public.people enable row level security;
alter table public.courses enable row level security;
alter table public.course_students enable row level security;
alter table public.lessons enable row level security;

create policy people_read on public.people for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or public.teaches_student(id_number));
create policy people_admin on public.people for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy courses_read on public.courses for select to authenticated
  using ((select public.is_admin()) or public.linked_to_course(id));
create policy courses_admin on public.courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy course_students_read on public.course_students for select to authenticated
  using (
    student_id_number = (select public.my_id_number())
    or (select public.is_admin())
    or public.teaches_course(course_id)
  );
create policy course_students_admin on public.course_students for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy lessons_read on public.lessons for select to authenticated
  using ((select public.is_admin()) or public.linked_to_course(course_id));
create policy lessons_admin on public.lessons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- A first sign-in creates the account. It succeeds only for a person on the admin's
-- list who has no account yet, so a failed check cancels the new account.
create function public.link_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  claimed text := new.raw_user_meta_data ->> 'id_number';
begin
  if claimed is null or split_part(new.email, '@', 1) <> claimed then
    raise exception 'not_on_the_list';
  end if;
  update public.people set user_id = new.id where id_number = claimed and user_id is null;
  if not found then
    raise exception 'not_on_the_list';
  end if;
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_new_user();

-- Creates a course, its students and all its lessons in one step (REQ-02, UC-07).
-- The access rules let only the admin write, and the first check gives a clear refusal.
create function public.create_course(
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
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(trim(p_number), '') = '' then raise exception 'missing_number'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'missing_name'; end if;
  if coalesce(trim(p_teacher ->> 'id_number'), '') = '' or coalesce(trim(p_teacher ->> 'name'), '') = '' then
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

  insert into public.people (id_number, name, role)
  values (trim(p_teacher ->> 'id_number'), trim(p_teacher ->> 'name'), 'teacher')
  on conflict (id_number) do update set name = excluded.name;

  insert into public.courses (number, name, teacher_id_number, weekly_hours)
  values (trim(p_number), trim(p_name), trim(p_teacher ->> 'id_number'), p_weekly_hours)
  returning id into v_course;

  insert into public.people (id_number, name, role)
  select distinct on (s ->> 'id_number') trim(s ->> 'id_number'), trim(s ->> 'name'), 'student'::public.user_role
  from jsonb_array_elements(p_students) s
  on conflict (id_number) do update set name = excluded.name;

  insert into public.course_students (course_id, student_id_number)
  select distinct v_course, trim(s ->> 'id_number')
  from jsonb_array_elements(p_students) s;

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
