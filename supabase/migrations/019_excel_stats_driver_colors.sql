-- Top Dragon TMS — Etap 3L.17
-- 1) prywatne kolory wierszy kierowców (widoczne tylko dla zalogowanego spedytora),
-- 2) bezpieczny zbiorczy import floty z arkusza Excel bez kasowania historii.

begin;

create table if not exists public.driver_row_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  color text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_id),
  constraint driver_row_preferences_color_check
    check (color in ('yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'gray'))
);

alter table public.driver_row_preferences enable row level security;

drop policy if exists driver_row_preferences_select_own on public.driver_row_preferences;
create policy driver_row_preferences_select_own
on public.driver_row_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and private.tms_role() = 'dispatcher'
  and exists (
    select 1
    from public.fleet_assignments fa
    where fa.driver_id = driver_row_preferences.driver_id
      and fa.assigned_dispatcher_id = auth.uid()
      and fa.active = true
  )
);

drop policy if exists driver_row_preferences_insert_own on public.driver_row_preferences;
create policy driver_row_preferences_insert_own
on public.driver_row_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.tms_role() = 'dispatcher'
  and exists (
    select 1
    from public.fleet_assignments fa
    where fa.driver_id = driver_row_preferences.driver_id
      and fa.assigned_dispatcher_id = auth.uid()
      and fa.active = true
  )
);

drop policy if exists driver_row_preferences_update_own on public.driver_row_preferences;
create policy driver_row_preferences_update_own
on public.driver_row_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and private.tms_role() = 'dispatcher'
  and exists (
    select 1
    from public.fleet_assignments fa
    where fa.driver_id = driver_row_preferences.driver_id
      and fa.assigned_dispatcher_id = auth.uid()
      and fa.active = true
  )
)
with check (
  user_id = auth.uid()
  and private.tms_role() = 'dispatcher'
  and exists (
    select 1
    from public.fleet_assignments fa
    where fa.driver_id = driver_row_preferences.driver_id
      and fa.assigned_dispatcher_id = auth.uid()
      and fa.active = true
  )
);

drop policy if exists driver_row_preferences_delete_own on public.driver_row_preferences;
create policy driver_row_preferences_delete_own
on public.driver_row_preferences
for delete
to authenticated
using (
  user_id = auth.uid()
  and private.tms_role() = 'dispatcher'
  and exists (
    select 1
    from public.fleet_assignments fa
    where fa.driver_id = driver_row_preferences.driver_id
      and fa.assigned_dispatcher_id = auth.uid()
      and fa.active = true
  )
);

grant select, insert, update, delete on public.driver_row_preferences to authenticated;

create or replace function public.import_fleet_rows_excel(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_item jsonb;
  v_row_no integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;

  v_branch_id uuid;
  v_dispatcher_id uuid;
  v_assignment_id uuid;
  v_assignment public.fleet_assignments%rowtype;
  v_carrier_id uuid;
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_trailer_id uuid;

  v_carrier_name text;
  v_driver_name text;
  v_phone text;
  v_vehicle_reg text;
  v_vehicle_brand text;
  v_trailer_reg text;
  v_nationality text;
  v_base_location text;
  v_trailer_height numeric;
  v_hidden boolean;
  v_uuid_text text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do importu floty.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Nieprawidłowy format danych floty.';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_row_no := v_row_no + 1;
    begin
      v_carrier_name := trim(coalesce(v_item ->> 'carrierName', ''));
      v_driver_name := trim(coalesce(v_item ->> 'driverName', ''));
      v_phone := nullif(trim(coalesce(v_item ->> 'phone', '')), '');
      v_vehicle_reg := upper(trim(coalesce(v_item ->> 'vehicleRegistrationNo', '')));
      v_vehicle_brand := trim(coalesce(v_item ->> 'vehicleBrand', ''));
      v_trailer_reg := upper(trim(coalesce(v_item ->> 'trailerRegistrationNo', '')));
      v_nationality := upper(trim(coalesce(v_item ->> 'nationality', 'PL')));
      v_base_location := nullif(trim(coalesce(v_item ->> 'baseLocation', '')), '');
      v_hidden := lower(trim(coalesce(v_item ->> 'hidden', 'false'))) in ('true', '1', 'tak', 'yes', 'x');

      begin
        v_trailer_height := nullif(replace(trim(coalesce(v_item ->> 'trailerHeightM', '')), ',', '.'), '')::numeric;
      exception when others then
        v_trailer_height := null;
      end;
      if v_trailer_height is not null then
        v_trailer_height := greatest(1, least(4.3, v_trailer_height));
      end if;

      if v_carrier_name = '' or v_driver_name = '' then
        raise exception 'Podaj przewoźnika oraz imię i nazwisko kierowcy.';
      end if;
      if v_vehicle_reg <> '' and v_vehicle_brand = '' then
        raise exception 'Dla pojazdu % podaj markę.', v_vehicle_reg;
      end if;

      if v_role = 'dispatcher' then
        v_branch_id := private.tms_branch_id();
        v_dispatcher_id := auth.uid();
      else
        v_uuid_text := trim(coalesce(v_item ->> 'branchId', ''));
        if v_role = 'branch_manager' then
          v_branch_id := private.tms_branch_id();
        elsif v_uuid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          v_branch_id := v_uuid_text::uuid;
        else
          v_branch_id := null;
        end if;

        v_uuid_text := trim(coalesce(v_item ->> 'assignedDispatcherId', ''));
        if v_uuid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          v_dispatcher_id := v_uuid_text::uuid;
        else
          v_dispatcher_id := null;
        end if;
      end if;

      if v_branch_id is null then
        raise exception 'Nie udało się ustalić oddziału.';
      end if;
      if v_dispatcher_id is null then
        raise exception 'Nie udało się ustalić spedytora.';
      end if;

      if not exists (
        select 1
        from public.profiles p
        where p.id = v_dispatcher_id
          and p.active = true
          and p.role::text = 'dispatcher'
          and p.branch_id = v_branch_id
      ) then
        raise exception 'Wybrany spedytor nie jest aktywnym spedytorem wskazanego oddziału.';
      end if;

      select c.id
      into v_carrier_id
      from public.carriers c
      where c.branch_id = v_branch_id
        and lower(trim(c.name)) = lower(v_carrier_name)
        and c.active = true
      limit 1;

      if v_carrier_id is null then
        insert into public.carriers(name, branch_id, active, created_by)
        values (v_carrier_name, v_branch_id, true, auth.uid())
        returning id into v_carrier_id;
      end if;

      v_assignment_id := null;
      v_uuid_text := trim(coalesce(v_item ->> 'assignmentId', ''));
      if v_uuid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        v_assignment_id := v_uuid_text::uuid;
      end if;

      if v_assignment_id is not null then
        select * into v_assignment
        from public.fleet_assignments fa
        where fa.id = v_assignment_id
          and fa.active = true;
        if not found then v_assignment_id := null; end if;
      end if;

      if v_assignment_id is null and v_vehicle_reg <> '' then
        select fa.id into v_assignment_id
        from public.fleet_assignments fa
        join public.vehicles ve on ve.id = fa.vehicle_id
        where fa.active = true
          and ve.active = true
          and fa.branch_id = v_branch_id
          and upper(trim(ve.registration_no)) = v_vehicle_reg
        limit 1;
        if v_assignment_id is not null then
          select * into v_assignment from public.fleet_assignments where id = v_assignment_id;
        end if;
      end if;

      if v_assignment_id is null then
        select fa.id into v_assignment_id
        from public.fleet_assignments fa
        join public.drivers d on d.id = fa.driver_id
        join public.carriers c on c.id = fa.carrier_id
        where fa.active = true
          and d.active = true
          and fa.branch_id = v_branch_id
          and lower(trim(d.full_name)) = lower(v_driver_name)
          and lower(trim(c.name)) = lower(v_carrier_name)
        limit 1;
        if v_assignment_id is not null then
          select * into v_assignment from public.fleet_assignments where id = v_assignment_id;
        end if;
      end if;

      if v_assignment_id is not null then
        if v_assignment.branch_id is distinct from v_branch_id then
          raise exception 'Istniejący zestaw należy do innego oddziału.';
        end if;
        if v_role = 'dispatcher' and v_assignment.assigned_dispatcher_id is distinct from auth.uid() then
          raise exception 'Spedytor może aktualizować tylko własne zestawy.';
        end if;
        if v_role = 'branch_manager' and v_assignment.branch_id is distinct from private.tms_branch_id() then
          raise exception 'Kierownik może aktualizować tylko flotę swojego oddziału.';
        end if;

        v_driver_id := v_assignment.driver_id;
        v_vehicle_id := v_assignment.vehicle_id;
        v_trailer_id := v_assignment.trailer_id;

        update public.drivers
        set full_name = v_driver_name,
            phone = v_phone,
            nationality = nullif(v_nationality, ''),
            base_location = v_base_location,
            carrier_id = v_carrier_id,
            assigned_dispatcher_id = v_dispatcher_id,
            active = true
        where id = v_driver_id;

        if v_vehicle_id is not null then
          update public.vehicles
          set registration_no = case when v_vehicle_reg = '' then registration_no else v_vehicle_reg end,
              brand = case when v_vehicle_brand = '' then brand else v_vehicle_brand end,
              carrier_id = v_carrier_id,
              assigned_dispatcher_id = v_dispatcher_id,
              active = true
          where id = v_vehicle_id;
        elsif v_vehicle_reg <> '' then
          insert into public.vehicles(registration_no, brand, carrier_id, branch_id, assigned_dispatcher_id, active, created_by)
          values (v_vehicle_reg, v_vehicle_brand, v_carrier_id, v_branch_id, v_dispatcher_id, true, auth.uid())
          returning id into v_vehicle_id;
        end if;

        if v_trailer_id is not null then
          update public.trailers
          set registration_no = case when v_trailer_reg = '' then registration_no else v_trailer_reg end,
              height_m = coalesce(v_trailer_height, height_m),
              carrier_id = v_carrier_id,
              assigned_dispatcher_id = v_dispatcher_id,
              active = true
          where id = v_trailer_id;
        elsif v_trailer_reg <> '' then
          insert into public.trailers(registration_no, height_m, carrier_id, branch_id, assigned_dispatcher_id, active, created_by)
          values (v_trailer_reg, v_trailer_height, v_carrier_id, v_branch_id, v_dispatcher_id, true, auth.uid())
          returning id into v_trailer_id;
        end if;

        update public.fleet_assignments
        set carrier_id = v_carrier_id,
            assigned_dispatcher_id = v_dispatcher_id,
            vehicle_id = v_vehicle_id,
            trailer_id = v_trailer_id,
            hidden = v_hidden,
            active = true
        where id = v_assignment_id;

        v_updated := v_updated + 1;
      else
        insert into public.drivers(
          full_name, phone, nationality, base_location, carrier_id, branch_id,
          assigned_dispatcher_id, active, created_by
        ) values (
          v_driver_name, v_phone, nullif(v_nationality, ''), v_base_location, v_carrier_id, v_branch_id,
          v_dispatcher_id, true, auth.uid()
        ) returning id into v_driver_id;

        v_vehicle_id := null;
        if v_vehicle_reg <> '' then
          insert into public.vehicles(registration_no, brand, carrier_id, branch_id, assigned_dispatcher_id, active, created_by)
          values (v_vehicle_reg, v_vehicle_brand, v_carrier_id, v_branch_id, v_dispatcher_id, true, auth.uid())
          returning id into v_vehicle_id;
        end if;

        v_trailer_id := null;
        if v_trailer_reg <> '' then
          insert into public.trailers(registration_no, height_m, carrier_id, branch_id, assigned_dispatcher_id, active, created_by)
          values (v_trailer_reg, v_trailer_height, v_carrier_id, v_branch_id, v_dispatcher_id, true, auth.uid())
          returning id into v_trailer_id;
        end if;

        insert into public.fleet_assignments(
          driver_id, vehicle_id, trailer_id, carrier_id, branch_id,
          assigned_dispatcher_id, active, hidden, created_by
        ) values (
          v_driver_id, v_vehicle_id, v_trailer_id, v_carrier_id, v_branch_id,
          v_dispatcher_id, true, v_hidden, auth.uid()
        );

        v_created := v_created + 1;
      end if;
    exception when others then
      v_skipped := v_skipped + 1;
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_no,
          'message', sqlerrm
        ));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'errors', v_errors
  );
end;
$$;

revoke all on function public.import_fleet_rows_excel(jsonb) from public, anon;
grant execute on function public.import_fleet_rows_excel(jsonb) to authenticated;

commit;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'import_fleet_rows_excel';
