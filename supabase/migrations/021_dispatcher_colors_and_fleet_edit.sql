-- Top Dragon TMS — Etap 3L.20
-- Kolor użytkownika konfigurowany przez administratora + bezpieczna edycja danych własnej floty.
-- Nie usuwa historii i nie tworzy danych demonstracyjnych.

begin;

alter table public.profiles
  add column if not exists ui_color text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_ui_color_hex_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_ui_color_hex_check
      check (ui_color is null or ui_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

-- Istniejący aktywni użytkownicy otrzymują spokojne, rozróżnialne kolory startowe.
-- Administrator może je potem dowolnie zmienić w panelu Administracja.
with ranked as (
  select id, row_number() over (order by created_at, id) as rn
  from public.profiles
  where active = true and ui_color is null
)
update public.profiles p
set ui_color = (array[
  '#D9F99D', '#BAE6FD', '#F5D0FE', '#FECDD3',
  '#E2E8F0', '#86EFAC', '#A5F3FC', '#E9D5FF',
  '#FDE68A', '#BFDBFE', '#C7D2FE', '#FED7AA'
])[(1 + ((r.rn - 1) % 12))::int]
from ranked r
where p.id = r.id
  and p.ui_color is null;

create or replace function public.get_tms_user_directory()
returns table(
  id uuid,
  display_name text,
  role public.app_role,
  branch_id uuid,
  branch_name text,
  active boolean,
  ui_color text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.role,
    p.branch_id,
    b.name,
    p.active,
    p.ui_color
  from public.profiles p
  left join public.branches b on b.id = p.branch_id
  where p.active = true
  order by p.display_name;
end;
$$;

revoke all on function public.get_tms_user_directory() from public, anon;
grant execute on function public.get_tms_user_directory() to authenticated;

create or replace function public.update_fleet_set_details(
  p_assignment_id uuid,
  p_driver_name text default null,
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
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_assignment public.fleet_assignments%rowtype;
  v_driver_name text := trim(coalesce(p_driver_name, ''));
  v_vehicle_reg text := upper(trim(coalesce(p_vehicle_registration_no, '')));
  v_vehicle_brand text := trim(coalesce(p_vehicle_brand, ''));
  v_trailer_reg text := upper(trim(coalesce(p_trailer_registration_no, '')));
  v_vehicle_id uuid;
  v_trailer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  v_branch_id := private.tms_branch_id();

  select *
  into v_assignment
  from public.fleet_assignments
  where id = p_assignment_id
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnego zestawu.';
  end if;

  if v_role = 'dispatcher' then
    if v_assignment.assigned_dispatcher_id is distinct from auth.uid() then
      raise exception 'Możesz edytować wyłącznie własne pojazdy.';
    end if;
  elsif v_role = 'branch_manager' then
    if v_assignment.branch_id is distinct from v_branch_id then
      raise exception 'Możesz edytować wyłącznie flotę swojego oddziału.';
    end if;
  elsif v_role <> 'admin' then
    raise exception 'Brak uprawnień do edycji floty.';
  end if;

  if v_driver_name = '' then
    raise exception 'Imię i nazwisko kierowcy nie może być puste.';
  end if;

  if v_vehicle_reg <> '' and v_vehicle_brand = '' then
    raise exception 'Dla ciągnika z numerem rejestracyjnym podaj markę pojazdu.';
  end if;

  if p_trailer_height_m is not null and (p_trailer_height_m < 1 or p_trailer_height_m > 4.3) then
    raise exception 'Wysokość naczepy musi mieścić się w zakresie 1,00–4,30 m.';
  end if;

  if v_vehicle_reg <> '' and exists (
    select 1
    from public.vehicles v
    where v.branch_id = v_assignment.branch_id
      and v.active = true
      and upper(trim(v.registration_no)) = v_vehicle_reg
      and (v_assignment.vehicle_id is null or v.id <> v_assignment.vehicle_id)
  ) then
    raise exception 'Inny aktywny pojazd ma już ten numer rejestracyjny.';
  end if;

  if v_trailer_reg <> '' and exists (
    select 1
    from public.trailers t
    where t.branch_id = v_assignment.branch_id
      and t.active = true
      and upper(trim(t.registration_no)) = v_trailer_reg
      and (v_assignment.trailer_id is null or t.id <> v_assignment.trailer_id)
  ) then
    raise exception 'Inna aktywna naczepa ma już ten numer rejestracyjny.';
  end if;

  update public.drivers
  set
    full_name = v_driver_name,
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    identity_document_number = nullif(trim(coalesce(p_identity_document_number, '')), ''),
    nationality = nullif(upper(trim(coalesce(p_nationality, ''))), ''),
    base_location = nullif(trim(coalesce(p_base_location, '')), '')
  where id = v_assignment.driver_id;

  v_vehicle_id := v_assignment.vehicle_id;
  if v_vehicle_id is null and v_vehicle_reg <> '' then
    insert into public.vehicles(
      registration_no, brand, carrier_id, branch_id,
      assigned_dispatcher_id, active, created_by
    ) values (
      v_vehicle_reg, nullif(v_vehicle_brand, ''), v_assignment.carrier_id, v_assignment.branch_id,
      v_assignment.assigned_dispatcher_id, true, auth.uid()
    ) returning id into v_vehicle_id;

    update public.fleet_assignments
    set vehicle_id = v_vehicle_id
    where id = v_assignment.id;
  elsif v_vehicle_id is not null then
    update public.vehicles
    set
      registration_no = case when v_vehicle_reg <> '' then v_vehicle_reg else registration_no end,
      brand = case when v_vehicle_brand <> '' then v_vehicle_brand else brand end
    where id = v_vehicle_id;
  end if;

  v_trailer_id := v_assignment.trailer_id;
  if v_trailer_id is null and v_trailer_reg <> '' then
    insert into public.trailers(
      registration_no, height_m, carrier_id, branch_id,
      assigned_dispatcher_id, active, created_by
    ) values (
      v_trailer_reg,
      case when p_trailer_height_m is null then null else greatest(1, least(4.3, p_trailer_height_m)) end,
      v_assignment.carrier_id, v_assignment.branch_id,
      v_assignment.assigned_dispatcher_id, true, auth.uid()
    ) returning id into v_trailer_id;

    update public.fleet_assignments
    set trailer_id = v_trailer_id
    where id = v_assignment.id;
  elsif v_trailer_id is not null then
    update public.trailers
    set
      registration_no = case when v_trailer_reg <> '' then v_trailer_reg else registration_no end,
      height_m = case
        when p_trailer_height_m is null then height_m
        else greatest(1, least(4.3, p_trailer_height_m))
      end
    where id = v_trailer_id;
  end if;

  return jsonb_build_object(
    'updated', true,
    'assignment_id', v_assignment.id,
    'driver_id', v_assignment.driver_id,
    'vehicle_id', v_vehicle_id,
    'trailer_id', v_trailer_id
  );
end;
$$;

revoke all on function public.update_fleet_set_details(
  uuid, text, text, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.update_fleet_set_details(
  uuid, text, text, text, text, text, text, numeric, text, text
) to authenticated;

commit;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_tms_user_directory', 'update_fleet_set_details')
order by routine_name;
