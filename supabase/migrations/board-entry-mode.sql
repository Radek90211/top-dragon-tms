-- Uruchom raz w Supabase SQL Editor. Wybór obowiązuje całą firmę.
begin;
create table if not exists public.tms_board_preferences (
  id text primary key check (id = 'global'),
  entry_mode text not null default 'excel' check (entry_mode in ('excel', 'classic'))
);
alter table public.tms_board_preferences enable row level security;
revoke all on public.tms_board_preferences from anon, authenticated;
grant select, update on public.tms_board_preferences to authenticated;
drop policy if exists board_preferences_read on public.tms_board_preferences;
create policy board_preferences_read on public.tms_board_preferences for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and active = true));
drop policy if exists board_preferences_admin on public.tms_board_preferences;
create policy board_preferences_admin on public.tms_board_preferences for update to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and active = true and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and active = true and role = 'admin'));
insert into public.tms_board_preferences(id, entry_mode) values ('global', 'excel') on conflict (id) do nothing;
commit;
