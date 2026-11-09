-- Removes what setup.sql created. Run it after the spike.
alter publication supabase_realtime drop table public.spike_messages;
drop table public.spike_messages;
