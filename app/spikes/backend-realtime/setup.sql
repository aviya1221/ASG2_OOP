-- Spike only: the table that measures how fast new rows reach connected clients.
-- Paste into the Supabase SQL Editor once, and run it.
create table if not exists public.spike_messages (
  id bigint generated always as identity primary key,
  sent_at_ms bigint not null,
  body text not null
);
alter table public.spike_messages enable row level security;
grant select, insert on public.spike_messages to anon;
drop policy if exists "spike read" on public.spike_messages;
create policy "spike read" on public.spike_messages for select to anon using (true);
drop policy if exists "spike insert" on public.spike_messages;
create policy "spike insert" on public.spike_messages for insert to anon with check (true);
alter publication supabase_realtime add table public.spike_messages;
