-- Attendance: a student who was not recognised picks their number in the class photo (2026-11-12).
-- After the hour the teacher may share the photo, with a number drawn on every face that belongs to
-- no present student. This replaces the request for a row and seat, which is removed below.

-- Where each matched student was seen: their most similar face in every photo, when it passed the
-- threshold. So a present student is not counted as an unknown face in a second photo.
-- Only the server writes it.
create table public.face_sightings (
  lesson_id uuid not null references public.attendance_rounds (lesson_id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  photo_no integer not null,
  face_no integer not null,
  primary key (lesson_id, student_id, photo_no)
);
create index face_sightings_face on public.face_sightings (lesson_id, photo_no, face_no);

-- The photos the teacher shared. The file is deleted after expires_at, and the row stays as a record.
create table public.shared_photos (
  lesson_id uuid not null references public.attendance_rounds (lesson_id) on delete cascade,
  photo_no integer not null check (photo_no between 0 and 2),
  file_path text not null unique,
  shared_at timestamptz not null default now(),
  expires_at timestamptz not null,
  file_removed boolean not null default false,
  primary key (lesson_id, photo_no)
);

-- The numbers drawn on the shared photos. A number runs across all the photos of the lesson.
create table public.photo_numbers (
  lesson_id uuid not null references public.attendance_rounds (lesson_id) on delete cascade,
  number integer not null check (number > 0),
  photo_no integer not null,
  face_no integer not null,
  box integer[] not null check (array_length(box, 1) = 4),
  primary key (lesson_id, number),
  unique (lesson_id, photo_no, face_no),
  foreign key (lesson_id, photo_no) references public.shared_photos (lesson_id, photo_no) on delete cascade
);

-- "I am number 32". One pick per student and lesson, and the teacher decides it.
create table public.number_claims (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  number integer not null,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (lesson_id, student_id),
  foreign key (lesson_id, number) references public.photo_numbers (lesson_id, number) on delete cascade
);
-- One face is one person, so at most one approved pick for each number.
create unique index number_claims_one_approved on public.number_claims (lesson_id, number) where status = 'approved';
create index number_claims_student on public.number_claims (student_id);

alter table public.face_sightings enable row level security;
alter table public.shared_photos enable row level security;
alter table public.photo_numbers enable row level security;
alter table public.number_claims enable row level security;

-- face_sightings has no rule, so the page cannot reach it.

create policy shared_photos_read on public.shared_photos for select to authenticated
  using (public.linked_to_lesson(lesson_id));
create policy photo_numbers_read on public.photo_numbers for select to authenticated
  using (public.linked_to_lesson(lesson_id));

-- A student may pick while the shared photo is up, if the face check did not mark them present.
create function public.can_claim_number(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.shared_photos s
    join public.lessons l on l.id = s.lesson_id
    where s.lesson_id = lesson
      and s.expires_at > now()
      and public.studies_course(l.course_id)
      and not exists (
        select 1 from public.attendance_results a
        where a.lesson_id = lesson and a.student_id = public.my_id_number() and a.result = 'present'
      )
  )
$$;

revoke all on public.number_claims from anon, authenticated;
grant select on public.number_claims to authenticated;
grant insert (lesson_id, student_id, number), update (status) on public.number_claims to authenticated;
create policy number_claims_read on public.number_claims for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_lesson(lesson_id));
create policy number_claims_add on public.number_claims for insert to authenticated
  with check (student_id = (select public.my_id_number()) and public.can_claim_number(lesson_id));
create policy number_claims_decide on public.number_claims for update to authenticated
  using (status = 'pending' and public.teaches_lesson(lesson_id))
  with check (public.teaches_lesson(lesson_id));

create function public.stamp_claim_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> old.status then
    new.decided_at := now();
  end if;
  return new;
end
$$;
create trigger stamp_claim_decision before update on public.number_claims
  for each row execute function public.stamp_claim_decision();

-- When the teacher approves one pick, the other picks of that number are rejected.
create function public.reject_rival_claims() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    update public.number_claims
    set status = 'rejected'
    where lesson_id = new.lesson_id and number = new.number and student_id <> new.student_id and status = 'pending';
  end if;
  return null;
end
$$;
create trigger reject_rival_claims after update on public.number_claims
  for each row execute function public.reject_rival_claims();

-- The student's own pick, and whether another student picked the same number.
create view public.my_number_claim as
  select
    c.lesson_id,
    c.number,
    c.status,
    exists (
      select 1 from public.number_claims o
      where o.lesson_id = c.lesson_id and o.number = c.number and o.student_id <> c.student_id and o.status <> 'rejected'
    ) as contested
  from public.number_claims c
  where c.student_id = public.my_id_number();
grant select on public.my_number_claim to authenticated;

-- The faces that belong to a present student, for the teacher's count. It names no student.
create view public.identified_faces as
  select a.lesson_id, a.photo_no, a.face_no
  from public.attendance_results a
  where a.result = 'present' and a.photo_no is not null and public.teaches_lesson(a.lesson_id)
  union
  select s.lesson_id, s.photo_no, s.face_no
  from public.face_sightings s
  join public.attendance_results a on a.lesson_id = s.lesson_id and a.student_id = s.student_id and a.result = 'present'
  where public.teaches_lesson(s.lesson_id);
revoke all on public.my_number_claim, public.identified_faces from anon;
grant select on public.identified_faces to authenticated;

-- The shared photos: private, and read by the teacher and by whoever may pick a number.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-photos', 'class-photos', false, 10485760, array['image/jpeg']);

create function public.may_see_class_photo(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shared_photos s
    where s.file_path = path
      and (public.teaches_lesson(s.lesson_id) or public.can_claim_number(s.lesson_id))
  )
$$;

create policy class_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'class-photos' and public.may_see_class_photo(name));

-- The sheet: an approved pick marks the student present, decided by "photo_number".
drop view public.attendance_sheet;
create view public.attendance_sheet as
  select
    l.id as lesson_id,
    p.id_number,
    p.name,
    case
      when c.status = 'approved' then 'present'
      when a.result is not null then a.result::text
      when r.expires_at <= now() then 'no_response'
    end as attendance,
    case
      when c.status = 'approved' then 'photo_number'
      when a.result is not null then 'face'
    end as decided_by,
    c.number as claim_number,
    c.status as claim_status,
    coalesce(rivals.total > 0, false) as claim_contested,
    (claims.rejected > 0 or claims.total >= 3) as flagged
  from public.lessons l
  join public.attendance_rounds r on r.lesson_id = l.id
  join public.course_students cs on cs.course_id = l.course_id
  join public.people p on p.id_number = cs.student_id_number
  left join public.attendance_results a on a.lesson_id = l.id and a.student_id = p.id_number
  left join public.number_claims c on c.lesson_id = l.id and c.student_id = p.id_number
  left join lateral (
    select count(*) as total
    from public.number_claims o
    where o.lesson_id = l.id and o.number = c.number and o.student_id <> p.id_number and o.status <> 'rejected'
  ) rivals on true
  cross join lateral (
    select count(*) as total, count(*) filter (where nc.status = 'rejected') as rejected
    from public.number_claims nc
    join public.lessons cl on cl.id = nc.lesson_id
    where nc.student_id = p.id_number and cl.course_id = l.course_id
  ) claims
  where public.teaches_lesson(l.id);
grant select on public.attendance_sheet to authenticated;

-- Row and seat is replaced by picking a number.
drop table public.seat_requests;
drop function public.can_request_seat(uuid);
drop function public.stamp_seat_decision();

alter publication supabase_realtime add table public.number_claims, public.shared_photos;
