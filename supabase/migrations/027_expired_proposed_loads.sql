-- 3L.44 — automatyczne wygaszanie przeterminowanych Wolnych ładunków
-- + historia/statystyka autorów wygaszonych wpisów.

alter table public.tms_load_queue
  add column if not exists archive_reason text,
  add column if not exists archived_at timestamptz;

create index if not exists tms_load_queue_archive_reason_idx
  on public.tms_load_queue(queue_type, active, archive_reason, archived_at desc);

create or replace function public.archive_expired_tms_proposed_loads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher', 'accounting') then
    raise exception 'Brak uprawnień do porządkowania wolnych ładunków.';
  end if;

  update public.tms_load_queue q
     set active = false,
         archive_reason = 'expired',
         archived_at = now(),
         updated_at = now()
   where q.active = true
     and q.queue_type = 'proposed'
     and lower(coalesce(q.payload ->> 'status', 'available')) <> 'taken'
     and coalesce(q.payload ->> 'loadDate', q.payload ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (
       (coalesce(q.payload ->> 'loadDate', q.payload ->> 'date'))::date::timestamp
       + make_interval(
           secs => round(
             3600 * case
               when coalesce(q.payload ->> 'startHour', '') ~ '^\d+(\.\d+)?$'
                 then greatest(0, least(24, (q.payload ->> 'startHour')::numeric))
               else 8
             end
           )::integer
         )
     ) < (now() at time zone 'Europe/Warsaw');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.archive_expired_tms_proposed_loads() from public, anon;
grant execute on function public.archive_expired_tms_proposed_loads() to authenticated;

create or replace function public.tms_expired_proposed_load_stats()
returns table (
  creator text,
  expired_count bigint,
  latest_expired_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select
    coalesce(nullif(trim(q.payload ->> 'createdBy'), ''), 'Nieznany użytkownik') as creator,
    count(*)::bigint as expired_count,
    max(q.archived_at) as latest_expired_at
  from public.tms_load_queue q
  where q.queue_type = 'proposed'
    and q.active = false
    and q.archive_reason = 'expired'
  group by 1
  order by count(*) desc, creator asc;
$$;

revoke all on function public.tms_expired_proposed_load_stats() from public, anon;
grant execute on function public.tms_expired_proposed_load_stats() to authenticated;

-- Ręczna archiwizacja od tej wersji zostawia czytelny ślad inny niż automatyczne wygaśnięcie.
create or replace function public.archive_tms_load_queue(
  p_branch_id uuid,
  p_queue_type text,
  p_load_ref text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_queue_type text := lower(trim(coalesce(p_queue_type, '')));
  v_load_ref text := trim(coalesce(p_load_ref, ''));
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then raise exception 'Brak uprawnień do archiwizacji ładunku.'; end if;
  if v_queue_type not in ('future', 'proposed') or v_load_ref = '' then raise exception 'Brak prawidłowego identyfikatora wpisu.'; end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then raise exception 'Wpis należy do innego oddziału.'; end if;
  end if;
  if v_branch_id is null then raise exception 'Nie udało się ustalić oddziału wpisu.'; end if;

  update public.tms_load_queue
     set active = false,
         archive_reason = 'manual',
         archived_at = now(),
         updated_by = auth.uid(),
         updated_at = now()
   where branch_id = v_branch_id
     and queue_type = v_queue_type
     and load_ref = v_load_ref
     and active = true
     and (
       v_role in ('admin', 'branch_manager')
       or private.tms_queue_owned_by_current_dispatcher(payload)
     );

  get diagnostics v_count = row_count;
  if v_count = 0 and v_role = 'dispatcher' then raise exception 'Nie możesz usunąć wpisu należącego do innego spedytora.'; end if;
  return v_count > 0;
end;
$$;

revoke all on function public.archive_tms_load_queue(uuid, text, text) from public;
grant execute on function public.archive_tms_load_queue(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
