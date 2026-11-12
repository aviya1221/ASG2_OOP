-- Attendance by confirmation (docs/features/F1-attendance-strategy.md, 2026-11-12).
-- Personal face recognition is removed. The teacher takes one class photo, and the teacher's phone sends
-- only the number of faces in it. For 4 minutes from the photo, each student of the course may confirm
-- "I was in the lesson". If more students confirmed than there are faces, the teacher shares the photo
-- with a number on every face, and every student who confirmed picks their own number.

-- 1. Face recognition is removed: registrations, class face-prints, results and where each student was seen.
drop view public.identified_faces;
drop view public.my_face_status;
drop view public.attendance_sheet;
drop function public.record_attendance_match(uuid, text, integer, integer, real);
drop function public.start_attendance_round(uuid, jsonb);
drop table public.face_sightings;
drop table public.class_faces;
drop table public.attendance_results;
drop table public.face_replacements;
drop function public.apply_face_replacement();
drop table public.face_registrations;
drop type public.attendance_kind;

-- 2. The round is the one class photo of the lesson: how many faces it holds, and when the 4 minutes end.
alter table public.attendance_rounds add column face_count integer not null default 0 check (face_count >= 0);
alter table public.attendance_rounds alter column face_count drop default;

-- Saves the photo's face count, and the 4 minutes for confirming start here (the server calls this).
create function public.start_attendance_round(p_lesson uuid, p_face_count integer) returns timestamptz
language plpgsql set search_path = '' as $$
declare
  v_expires timestamptz := now() + interval '4 minutes';
begin
  insert into public.attendance_rounds (lesson_id, expires_at, face_count) values (p_lesson, v_expires, p_face_count);
  return v_expires;
end
$$;
revoke execute on function public.start_attendance_round(uuid, integer) from public, anon, authenticated;
grant execute on function public.start_attendance_round(uuid, integer) to service_role;

-- 3. "I was in the lesson": one confirmation per student and lesson, sent by the student, within the 4 minutes.
create table public.attendance_confirmations (
  lesson_id uuid not null references public.attendance_rounds (lesson_id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
alter table public.attendance_confirmations enable row level security;

create function public.can_confirm(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.attendance_rounds r
    join public.lessons l on l.id = r.lesson_id
    where r.lesson_id = lesson and r.expires_at > now() and public.studies_course(l.course_id)
  )
$$;

revoke all on public.attendance_confirmations from anon, authenticated;
grant select, insert (lesson_id, student_id) on public.attendance_confirmations to authenticated;
create policy attendance_confirmations_read on public.attendance_confirmations for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_lesson(lesson_id));
create policy attendance_confirmations_add on public.attendance_confirmations for insert to authenticated
  with check (student_id = (select public.my_id_number()) and public.can_confirm(lesson_id));

-- How many confirmed against how many faces. Everyone linked to the lesson may read it; it names no student.
create view public.attendance_counts as
  select
    r.lesson_id,
    r.face_count,
    r.expires_at,
    (select count(*)::integer from public.attendance_confirmations c where c.lesson_id = r.lesson_id) as confirmations
  from public.attendance_rounds r
  where public.linked_to_lesson(r.lesson_id);
revoke all on public.attendance_counts from anon;
grant select on public.attendance_counts to authenticated;

-- 4. Picking a number: only a student who confirmed, while the shared photo is up.
-- A pick with no number says "I am not in the photo", and the teacher always decides it.
alter table public.number_claims alter column number drop not null;

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
        where c.lesson_id = lesson and c.student_id = public.my_id_number()
      )
  )
$$;

-- 5. The teacher's own decision on a student's attendance wins over everything else.
-- Deleting it brings back the automatic result.
create table public.attendance_overrides (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  present boolean not null,
  decided_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);
alter table public.attendance_overrides enable row level security;

create function public.may_override(lesson uuid, student text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.teaches_lesson(lesson) and exists (
    select 1
    from public.lessons l
    join public.course_students cs on cs.course_id = l.course_id
    where l.id = lesson and cs.student_id_number = student
  )
$$;

revoke all on public.attendance_overrides from anon, authenticated;
-- An upsert writes every column it sends, so the key columns may be updated too; the rule below checks them.
grant select, insert (lesson_id, student_id, present), update (lesson_id, student_id, present), delete on public.attendance_overrides to authenticated;
create policy attendance_overrides_read on public.attendance_overrides for select to authenticated
  using (public.teaches_lesson(lesson_id));
create policy attendance_overrides_add on public.attendance_overrides for insert to authenticated
  with check (public.may_override(lesson_id, student_id));
create policy attendance_overrides_change on public.attendance_overrides for update to authenticated
  using (public.teaches_lesson(lesson_id))
  with check (public.may_override(lesson_id, student_id));
create policy attendance_overrides_remove on public.attendance_overrides for delete to authenticated
  using (public.teaches_lesson(lesson_id));

create function public.stamp_override() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.decided_at := now();
  return new;
end
$$;
create trigger stamp_override before update on public.attendance_overrides
  for each row execute function public.stamp_override();

-- 6. Each student's attendance in each lesson of their course, by the rules of the decisions note:
--    the teacher's decision; no photo; within the 4 minutes; no confirmation; no more confirmations
--    than faces; then the picks. Closed to the page: the teacher reads it through attendance_sheet,
--    and a student reads their own rows through my_attendance.
create view public.attendance_status as
  select
    l.id as lesson_id,
    cs.student_id_number as student_id,
    o.present as teacher_present,
    (k.student_id is not null) as confirmed,
    c.number as claim_number,
    c.status as claim_status,
    coalesce(c.status = 'pending' and c.number is not null and rivals.total > 0, false) as claim_contested,
    case
      when o.present then 'present'
      when not o.present then 'absent'
      when r.lesson_id is null then 'no_photo'
      when r.expires_at > now() then case when k.student_id is null then 'waiting' else 'confirmed' end
      when k.student_id is null then 'absent'
      when counts.total <= r.face_count then 'present'
      when c.status = 'approved' then 'present'
      when c.status = 'rejected' then 'absent'
      when c.status = 'pending' and c.number is not null and rivals.total = 0 then 'present'
      when c.status = 'pending' then 'pending'
      when shared.expires_at <= now() then 'absent'
      else 'pending'
    end as attendance,
    case
      when o.present is not null then 'teacher'
      when r.lesson_id is null or r.expires_at > now() or k.student_id is null then null
      when counts.total <= r.face_count then 'confirmation'
      when c.status in ('approved', 'rejected') then 'teacher'
      when c.status = 'pending' and c.number is not null and rivals.total = 0 then 'photo_number'
    end as decided_by
  from public.lessons l
  join public.course_students cs on cs.course_id = l.course_id
  left join public.attendance_rounds r on r.lesson_id = l.id
  left join public.attendance_overrides o on o.lesson_id = l.id and o.student_id = cs.student_id_number
  left join public.attendance_confirmations k on k.lesson_id = l.id and k.student_id = cs.student_id_number
  left join public.number_claims c on c.lesson_id = l.id and c.student_id = cs.student_id_number
  left join lateral (
    select count(*) as total from public.attendance_confirmations a where a.lesson_id = l.id
  ) counts on true
  left join lateral (
    select min(sp.expires_at) as expires_at from public.shared_photos sp where sp.lesson_id = l.id
  ) shared on true
  left join lateral (
    select count(*) as total
    from public.number_claims oc
    where oc.lesson_id = l.id and oc.number = c.number and oc.student_id <> cs.student_id_number and oc.status <> 'rejected'
  ) rivals on true;
revoke all on public.attendance_status from anon, authenticated;

-- The teacher's sheet. A student is flagged when one of their picks in the course was rejected.
create view public.attendance_sheet as
  select
    st.lesson_id,
    p.id_number,
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
  join public.people p on p.id_number = st.student_id
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

-- A student's own attendance.
create view public.my_attendance as
  select lesson_id, attendance, decided_by, confirmed
  from public.attendance_status
  where student_id = public.my_id_number();
revoke all on public.my_attendance from anon;
grant select on public.my_attendance to authenticated;

-- 7. The minute job no longer deletes class face-prints.
create or replace function public.run_minute_jobs() returns void
language sql security definer set search_path = '' as $$
  update public.surveys s set status = 'closed'
  from public.lessons l
  where l.id = s.lesson_id and s.kind = 'poll' and s.status = 'open' and l.ends_at <= now() and s.published_at < l.ends_at;
$$;

-- 8. Live updates. The dropped tables left the publication with them.
alter publication supabase_realtime add table public.attendance_confirmations, public.attendance_overrides;
