-- Top Dragon TMS — Etap 3L.50
-- Status rozliczenia tygodnia per kierowca. Status może zmieniać księgowość lub administrator.
-- Słownik statusów jest zgodny z istniejącymi statusami księgowymi relacji.

begin;

create table if not exists public.tms_driver_week_settlement_statuses (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  driver_name text not null default '',
  status text not null default 'Nowe',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint tms_driver_week_settlement_statuses_status_check
    check (status in ('Nowe','Niezgodności','Krytyczne','Wprowadzone')),
  constraint tms_driver_week_settlement_statuses_week_driver_unique
    unique (week_start, driver_id)
);

create index if not exists tms_driver_week_settlement_statuses_week_idx
  on public.tms_driver_week_settlement_statuses(week_start, status);

alter table public.tms_driver_week_settlement_statuses enable row level security;

drop policy if exists tms_driver_week_settlement_statuses_select_authenticated
  on public.tms_driver_week_settlement_statuses;
create policy tms_driver_week_settlement_statuses_select_authenticated
on public.tms_driver_week_settlement_statuses
for select
to authenticated
using (true);

revoke insert, update, delete on public.tms_driver_week_settlement_statuses from authenticated;
grant select on public.tms_driver_week_settlement_statuses to authenticated;

create or replace function public.set_tms_driver_week_settlement_status(
  p_week_start date,
  p_driver_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_week_start date;
  v_status text := trim(coalesce(p_status, ''));
  v_driver public.drivers%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_role not in ('accounting','admin') then
    raise exception 'Status rozliczenia tygodnia może zmieniać wyłącznie księgowość lub administrator.';
  end if;
  if p_week_start is null or p_driver_id is null then
    raise exception 'Brak tygodnia lub kierowcy.';
  end if;
  if v_status not in ('Nowe','Niezgodności','Krytyczne','Wprowadzone') then
    raise exception 'Nieprawidłowy status rozliczenia tygodnia.';
  end if;

  select * into v_driver from public.drivers where id = p_driver_id;
  if not found then raise exception 'Nie znaleziono kierowcy.'; end if;

  v_week_start := p_week_start - ((extract(isodow from p_week_start)::integer) - 1);

  insert into public.tms_driver_week_settlement_statuses(
    week_start, driver_id, driver_name, status, updated_by, updated_at
  ) values (
    v_week_start, v_driver.id, coalesce(v_driver.full_name, ''), v_status, auth.uid(), now()
  )
  on conflict (week_start, driver_id) do update
    set driver_name = excluded.driver_name,
        status = excluded.status,
        updated_by = auth.uid(),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.set_tms_driver_week_settlement_status(date,uuid,text) from public, anon;
grant execute on function public.set_tms_driver_week_settlement_status(date,uuid,text) to authenticated;

-- Realtime: zmiana statusu wykonana przez księgowość ma być od razu widoczna
-- u pozostałych zalogowanych użytkowników, tak jak wyrównania i transfery.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tms_driver_week_settlement_statuses'
  ) then
    alter publication supabase_realtime add table public.tms_driver_week_settlement_statuses;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
