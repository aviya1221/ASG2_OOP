-- Polls at any time (docs/features/F3-polls-strategy.md, REQ-30 and REQ-38).
-- The teacher of a lesson may publish a poll before, during or after the lesson.
-- At the end of the lesson only a poll published before the end closes; a later one stays open until the teacher closes it.

drop policy surveys_add on public.surveys;
create policy surveys_add on public.surveys for insert to authenticated
  with check (public.teaches_lesson(lesson_id));

create or replace function public.run_minute_jobs() returns void
language sql security definer set search_path = '' as $$
  delete from public.class_faces
  where lesson_id in (select lesson_id from public.attendance_rounds where expires_at <= now());
  update public.surveys s set status = 'closed'
  from public.lessons l
  where l.id = s.lesson_id and s.kind = 'poll' and s.status = 'open' and l.ends_at <= now() and s.published_at < l.ends_at;
$$;
