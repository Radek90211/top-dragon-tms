-- Top Dragon TMS — Etap 3L.16
-- Ukrywanie nieaktywnych zestawów przez spedytora bez niszczenia historii floty.
-- Ukryty zestaw pozostaje w Supabase i może zostać ponownie pokazany.

begin;

alter table public.fleet_assignments
  add column if not exists hidden boolean not null default false;

create or replace function public.set_fleet_assignment_hidden(
  p_assignment_id uuid,
  p_hidden boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_assignment public.fleet_assignments%rowtype;
  v_hidden boolean := coalesce(p_hidden, false);
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do zmiany widoczności floty.';
  end if;

  select *
  into v_assignment
  from public.fleet_assignments
  where id = p_assignment_id;

  if not found then
    raise exception 'Nie znaleziono zestawu.';
  end if;

  if v_role = 'dispatcher' then
    if v_assignment.branch_id is distinct from private.tms_branch_id()
       or v_assignment.assigned_dispatcher_id is distinct from auth.uid() then
      raise exception 'Spedytor może ukrywać wyłącznie własne przypisane pojazdy.';
    end if;
  elsif v_role = 'branch_manager' then
    if v_assignment.branch_id is distinct from private.tms_branch_id() then
      raise exception 'Kierownik może zmieniać widoczność tylko floty swojego oddziału.';
    end if;
  end if;

  update public.fleet_assignments
  set hidden = v_hidden
  where id = v_assignment.id;

  return jsonb_build_object(
    'updated', true,
    'assignment_id', v_assignment.id,
    'hidden', v_hidden
  );
end;
$$;

revoke all on function public.set_fleet_assignment_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_fleet_assignment_hidden(uuid, boolean) to authenticated;

commit;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'set_fleet_assignment_hidden';
