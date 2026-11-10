-- Lesson summaries (docs/07-EDD/lesson-summary.md, section 3).
-- The server writes the status and the summary. The teacher may change only the four parts.

create type public.summary_status as enum ('in_progress', 'ready', 'failed');

create table public.lesson_summaries (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  status public.summary_status not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  overview text,
  topics jsonb,
  questions jsonb,
  board jsonb
);

alter table public.lesson_summaries enable row level security;

revoke insert, update, delete on public.lesson_summaries from anon, authenticated;
grant update (overview, topics, questions, board) on public.lesson_summaries to authenticated;

create policy lesson_summaries_read on public.lesson_summaries for select to authenticated
  using (public.linked_to_lesson(lesson_id));
create policy lesson_summaries_edit on public.lesson_summaries for update to authenticated
  using (public.teaches_lesson(lesson_id) and status = 'ready')
  with check (public.teaches_lesson(lesson_id));

alter publication supabase_realtime add table public.lesson_summaries;
