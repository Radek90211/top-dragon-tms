-- Dane wymagane przy dodawaniu przewoźnika i kierowcy.
alter table public.carriers add column if not exists nip text;
alter table public.vehicles add column if not exists model text;
alter table public.vehicles add column if not exists tractor_color text;
alter table public.trailers add column if not exists brand text;

create or replace function public.get_tms_fleet_extra_details()
returns table(assignment_id uuid, carrier_nip text, vehicle_model text, tractor_color text, trailer_brand text)
language sql
security definer
set search_path = public
as $$
  select f.id, c.nip, v.model, v.tractor_color, t.brand
  from public.fleet_assignments f
  join public.carriers c on c.id = f.carrier_id
  join public.vehicles v on v.id = f.vehicle_id
  join public.trailers t on t.id = f.trailer_id
  where f.active
    and exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.active
        and (
          actor.role = 'admin'
          or f.assigned_dispatcher_id = actor.id
          or (actor.role = 'branch_manager' and actor.branch_id = f.branch_id)
        )
    );
$$;

create or replace function public.set_tms_fleet_extra_details(
  p_assignment_id uuid,
  p_carrier_nip text,
  p_vehicle_model text,
  p_tractor_color text,
  p_trailer_brand text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.fleet_assignments%rowtype;
begin
  select * into assignment_row
  from public.fleet_assignments
  where id = p_assignment_id and active;

  if not found then
    raise exception 'Nie znaleziono aktywnego zestawu.';
  end if;

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.active
      and (
        actor.role = 'admin'
        or assignment_row.assigned_dispatcher_id = actor.id
        or (actor.role = 'branch_manager' and actor.branch_id = assignment_row.branch_id)
      )
  ) then
    raise exception 'Brak uprawnień do edycji tego zestawu.';
  end if;

  if p_carrier_nip is not null and p_carrier_nip !~ '^[0-9]{10}$' then
    raise exception 'NIP przewoźnika musi mieć 10 cyfr.';
  end if;

  update public.carriers
  set nip = coalesce(nullif(trim(p_carrier_nip), ''), nip)
  where id = assignment_row.carrier_id;

  update public.vehicles
  set model = coalesce(nullif(trim(p_vehicle_model), ''), model),
      tractor_color = coalesce(nullif(trim(p_tractor_color), ''), tractor_color)
  where id = assignment_row.vehicle_id;

  update public.trailers
  set brand = coalesce(nullif(trim(p_trailer_brand), ''), brand)
  where id = assignment_row.trailer_id;
end;
$$;

revoke all on function public.get_tms_fleet_extra_details() from public;
grant execute on function public.get_tms_fleet_extra_details() to authenticated;
revoke all on function public.set_tms_fleet_extra_details(uuid, text, text, text, text) from public;
grant execute on function public.set_tms_fleet_extra_details(uuid, text, text, text, text) to authenticated;
