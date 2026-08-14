-- Top Dragon TMS — Etap 3F
-- Centralna historia wykorzystania floty w relacjach.
-- Cel: po użyciu kierowcy / pojazdu / naczepy w relacji
-- fizyczne usunięcie zestawu pozostaje zablokowane również na innych komputerach.
-- Skrypt nie dodaje danych demonstracyjnych.

begin;

create unique index if not exists fleet_relation_usage_relation_assignment_uq
  on public.fleet_relation_usage(relation_ref, fleet_assignment_id);

create or replace function public.register_fleet_relation_usage(
  p_relation_ref text,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_assignment public.fleet_assignments%rowtype;
  v_relation_ref text := trim(coalesce(p_relation_ref, ''));
  v_usage_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  if v_relation_ref = '' then
    raise exception 'Brak identyfikatora relacji.';
  end if;

  v_role := private.tms_role();

  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do rejestrowania historii relacji.';
  end if;

  select *
  into v_assignment
  from public.fleet_assignments
  where id = p_assignment_id
    and active = true;

  if not found then
    raise exception 'Nie znaleziono aktywnego zestawu albo nie masz do niego dostępu.';
  end if;

  if v_role = 'dispatcher' then
    if v_assignment.branch_id <> private.tms_branch_id()
       or v_assignment.assigned_dispatcher_id <> auth.uid() then
      raise exception 'Spedytor może rejestrować historię tylko dla swojej floty.';
    end if;
  elsif v_role = 'branch_manager' then
    if v_assignment.branch_id <> private.tms_branch_id() then
      raise exception 'Kierownik może rejestrować historię tylko w swoim oddziale.';
    end if;
  end if;

  insert into public.fleet_relation_usage(
    relation_ref,
    branch_id,
    fleet_assignment_id,
    driver_id,
    vehicle_id,
    trailer_id,
    created_by
  )
  values (
    v_relation_ref,
    v_assignment.branch_id,
    v_assignment.id,
    v_assignment.driver_id,
    v_assignment.vehicle_id,
    v_assignment.trailer_id,
    auth.uid()
  )
  on conflict (relation_ref, fleet_assignment_id)
  do nothing
  returning id into v_usage_id;

  if v_usage_id is null then
    select u.id
    into v_usage_id
    from public.fleet_relation_usage u
    where u.relation_ref = v_relation_ref
      and u.fleet_assignment_id = v_assignment.id
    limit 1;
  end if;

  return jsonb_build_object(
    'registered', true,
    'usage_id', v_usage_id,
    'relation_ref', v_relation_ref,
    'assignment_id', v_assignment.id,
    'driver_id', v_assignment.driver_id,
    'vehicle_id', v_assignment.vehicle_id,
    'trailer_id', v_assignment.trailer_id
  );
end;
$$;

revoke all on function public.register_fleet_relation_usage(text, uuid)
from public, anon;

grant execute on function public.register_fleet_relation_usage(text, uuid)
to authenticated;

commit;

-- Kontrola.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'register_fleet_relation_usage';
