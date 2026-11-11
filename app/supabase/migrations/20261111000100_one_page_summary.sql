-- A one-page summary, shown to the class only after the teacher publishes it
-- (docs/features/F4-lesson-summary-strategy.md, REQ-45 and REQ-73).
-- The four parts become one Markdown text, and a new summary starts hidden from the students.

alter table public.lesson_summaries
  add column body text,
  add column published boolean not null default false;

-- An earlier summary keeps its overview as its text.
update public.lesson_summaries set body = overview where overview is not null;

alter table public.lesson_summaries
  drop column overview,
  drop column topics,
  drop column questions,
  drop column board;

-- The teacher may change only the text and whether the class sees it.
grant update (body, published) on public.lesson_summaries to authenticated;

-- The teacher of the lesson always reads the summary; everyone else linked to the lesson only after it is published.
drop policy lesson_summaries_read on public.lesson_summaries;
create policy lesson_summaries_read on public.lesson_summaries for select to authenticated
  using (public.teaches_lesson(lesson_id) or (published and public.linked_to_lesson(lesson_id)));
