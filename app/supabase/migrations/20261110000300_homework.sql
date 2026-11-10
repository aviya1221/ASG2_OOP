-- Homework review (docs/07-EDD/homework-review.md, section 3).
-- The server writes every row. The review guides hold the expected answers, so the page never reads them.

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  file_path text not null unique,
  created_at timestamptz not null default now()
);

create index homework_lesson on public.homework (lesson_id);

create table public.review_guides (
  homework_id uuid primary key references public.homework (id) on delete cascade,
  questions jsonb not null,
  system_prompt text not null
);

-- One row per check. The solution file itself is never stored (REQ-59).
create table public.homework_checks (
  homework_id uuid not null references public.homework (id) on delete cascade,
  student_id text not null references public.people (id_number),
  check_number smallint not null check (check_number between 1 and 3),
  created_at timestamptz not null default now(),
  section_scores jsonb not null,
  question_scores jsonb not null,
  overall smallint not null check (overall between 1 and 100),
  report jsonb not null,
  primary key (homework_id, student_id, check_number)
);

alter table public.homework enable row level security;
alter table public.review_guides enable row level security;
alter table public.homework_checks enable row level security;

revoke insert, update, delete on public.homework, public.review_guides, public.homework_checks from anon, authenticated;

create policy homework_read on public.homework for select to authenticated
  using (public.linked_to_lesson(lesson_id));
-- review_guides has no policy, so a signed-in user reads no rows of it.
create policy homework_checks_read on public.homework_checks for select to authenticated
  using (student_id = public.my_id_number());

-- The latest check of each student, for the class chart (REQ-57). It holds no report.
create view public.homework_chart as
  select distinct on (c.homework_id, c.student_id)
    c.homework_id,
    p.name,
    c.student_id = public.my_id_number() as is_me,
    c.overall,
    c.question_scores,
    c.section_scores
  from public.homework_checks c
  join public.homework h on h.id = c.homework_id
  join public.people p on p.id_number = c.student_id
  where public.linked_to_lesson(h.lesson_id)
  order by c.homework_id, c.student_id, c.check_number desc;
revoke all on public.homework_chart from anon;
grant select on public.homework_chart to authenticated;

-- The PDF of each homework. Only the server uploads, and everyone linked to the lesson reads it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework', 'homework', false, 20971520, array['application/pdf']);

create function public.linked_to_homework_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.homework h
    where h.file_path = path and public.linked_to_lesson(h.lesson_id)
  )
$$;

create policy homework_files_read on storage.objects for select to authenticated
  using (bucket_id = 'homework' and public.linked_to_homework_file(name));
