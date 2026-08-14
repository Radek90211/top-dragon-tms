-- Top Dragon TMS — Etap 3E
-- Centralna flota w Supabase + atomowe dodawanie/usuwanie zestawów.
-- Nie dodaje żadnych danych demonstracyjnych.

begin;

alter table public.drivers
  add column if not exists nationality text,
  add column if not exists base_location text;

alter table public.trailers
  add column if not exists height_m numeric(4,2);

-- Walidacja wysokości naczepy, jeśli podano wartość.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trailers_height_m_check'
      and conrelid = 'public.trailers'::regclass
  ) then
    alter table public.trailers
      add constraint trailers_height_m_check
      check (height_m is null or (height_m >= 1 and height_m <= 4.3));
  end if;
end
$$;

create or replace function public.create_fleet_set(
  p_carrier_name text,
  p_driver_name text,
  p_assigned_dispatcher_id uuid,
  p_branch_id uuid default null,
  p_phone text default null,
  p_identity_document_number text default null,
  p_vehicle_registration_no text default null,
  p_vehicle_brand text default null,
  p_trailer_registration_no text default null,
  p_trailer_height_m numeric default null,
  p_nationality text default null,
  p_base_location text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_dispatcher_id uuid;
  v_carrier_id uuid;
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_trailer_id uuid;
  v_assignment_id uuid;
  v_carrier_name text := trim(coalesce(p_carrier_name, ''));
  v_driver_name text := trim(coalesce(p_driver_name, ''));
  v_vehicle_reg text := upper(trim(coalesce(p_vehicle_registration_no, '')));
  v_trailer_reg text := upper(trim(coalesce(p_trailer_registration_no, '')));
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do dodawania floty.';
  end if;

  if v_carrier_name = '' or v_driver_name = '' then
    raise exception 'Podaj przewoźnika oraz imię i nazwisko kierowcy.';
  end if;

  if v_role = 'dispatcher' then
    v_branch_id := private.tms_branch_id();
    v_dispatcher_id := auth.uid();
  elsif v_role = 'branch_manager' then
    v_branch_id := private.tms_branch_id();
    v_dispatcher_id := p_assigned_dispatcher_id;
  else
    v_branch_id := p_branch_id;
    v_dispatcher_id := p_assigned_dispatcher_id;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału.';
  end if;

  if v_dispatcher_id is null then
    raise exception 'Wybierz spedytora.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_dispatcher_id
      and p.active = true
      and p.role::text = 'dispatcher'
      and p.branch_id = v_branch_id
  ) then
    raise exception 'Wybrany spedytor nie jest aktywnym spedytorem tego oddziału.';
  end if;

  select c.id
  into v_carrier_id
  from public.carriers c
  where c.branch_id = v_branch_id
    and lower(trim(c.name)) = lower(v_carrier_name)
    and c.active = true
  limit 1;

  if v_carrier_id is null then
    begin
      insert into public.carriers(name, branch_id, active, created_by)
      values (v_carrier_name, v_branch_id, true, auth.uid())
      returning id into v_carrier_id;
    exception when unique_violation then
      select c.id
      into v_carrier_id
      from public.carriers c
      where c.branch_id = v_branch_id
        and lower(trim(c.name)) = lower(v_carrier_name)
      limit 1;
    end;
  end if;

  if exists (
    select 1
    from public.drivers d
    where d.branch_id = v_branch_id
      and d.carrier_id = v_carrier_id
      and lower(trim(d.full_name)) = lower(v_driver_name)
      and d.active = true
  ) then
    raise exception 'Kierowca o tej nazwie jest już zapisany dla tego przewoźnika.';
  end if;

  if v_vehicle_reg <> '' and exists (
    select 1 from public.vehicles v
    where v.branch_id = v_branch_id
      and upper(trim(v.registration_no)) = v_vehicle_reg
      and v.active = true
  ) then
    raise exception 'Pojazd o tym numerze rejestracyjnym już istnieje.';
  end if;

  if v_trailer_reg <> '' and exists (
    select 1 from public.trailers t
    where t.branch_id = v_branch_id
      and upper(trim(t.registration_no)) = v_trailer_reg
      and t.active = true
  ) then
    raise exception 'Naczepa o tym numerze rejestracyjnym już istnieje.';
  end if;

  if v_vehicle_reg <> '' and trim(coalesce(p_vehicle_brand, '')) = '' then
    raise exception 'Podaj markę pojazdu.';
  end if;

  insert into public.drivers(
    full_name,
    phone,
    identity_document_number,
    nationality,
    base_location,
    carrier_id,
    branch_id,
    assigned_dispatcher_id,
    active,
    created_by
  )
  values (
    v_driver_name,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_identity_document_number, '')), ''),
    nullif(upper(trim(coalesce(p_nationality, ''))), ''),
    nullif(trim(coalesce(p_base_location, '')), ''),
    v_carrier_id,
    v_branch_id,
    v_dispatcher_id,
    true,
    auth.uid()
  )
  returning id into v_driver_id;

  if v_vehicle_reg <> '' then
    insert into public.vehicles(
      registration_no,
      brand,
      carrier_id,
      branch_id,
      assigned_dispatcher_id,
      active,
      created_by
    )
    values (
      v_vehicle_reg,
      nullif(trim(coalesce(p_vehicle_brand, '')), ''),
      v_carrier_id,
      v_branch_id,
      v_dispatcher_id,
      true,
      auth.uid()
    )
    returning id into v_vehicle_id;
  end if;

  if v_trailer_reg <> '' then
    insert into public.trailers(
      registration_no,
      height_m,
      carrier_id,
      branch_id,
      assigned_dispatcher_id,
      active,
      created_by
    )
    values (
      v_trailer_reg,
      case when p_trailer_height_m is null then null else greatest(1, least(4.3, p_trailer_height_m)) end,
      v_carrier_id,
      v_branch_id,
      v_dispatcher_id,
      true,
      auth.uid()
    )
    returning id into v_trailer_id;
  end if;

  insert into public.fleet_assignments(
    driver_id,
    vehicle_id,
    trailer_id,
    carrier_id,
    branch_id,
    assigned_dispatcher_id,
    active,
    created_by
  )
  values (
    v_driver_id,
    v_vehicle_id,
    v_trailer_id,
    v_carrier_id,
    v_branch_id,
    v_dispatcher_id,
    true,
    auth.uid()
  )
  returning id into v_assignment_id;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'driver_id', v_driver_id,
    'vehicle_id', v_vehicle_id,
    'trailer_id', v_trailer_id,
    'carrier_id', v_carrier_id,
    'branch_id', v_branch_id,
    'assigned_dispatcher_id', v_dispatcher_id
  );
end;
$$;

revoke all on function public.create_fleet_set(
  text, text, uuid, uuid, text, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.create_fleet_set(
  text, text, uuid, uuid, text, text, text, text, text, numeric, text, text
) to authenticated;

create or replace function public.delete_fleet_set(p_assignment_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment public.fleet_assignments%rowtype;
  v_deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  select *
  into v_assignment
  from public.fleet_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'Nie znaleziono zestawu albo nie masz do niego dostępu.';
  end if;

  if exists (
    select 1
    from public.fleet_relation_usage u
    where u.fleet_assignment_id = v_assignment.id
       or u.driver_id = v_assignment.driver_id
       or (v_assignment.vehicle_id is not null and u.vehicle_id = v_assignment.vehicle_id)
       or (v_assignment.trailer_id is not null and u.trailer_id = v_assignment.trailer_id)
  ) then
    raise exception 'Usuwanie zablokowane: kierowca lub pojazd występuje w historii relacji.';
  end if;

  delete from public.fleet_assignments
  where id = v_assignment.id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Brak uprawnień do usunięcia tego zestawu.';
  end if;

  if v_assignment.trailer_id is not null then
    delete from public.trailers where id = v_assignment.trailer_id;
  end if;

  if v_assignment.vehicle_id is not null then
    delete from public.vehicles where id = v_assignment.vehicle_id;
  end if;

  delete from public.drivers where id = v_assignment.driver_id;

  return jsonb_build_object('deleted', true, 'assignment_id', v_assignment.id);
end;
$$;

revoke all on function public.delete_fleet_set(uuid) from public, anon;
grant execute on function public.delete_fleet_set(uuid) to authenticated;

commit;

-- Kontrola etapu 3E.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('create_fleet_set', 'delete_fleet_set')
order by routine_name;
