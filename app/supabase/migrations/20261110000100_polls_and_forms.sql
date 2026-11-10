-- Polls and forms (docs/07-EDD/polls-and-forms.md, section 3).
-- A poll is a survey with one single-choice question. The rules are the same for both.

create type public.survey_kind as enum ('poll', 'form');
create type public.survey_status as enum ('draft', 'open', 'closed');

-- Checks the questions: [{"id": "q1", "type": "single", "text": "...", "options": ["a", "b"]}, ...].
create function public.valid_questions(p_kind public.survey_kind, p_questions jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  q jsonb;
  ids text[] := '{}';
begin
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then return false; end if;
  if p_kind = 'poll' and (jsonb_array_length(p_questions) <> 1 or p_questions -> 0 ->> 'type' <> 'single') then return false; end if;
  for q in select * from jsonb_array_elements(p_questions) loop
    if coalesce(q ->> 'id', '') = '' or q ->> 'id' = any(ids) then return false; end if;
    ids := ids || (q ->> 'id');
    if length(trim(coalesce(q ->> 'text', ''))) = 0 then return false; end if;
    case q ->> 'type'
      when 'single', 'multiple' then
        if jsonb_typeof(q -> 'options') <> 'array' or jsonb_array_length(q -> 'options') < 2 then return false; end if;
        if exists (select 1 from jsonb_array_elements_text(q -> 'options') o where length(trim(o)) = 0) then return false; end if;
      when 'rating' then
        if coalesce((q ->> 'scale')::integer, 0) not between 2 and 10 then return false; end if;
      when 'text' then
        null;
      else
        return false;
    end case;
  end loop;
  return true;
end
$$;

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind public.survey_kind not null,
  status public.survey_status not null default 'open',
  allow_change boolean not null default false,
  questions jsonb not null check (public.valid_questions(kind, questions)),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  check (kind = 'form' or status <> 'draft')
);
create index surveys_lesson on public.surveys (lesson_id);

create table public.answers (
  survey_id uuid not null references public.surveys (id) on delete cascade,
  student_id text not null references public.people (id_number) on delete cascade,
  value jsonb not null,
  answered_at timestamptz not null default now(),
  primary key (survey_id, student_id)
);

create table public.poll_totals (
  survey_id uuid not null references public.surveys (id) on delete cascade,
  option_no integer not null,
  count integer not null default 0,
  primary key (survey_id, option_no)
);

alter table public.surveys enable row level security;
alter table public.answers enable row level security;
alter table public.poll_totals enable row level security;

create function public.lesson_in_progress(lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lessons where id = lesson and now() >= starts_at and now() < ends_at)
$$;

create function public.lesson_of_survey(survey uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select lesson_id from public.surveys where id = survey
$$;

-- Survey rules: everyone linked reads it, a draft only the teacher, and a poll starts only during the lesson.
revoke insert, update, delete on public.surveys from anon, authenticated;
grant insert (lesson_id, kind, status, allow_change, questions) on public.surveys to authenticated;
grant update (status, allow_change, questions) on public.surveys to authenticated;

create policy surveys_read on public.surveys for select to authenticated
  using (public.linked_to_lesson(lesson_id) and (status <> 'draft' or public.teaches_lesson(lesson_id)));
create policy surveys_add on public.surveys for insert to authenticated
  with check (public.teaches_lesson(lesson_id) and (kind = 'form' or public.lesson_in_progress(lesson_id)));
create policy surveys_change on public.surveys for update to authenticated
  using (public.teaches_lesson(lesson_id)) with check (public.teaches_lesson(lesson_id));

-- The life of a survey: draft, open, closed. A closed survey never opens again.
create function public.survey_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'closed' then raise exception 'bad_status'; end if;
    if new.status = 'open' then new.published_at := now(); end if;
    return new;
  end if;
  if old.status = 'closed' then raise exception 'survey_closed'; end if;
  if old.status = 'open' and (new.status = 'draft' or new.questions <> old.questions or new.allow_change <> old.allow_change) then
    raise exception 'survey_published';
  end if;
  if new.status = 'open' and old.status = 'draft' then new.published_at := now(); end if;
  if new.status = 'closed' and old.status <> 'closed' then new.closed_at := now(); end if;
  return new;
end
$$;
create trigger survey_lifecycle before insert or update on public.surveys
  for each row execute function public.survey_lifecycle();

-- Answer rules: only the student, only an open survey of the student's lesson, and a change
-- only when the teacher allowed it (REQ-32 to REQ-34, REQ-64 to REQ-66).
create function public.can_answer(survey uuid, may_change boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.surveys s
    join public.lessons l on l.id = s.lesson_id
    where s.id = survey
      and s.status = 'open'
      and public.studies_course(l.course_id)
      and (not may_change or s.allow_change)
  )
$$;

revoke insert, update, delete on public.answers from anon, authenticated;
grant insert (survey_id, student_id, value), update (value) on public.answers to authenticated;

create policy answers_read on public.answers for select to authenticated
  using (student_id = (select public.my_id_number()) or public.teaches_lesson(public.lesson_of_survey(survey_id)));
create policy answers_add on public.answers for insert to authenticated
  with check (student_id = (select public.my_id_number()) and public.can_answer(survey_id, false));
create policy answers_change on public.answers for update to authenticated
  using (student_id = (select public.my_id_number()) and public.can_answer(survey_id, true))
  with check (student_id = (select public.my_id_number()));

-- Checks every answer against its questions: all questions answered, and each answer of its own form.
create function public.check_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  q jsonb;
  a jsonb;
  options integer;
begin
  for q in select * from jsonb_array_elements((select questions from public.surveys where id = new.survey_id)) loop
    a := new.value -> (q ->> 'id');
    options := jsonb_array_length(coalesce(q -> 'options', '[]'::jsonb));
    if a is null then raise exception 'missing_answer'; end if;
    case q ->> 'type'
      when 'single' then
        if jsonb_typeof(a) <> 'number' or (a::text)::integer not between 0 and options - 1 then raise exception 'bad_answer'; end if;
      when 'multiple' then
        if jsonb_typeof(a) <> 'array' or jsonb_array_length(a) = 0
           or exists (select 1 from jsonb_array_elements(a) x where jsonb_typeof(x) <> 'number' or (x::text)::integer not between 0 and options - 1) then
          raise exception 'bad_answer';
        end if;
      when 'rating' then
        if jsonb_typeof(a) <> 'number' or (a::text)::integer not between 1 and (q ->> 'scale')::integer then raise exception 'bad_answer'; end if;
      when 'text' then
        if jsonb_typeof(a) <> 'string' or length(trim(a #>> '{}')) = 0 or length(a #>> '{}') > 2000 then raise exception 'bad_answer'; end if;
    end case;
  end loop;
  new.answered_at := now();
  return new;
end
$$;
create trigger check_answer before insert or update on public.answers
  for each row execute function public.check_answer();

-- Keeps the counts of a poll, which everyone may read, while who answered stays in answers (REQ-35, REQ-36).
create function public.count_poll_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select kind from public.surveys where id = coalesce(new.survey_id, old.survey_id)) <> 'poll' then
    return null;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    update public.poll_totals set count = count - 1
    where survey_id = old.survey_id and option_no = (old.value ->> 'q1')::integer;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.poll_totals (survey_id, option_no, count)
    values (new.survey_id, (new.value ->> 'q1')::integer, 1)
    on conflict (survey_id, option_no) do update set count = public.poll_totals.count + 1;
  end if;
  return null;
end
$$;
create trigger count_poll_answer after insert or update or delete on public.answers
  for each row execute function public.count_poll_answer();

revoke insert, update, delete on public.poll_totals from anon, authenticated;
create policy poll_totals_read on public.poll_totals for select to authenticated
  using (public.linked_to_lesson(public.lesson_of_survey(survey_id)));

-- The job that runs every minute also closes every poll whose lesson has ended (REQ-38).
create or replace function public.run_minute_jobs() returns void
language sql security definer set search_path = '' as $$
  delete from public.class_faces
  where lesson_id in (select lesson_id from public.attendance_rounds where expires_at <= now());
  update public.surveys s set status = 'closed'
  from public.lessons l
  where l.id = s.lesson_id and s.kind = 'poll' and s.status = 'open' and l.ends_at <= now();
$$;

alter publication supabase_realtime add table public.surveys, public.poll_totals, public.answers;
