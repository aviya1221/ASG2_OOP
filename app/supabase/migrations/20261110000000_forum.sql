-- Forum (docs/07-EDD/forum.md, section 3). Only two functions write messages.

create table public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  reply_to uuid references public.forum_messages (id) on delete set null,
  text text not null,
  -- Empty when the writer hid the name from the class.
  writer_name text,
  writer_is_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index forum_messages_lesson on public.forum_messages (lesson_id, created_at);

-- Kept apart from the message, because access rules work on whole rows.
create table public.message_writers (
  message_id uuid primary key references public.forum_messages (id) on delete cascade,
  writer_id text not null references public.people (id_number) on delete cascade
);

alter table public.forum_messages enable row level security;
alter table public.message_writers enable row level security;

revoke insert, update, delete on public.forum_messages from anon, authenticated;
revoke insert, update, delete on public.message_writers from anon, authenticated;

create policy forum_messages_read on public.forum_messages for select to authenticated
  using (public.linked_to_lesson(lesson_id));

create function public.lesson_of_message(message uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select lesson_id from public.forum_messages where id = message
$$;

create policy message_writers_read on public.message_writers for select to authenticated
  using (writer_id = (select public.my_id_number()) or public.teaches_lesson(public.lesson_of_message(message_id)));

-- Saves a message and its writer in one step (REQ-25, REQ-26, REQ-27).
create function public.post_message(p_lesson uuid, p_text text, p_reply_to uuid, p_show_name boolean)
returns public.forum_messages
language plpgsql security definer set search_path = '' as $$
declare
  v_writer text := public.my_id_number();
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
    select name into v_name from public.people where id_number = v_writer;
  end if;

  insert into public.forum_messages (lesson_id, reply_to, text, writer_name, writer_is_teacher)
  values (p_lesson, p_reply_to, trim(p_text), v_name, v_teacher)
  returning * into v_message;
  insert into public.message_writers (message_id, writer_id) values (v_message.id, v_writer);
  return v_message;
end
$$;

-- Empties a message. The row stays, so replies keep their place (REQ-29).
create function public.remove_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.teaches_lesson(public.lesson_of_message(p_message)) then
    raise exception 'not_the_teacher' using errcode = '42501';
  end if;
  update public.forum_messages set text = '', writer_name = null, deleted_at = now() where id = p_message;
  delete from public.message_writers where message_id = p_message;
end
$$;

revoke execute on function public.post_message(uuid, text, uuid, boolean) from public, anon;
revoke execute on function public.remove_message(uuid) from public, anon;
grant execute on function public.post_message(uuid, text, uuid, boolean) to authenticated;
grant execute on function public.remove_message(uuid) to authenticated;

-- The teacher of the course enters the lecture topic (REQ-22). Nothing else of a lesson changes from the page.
revoke update on public.lessons from anon, authenticated;
grant update (topic) on public.lessons to authenticated;
create policy lessons_topic on public.lessons for update to authenticated
  using (public.teaches_course(course_id)) with check (public.teaches_course(course_id));

alter publication supabase_realtime add table public.forum_messages, public.lessons;
