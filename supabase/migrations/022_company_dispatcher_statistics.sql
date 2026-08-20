-- Top Dragon TMS — Etap 3L.21
-- Wspólne statystyki wszystkich spedytorów bez ujawniania użytkownikom surowych relacji innych oddziałów.
-- SECURITY DEFINER zwraca wyłącznie agregaty; nie rozszerza SELECT na tms_relations.

begin;

create or replace function public.get_tms_dispatcher_statistics(
  p_from date,
  p_to date
)
returns table(
  dispatcher_id uuid,
  dispatcher_name text,
  branch_name text,
  ui_color text,
  relation_count bigint,
  profit numeric,
  carrier_cost numeric,
  loaded_km numeric,
  empty_km numeric,
  total_km numeric,
  empty_percent numeric,
  avg_rate_per_km numeric,
  avg_profit_per_route numeric,
  verification_count bigint,
  profit_per_loaded_km numeric,
  loaded_to_empty_ratio numeric,
  low_rate_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date := least(coalesce(p_from, current_date), coalesce(p_to, p_from, current_date));
  v_to date := greatest(coalesce(p_from, current_date), coalesce(p_to, p_from, current_date));
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.active = true
  ) then
    raise exception 'Konto nie jest aktywne.';
  end if;

  return query
  with dispatchers as (
    select
      p.id,
      p.display_name,
      p.branch_id,
      b.name as branch_name,
      coalesce(nullif(p.ui_color, ''), '#E2E8F0') as ui_color,
      regexp_replace(upper(trim(p.display_name)), '[^A-ZĄĆĘŁŃÓŚŹŻ0-9_-]+', '_', 'g') as login_key
    from public.profiles p
    left join public.branches b on b.id = p.branch_id
    where p.active = true and p.role = 'dispatcher'
  ),
  route_source as (
    select
      r.created_by,
      r.payload,
      case
        when (r.payload ->> 'date') ~ '^\\d{4}-\\d{2}-\\d{2}$' then (r.payload ->> 'date')::date
        else null
      end as start_date,
      case
        when coalesce(r.payload ->> 'endDate', r.payload ->> 'date') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          then coalesce(r.payload ->> 'endDate', r.payload ->> 'date')::date
        else null
      end as finish_date,
      regexp_replace(upper(trim(coalesce(r.payload ->> 'ownerDispatcher', r.payload ->> 'createdBy', ''))), '[^A-ZĄĆĘŁŃÓŚŹŻ0-9_-]+', '_', 'g') as owner_key
    from public.tms_relations r
    where r.active = true
      and coalesce(r.payload ->> 'approvalStatus', '') <> 'rejected'
      and lower(coalesce(r.payload ->> 'futureQueue', 'false')) <> 'true'
      and lower(coalesce(r.payload ->> 'freeDay', 'false')) <> 'true'
  ),
  assigned_routes as (
    select
      coalesce(owner.id, creator.id) as dispatcher_id,
      rs.payload,
      rs.start_date,
      coalesce(rs.finish_date, rs.start_date) as finish_date
    from route_source rs
    left join dispatchers owner on owner.login_key = rs.owner_key and rs.owner_key <> ''
    left join dispatchers creator on creator.id = rs.created_by
    where rs.start_date is not null
      and rs.start_date <= v_to
      and coalesce(rs.finish_date, rs.start_date) >= v_from
      and coalesce(owner.id, creator.id) is not null
  ),
  values_by_route as (
    select
      ar.dispatcher_id,
      greatest(0, case when coalesce(ar.payload ->> 'loadedKm','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(ar.payload ->> 'loadedKm', ',', '.')::numeric else 0 end) as loaded,
      greatest(0, case when coalesce(ar.payload ->> 'approachKm','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(ar.payload ->> 'approachKm', ',', '.')::numeric else 0 end) as approach,
      greatest(0, case when coalesce(ar.payload ->> 'baseKm','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(ar.payload ->> 'baseKm', ',', '.')::numeric else 0 end) as base_km,
      case when coalesce(ar.payload ->> 'rate','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(ar.payload ->> 'rate', ',', '.')::numeric else 0 end as rate,
      greatest(0, case when coalesce(ar.payload ->> 'oversizedCost','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(ar.payload ->> 'oversizedCost', ',', '.')::numeric else 0 end) as oversized_cost,
      lower(coalesce(ar.payload ->> 'accountingCheck', 'false')) = 'true' as accounting_check,
      coalesce(ar.payload ->> 'accountingStatus', '') as accounting_status
    from assigned_routes ar
  ),
  computed as (
    select
      v.*,
      (v.loaded + v.approach + v.base_km) as total_km_value,
      round((v.loaded + v.approach + v.base_km) * 5 + v.oversized_cost) as carrier_cost_value
    from values_by_route v
  ),
  aggregated as (
    select
      c.dispatcher_id,
      count(*)::bigint as relation_count,
      sum(c.rate - c.carrier_cost_value) as profit,
      sum(c.carrier_cost_value) as carrier_cost,
      sum(c.loaded) as loaded_km,
      sum(c.approach) as empty_km,
      sum(c.total_km_value) as total_km,
      sum(c.rate) as income,
      count(*) filter (
        where c.accounting_check
          or c.accounting_status in ('Niezgodności', 'Krytyczne')
      )::bigint as verification_count,
      count(*) filter (
        where c.loaded > 0 and (c.rate / c.loaded) < 5
      )::bigint as low_rate_count
    from computed c
    group by c.dispatcher_id
  )
  select
    d.id,
    d.display_name,
    coalesce(d.branch_name, 'Brak oddziału'),
    d.ui_color,
    coalesce(a.relation_count, 0),
    coalesce(a.profit, 0),
    coalesce(a.carrier_cost, 0),
    coalesce(a.loaded_km, 0),
    coalesce(a.empty_km, 0),
    coalesce(a.total_km, 0),
    case when coalesce(a.loaded_km,0) + coalesce(a.empty_km,0) > 0
      then round((a.empty_km / (a.loaded_km + a.empty_km)) * 100, 1)
      else 0 end,
    case when coalesce(a.loaded_km,0) > 0 then round(a.income / a.loaded_km, 2) else 0 end,
    case when coalesce(a.relation_count,0) > 0 then round(a.profit / a.relation_count, 2) else 0 end,
    coalesce(a.verification_count, 0),
    case when coalesce(a.loaded_km,0) > 0 then round(a.profit / a.loaded_km, 2) else 0 end,
    case when coalesce(a.empty_km,0) > 0 then round(a.loaded_km / a.empty_km, 2)
         when coalesce(a.loaded_km,0) > 0 then 999999
         else 0 end,
    coalesce(a.low_rate_count, 0)
  from dispatchers d
  left join aggregated a on a.dispatcher_id = d.id
  order by d.display_name;
end;
$$;

revoke all on function public.get_tms_dispatcher_statistics(date, date) from public, anon;
grant execute on function public.get_tms_dispatcher_statistics(date, date) to authenticated;

commit;
