-- Attendance (docs/07-EDD/attendance.md, section 3).
-- Face data is closed to the page: only the server, with the secret key, can read it.

create type public.attendance_kind as enum ('present', 'review', 'not_found', 'conflict');
create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.face_registrations (
  student_id text primary key references public.people (id_number) on delete cascade,
  hash text check (hash ~ '^[0-9a-f]{64}$'),
  opted_out boolean not null default false,
  check (opted_out or hash is not null)
);

create table public.face_replacements (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.people (id_number) on delete cascade,
  new_hash text not null check (new_hash ~ '^[0-9a-f]{64}$'),
  status public.request_status not null default 'pending',
  decided_by text references public.people (id_number),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index face_replacements_one_pending on public.face_replacements (student_id) where status = 'pending';

create table public.attendance_rounds (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.class_faces (
  lesson_id uuid not null references public.attendance_rounds (lesson_id) on delete cascade,
  photo_no integer not null,
  face_no integer not null,
  box integer[] not null check (array_length(box, 1) = 4),
  print real[] not null check (array_length(print, 1) = 128),
  primary key (lesson_id, photo_no, face_no)
);

create table public.attendance_results (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  result public.attendance_kind not null,
  photo_no integer,
  face_no integer,
  score real,
  decided_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
create index attendance_results_face on public.attendance_results (lesson_id, photo_no, face_no);

create table public.seat_requests (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  row_no integer not null check (row_no between 1 and 15),
  seat_no integer not null check (seat_no between 1 and 20),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (lesson_id, student_id)
);

create table public.push_subscriptions (
  endpoint text primary key,
  student_id text not null references public.people (id_number) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_student on public.push_subscriptions (student_id);

alter table public.face_registrations enable row level security;
alter table public.face_replacements enable row level security;
alter table public.attendance_rounds enable row level security;
alter table public.class_faces enable row level security;
alter table public.attendance_results enable row level security;
alter table public.seat_requests enable row level security;
alter table public.push_subscriptions enable row level security;

-- face_registrations, class_faces and push_subscriptions have no rule, so the page cannot reach them.

create policy attendance_rounds_read on public.attendance_rounds for select to authenticated
  using (public.linked_to_lesson(lesson_id));

create policy attendance_results_read on public.attendance_results for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_lesson(lesson_id));

-- A teacher of one of the student's courses sees that a replacement waits and decides it,
-- and never sees the new hash.
revoke all on public.face_replacements from anon, authenticated;
grant select (id, student_id, status, decided_at, created_at), update (status) on public.face_replacements to authenticated;
create policy face_replacements_read on public.face_replacements for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_student(student_id));
create policy face_replacements_decide on public.face_replacements for update to authenticated
  using (status = 'pending' and public.teaches_student(student_id))
  with check (public.teaches_student(student_id));

-- A student may ask for row and seat after the hour if not present, or at once after opting out.
create function public.can_request_seat(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.attendance_rounds r
    join public.lessons l on l.id = r.lesson_id
    where r.lesson_id = lesson
      and public.studies_course(l.course_id)
      and (
        exists (select 1 from public.face_registrations f where f.student_id = public.my_id_number() and f.opted_out)
        or (
          r.expires_at <= now()
          and not exists (
            select 1 from public.attendance_results a
            where a.lesson_id = lesson and a.student_id = public.my_id_number() and a.result = 'present'
          )
        )
      )
  )
$$;

revoke all on public.seat_requests from anon, authenticated;
grant select on public.seat_requests to authenticated;
grant insert (lesson_id, student_id, row_no, seat_no), update (status) on public.seat_requests to authenticated;
create policy seat_requests_read on public.seat_requests for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_lesson(lesson_id));
create policy seat_requests_add on public.seat_requests for insert to authenticated
  with check (student_id = (select public.my_id_number()) and public.can_request_seat(lesson_id));
create policy seat_requests_decide on public.seat_requests for update to authenticated
  using (status = 'pending' and public.teaches_lesson(lesson_id))
  with check (public.teaches_lesson(lesson_id));

create function public.stamp_seat_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> old.status then
    new.decided_at := now();
  end if;
  return new;
end
$$;
create trigger stamp_seat_decision before update on public.seat_requests
  for each row execute function public.stamp_seat_decision();

-- An approved replacement becomes the student's registered face (REQ-09).
create function public.apply_face_replacement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> old.status then
    new.decided_at := now();
    new.decided_by := public.my_id_number();
    if new.status = 'approved' then
      update public.face_registrations set hash = new.new_hash, opted_out = false where student_id = new.student_id;
    end if;
  end if;
  return new;
end
$$;
create trigger apply_face_replacement before update on public.face_replacements
  for each row execute function public.apply_face_replacement();

-- What a student may read about their own registration. It holds no hash.
create view public.my_face_status as
  select student_id, hash is not null as registered, opted_out
  from public.face_registrations
  where student_id = public.my_id_number();
grant select on public.my_face_status to authenticated;

-- One row per student of the course: a teacher's decision on a request changes only the request,
-- so results stay written only by the server.
create view public.attendance_sheet as
  select
    l.id as lesson_id,
    p.id_number,
    p.name,
    case
      when s.status = 'approved' then 'present'
      when a.result is not null then a.result::text
      when r.expires_at <= now() then 'no_response'
    end as attendance,
    case
      when s.status = 'approved' then 'row_and_seat'
      when a.result is not null then 'face'
    end as decided_by,
    s.row_no,
    s.seat_no,
    s.status as request_status,
    (requests.rejected > 0 or requests.total >= 3) as flagged
  from public.lessons l
  join public.attendance_rounds r on r.lesson_id = l.id
  join public.course_students cs on cs.course_id = l.course_id
  join public.people p on p.id_number = cs.student_id_number
  left join public.attendance_results a on a.lesson_id = l.id and a.student_id = p.id_number
  left join public.seat_requests s on s.lesson_id = l.id and s.student_id = p.id_number
  cross join lateral (
    select count(*) as total, count(*) filter (where sr.status = 'rejected') as rejected
    from public.seat_requests sr
    join public.lessons sl on sl.id = sr.lesson_id
    where sr.student_id = p.id_number and sl.course_id = l.course_id
  ) requests
  where public.teaches_lesson(l.id);
grant select on public.attendance_sheet to authenticated;

-- Saves a round and its faces together, and the hour starts here (the server calls this).
create function public.start_attendance_round(p_lesson uuid, p_faces jsonb) returns timestamptz
language plpgsql set search_path = '' as $$
declare
  v_expires timestamptz := now() + interval '1 hour';
begin
  insert into public.attendance_rounds (lesson_id, expires_at) values (p_lesson, v_expires);
  insert into public.class_faces (lesson_id, photo_no, face_no, box, print)
  select
    p_lesson,
    (f ->> 'photo_no')::integer,
    (f ->> 'face_no')::integer,
    array(select jsonb_array_elements_text(f -> 'box')::integer),
    array(select jsonb_array_elements_text(f -> 'print')::real)
  from jsonb_array_elements(p_faces) f;
  return v_expires;
end
$$;

-- Locks the matched face, so two students matching it at the same moment are handled one
-- after the other and cannot both be present (REQ-13).
create function public.record_attendance_match(
  p_lesson uuid, p_student text, p_photo integer, p_face integer, p_score real
) returns public.attendance_kind
language plpgsql set search_path = '' as $$
declare
  v_others integer;
  v_result public.attendance_kind;
begin
  perform 1 from public.class_faces
    where lesson_id = p_lesson and photo_no = p_photo and face_no = p_face for update;

  select count(*) into v_others
  from public.attendance_results
  where lesson_id = p_lesson and photo_no = p_photo and face_no = p_face and student_id <> p_student;

  v_result := case when v_others = 0 then 'present'::public.attendance_kind else 'conflict'::public.attendance_kind end;

  insert into public.attendance_results (lesson_id, student_id, result, photo_no, face_no, score)
  values (p_lesson, p_student, v_result, p_photo, p_face, p_score)
  on conflict (lesson_id, student_id) do nothing;

  if v_others > 0 then
    update public.attendance_results
    set result = 'conflict', decided_at = now()
    where lesson_id = p_lesson and photo_no = p_photo and face_no = p_face and result <> 'conflict';
  end if;

  return v_result;
end
$$;

revoke execute on function public.start_attendance_round(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.record_attendance_match(uuid, text, integer, integer, real) from public, anon, authenticated;
grant execute on function public.start_attendance_round(uuid, jsonb) to service_role;
grant execute on function public.record_attendance_match(uuid, text, integer, integer, real) to service_role;

-- Runs every minute inside the database, because the free server sleeps (NFR-10).
create function public.run_minute_jobs() returns void
language sql security definer set search_path = '' as $$
  delete from public.class_faces
  where lesson_id in (select lesson_id from public.attendance_rounds where expires_at <= now());
$$;
revoke execute on function public.run_minute_jobs() from public, anon, authenticated;
grant execute on function public.run_minute_jobs() to service_role;

create extension if not exists pg_cron;
select cron.schedule('minute-jobs', '* * * * *', 'select public.run_minute_jobs()');
-- The run history is never cleared by itself, and it could fill the free database.
select cron.schedule('clear-job-history', '0 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$);

create function public.minute_job_schedule() returns text
language sql stable security definer set search_path = '' as $$
  select schedule from cron.job where jobname = 'minute-jobs'
$$;
revoke execute on function public.minute_job_schedule() from public, anon, authenticated;
grant execute on function public.minute_job_schedule() to service_role;

alter publication supabase_realtime add table public.attendance_rounds, public.attendance_results, public.seat_requests;
