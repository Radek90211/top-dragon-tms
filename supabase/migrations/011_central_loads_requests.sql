-- Top Dragon TMS — Etap 3I
-- Centralne wolne ładunki / planowane relacje oraz wspólne zapytania o ładunek.
-- Dane kolejki są trwałe po odświeżeniu i współdzielone między sesjami.
-- Identyczne otwarte zapytania o ładunek są łączone po merge_key.

begin;

create schema if not exists private;

-- Defensywnie odtwarzamy helper właściciela, aby migracja 3I była samowystarczalna
-- po wcześniejszym etapie 3H.3.
create or replace function private.tms_display_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.display_name), ''), '')
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

revoke all on function private.tms_display_name() from public;
grant execute on function private.tms_display_name() to authenticated;

create or replace function private.tms_queue_owned_by_current_dispatcher(p_payload jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.tms_role() = 'dispatcher'
    and lower(
      coalesce(
        nullif(trim(p_payload ->> 'createdBy'), ''),
        nullif(trim(p_payload ->> 'ownerDispatcher'), ''),
        ''
      )
    ) = lower(private.tms_display_name());
$$;

revoke all on function private.tms_queue_owned_by_current_dispatcher(jsonb) from public;
grant execute on function private.tms_queue_owned_by_current_dispatcher(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Centralna kolejka: przyszłe relacje + wolne ładunki
-- ---------------------------------------------------------------------------
create table if not exists public.tms_load_queue (
  branch_id uuid not null references public.branches(id),
  queue_type text not null,
  load_ref text not null,
  payload jsonb not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, queue_type, load_ref),
  constraint tms_load_queue_type_check check (queue_type in ('future', 'proposed')),
  constraint tms_load_queue_ref_check check (length(trim(load_ref)) between 1 and 180),
  constraint tms_load_queue_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index if not exists tms_load_queue_active_updated_idx
  on public.tms_load_queue(active, queue_type, updated_at desc);
create index if not exists tms_load_queue_branch_idx
  on public.tms_load_queue(branch_id, queue_type, active, updated_at desc);

alter table public.tms_load_queue enable row level security;

-- Wolne ładunki są wspólne dla wszystkich właściwych użytkowników.
-- Planowane relacje pozostają ograniczone do oddziału.
drop policy if exists tms_load_queue_select on public.tms_load_queue;
create policy tms_load_queue_select
on public.tms_load_queue
for select
to authenticated
using (
  private.tms_role() = 'admin'
  or (
    queue_type = 'proposed'
    and private.tms_role() in ('dispatcher', 'branch_manager', 'accounting')
  )
  or (
    queue_type = 'future'
    and branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager', 'accounting')
  )
);

-- Zapis: admin wszędzie, kierownik w swoim oddziale, spedytor tylko własne wpisy.
drop policy if exists tms_load_queue_insert on public.tms_load_queue;
create policy tms_load_queue_insert
on public.tms_load_queue
for insert
to authenticated
with check (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() = 'branch_manager'
  )
  or (
    branch_id = private.tms_branch_id()
    and private.tms_queue_owned_by_current_dispatcher(payload)
  )
);

drop policy if exists tms_load_queue_update on public.tms_load_queue;
create policy tms_load_queue_update
on public.tms_load_queue
for update
to authenticated
using (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() = 'branch_manager'
  )
  or (
    branch_id = private.tms_branch_id()
    and private.tms_queue_owned_by_current_dispatcher(payload)
  )
)
with check (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() = 'branch_manager'
  )
  or (
    branch_id = private.tms_branch_id()
    and private.tms_queue_owned_by_current_dispatcher(payload)
  )
);

grant select, insert, update on public.tms_load_queue to authenticated;

create or replace function public.upsert_tms_load_queue(
  p_branch_id uuid,
  p_queue_type text,
  p_load jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_queue_type text := lower(trim(coalesce(p_queue_type, '')));
  v_load_ref text;
  v_existing_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do zapisywania ładunków.';
  end if;

  if v_queue_type not in ('future', 'proposed') then
    raise exception 'Nieprawidłowy typ kolejki.';
  end if;

  if p_load is null or jsonb_typeof(p_load) <> 'object' then
    raise exception 'Nieprawidłowe dane ładunku.';
  end if;

  v_load_ref := trim(coalesce(p_load ->> 'id', ''));
  if v_load_ref = '' then
    raise exception 'Ładunek nie ma identyfikatora.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Wpis należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału wpisu.';
  end if;

  if v_role = 'dispatcher' then
    if not private.tms_queue_owned_by_current_dispatcher(p_load) then
      raise exception 'Nie możesz zapisać wpisu należącego do innego spedytora.';
    end if;

    select q.payload
      into v_existing_payload
    from public.tms_load_queue q
    where q.branch_id = v_branch_id
      and q.queue_type = v_queue_type
      and q.load_ref = v_load_ref
    limit 1;

    if v_existing_payload is not null
       and not private.tms_queue_owned_by_current_dispatcher(v_existing_payload) then
      raise exception 'Nie możesz zmienić wpisu należącego do innego spedytora.';
    end if;
  end if;

  insert into public.tms_load_queue(
    branch_id, queue_type, load_ref, payload, active,
    created_by, updated_by, created_at, updated_at
  )
  values (
    v_branch_id, v_queue_type, v_load_ref, p_load, true,
    auth.uid(), auth.uid(), now(), now()
  )
  on conflict (branch_id, queue_type, load_ref)
  do update set
    payload = excluded.payload,
    active = true,
    updated_by = auth.uid(),
    updated_at = now();

  return v_load_ref;
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do archiwizacji ładunku.';
  end if;
  if v_queue_type not in ('future', 'proposed') or v_load_ref = '' then
    raise exception 'Brak prawidłowego identyfikatora wpisu.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Wpis należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału wpisu.';
  end if;

  update public.tms_load_queue
  set active = false,
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
  if v_count = 0 and v_role = 'dispatcher' then
    raise exception 'Nie możesz usunąć wpisu należącego do innego spedytora.';
  end if;
  return v_count > 0;
end;
$$;

revoke all on function public.upsert_tms_load_queue(uuid, text, jsonb) from public;
revoke all on function public.archive_tms_load_queue(uuid, text, text) from public;
grant execute on function public.upsert_tms_load_queue(uuid, text, jsonb) to authenticated;
grant execute on function public.archive_tms_load_queue(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Centralne zapytania o ładunek
-- ---------------------------------------------------------------------------
create table if not exists public.tms_load_requests (
  request_ref text primary key,
  merge_key text not null,
  payload jsonb not null,
  status text not null default 'new',
  is_open boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tms_load_requests_ref_check check (length(trim(request_ref)) between 1 and 180),
  constraint tms_load_requests_merge_check check (length(trim(merge_key)) between 1 and 600),
  constraint tms_load_requests_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint tms_load_requests_status_check check (status in ('new', 'contacting', 'available', 'unavailable', 'closed'))
);

create unique index if not exists tms_load_requests_open_merge_uq
  on public.tms_load_requests(merge_key)
  where is_open = true;
create index if not exists tms_load_requests_updated_idx
  on public.tms_load_requests(updated_at desc);

alter table public.tms_load_requests enable row level security;

-- Zapytania są wspólne i widoczne dla wszystkich zalogowanych właściwych użytkowników.
drop policy if exists tms_load_requests_select on public.tms_load_requests;
create policy tms_load_requests_select
on public.tms_load_requests
for select
to authenticated
using (private.tms_role() in ('admin', 'branch_manager', 'dispatcher', 'accounting'));

grant select on public.tms_load_requests to authenticated;

create or replace function public.upsert_tms_load_request(
  p_request jsonb,
  p_merge_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_actor text;
  v_incoming_ref text;
  v_merge_key text := trim(coalesce(p_merge_key, ''));
  v_existing public.tms_load_requests%rowtype;
  v_has_existing boolean := false;
  v_owner text;
  v_is_owner boolean := false;
  v_is_participant boolean := false;
  v_participants jsonb := '[]'::jsonb;
  v_actor_participant jsonb;
  v_payload jsonb;
  v_status text;
  v_open boolean;
  v_now_text text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do zapisywania zapytań o ładunek.';
  end if;

  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Nieprawidłowe dane zapytania.';
  end if;

  v_actor := upper(trim(private.tms_display_name()));
  if v_actor = '' and v_role <> 'admin' then
    raise exception 'Nie udało się ustalić autora zapytania.';
  end if;

  v_incoming_ref := trim(coalesce(p_request ->> 'id', ''));
  if v_incoming_ref = '' or v_merge_key = '' then
    raise exception 'Zapytanie nie ma identyfikatora lub klucza łączenia.';
  end if;

  select * into v_existing
  from public.tms_load_requests r
  where r.request_ref = v_incoming_ref
  limit 1
  for update;
  v_has_existing := found;

  if not v_has_existing then
    select * into v_existing
    from public.tms_load_requests r
    where r.merge_key = v_merge_key
      and r.is_open = true
    order by r.created_at asc
    limit 1
    for update;
    v_has_existing := found;
  end if;

  if v_has_existing then
    v_owner := upper(trim(coalesce(v_existing.payload ->> 'ownerDispatcher', '')));
    v_participants := case
      when jsonb_typeof(v_existing.payload -> 'participants') = 'array' then v_existing.payload -> 'participants'
      else '[]'::jsonb
    end;

    select exists(
      select 1
      from jsonb_array_elements(v_participants) elem
      where upper(trim(coalesce(elem ->> 'dispatcher', ''))) = v_actor
    ) into v_is_participant;

    v_is_owner := v_actor <> '' and v_actor = v_owner;

    if v_actor <> '' and not v_is_participant and not v_is_owner then
      select elem into v_actor_participant
      from jsonb_array_elements(
        case when jsonb_typeof(p_request -> 'participants') = 'array' then p_request -> 'participants' else '[]'::jsonb end
      ) elem
      where upper(trim(coalesce(elem ->> 'dispatcher', ''))) = v_actor
      limit 1;

      v_actor_participant := coalesce(
        v_actor_participant,
        jsonb_build_object(
          'dispatcher', v_actor,
          'driverId', '',
          'driverName', '',
          'note', '',
          'createdAt', v_now_text
        )
      );
      v_actor_participant := jsonb_set(v_actor_participant, '{dispatcher}', to_jsonb(v_actor), true);
      v_participants := v_participants || jsonb_build_array(v_actor_participant);
      v_is_participant := true;
    end if;

    -- Właściciel klienta, kierownik i admin mogą aktualizować status/odpowiedź.
    -- Uczestnik może tylko dołączyć do istniejącego zapytania lub je zamknąć.
    if v_role in ('admin', 'branch_manager') or v_is_owner then
      v_status := lower(trim(coalesce(p_request ->> 'status', v_existing.status)));
      if v_status not in ('new', 'contacting', 'available', 'unavailable', 'closed') then
        v_status := v_existing.status;
      end if;
      v_payload := v_existing.payload || p_request;
      -- Nie pozwalamy zmienić właściciela ani klucza tożsamości istniejącego zapytania.
      v_payload := jsonb_set(v_payload, '{ownerDispatcher}', to_jsonb(v_owner), true);
    else
      v_status := case
        when lower(trim(coalesce(p_request ->> 'status', ''))) = 'closed' then 'closed'
        else v_existing.status
      end;
      v_payload := v_existing.payload;
    end if;

    v_payload := jsonb_set(v_payload, '{id}', to_jsonb(v_existing.request_ref), true);
    v_payload := jsonb_set(v_payload, '{participants}', v_participants, true);
    v_payload := jsonb_set(v_payload, '{status}', to_jsonb(v_status), true);
    v_payload := jsonb_set(v_payload, '{updatedBy}', to_jsonb(v_actor), true);
    v_payload := jsonb_set(v_payload, '{updatedAt}', to_jsonb(v_now_text), true);
    v_open := v_status not in ('unavailable', 'closed');

    update public.tms_load_requests
    set payload = v_payload,
        status = v_status,
        is_open = v_open,
        updated_by = auth.uid(),
        updated_at = now()
    where request_ref = v_existing.request_ref;

    return v_existing.request_ref;
  end if;

  v_owner := upper(trim(coalesce(p_request ->> 'ownerDispatcher', '')));
  if v_owner = '' then
    raise exception 'Zapytanie nie ma opiekuna klienta.';
  end if;

  v_participants := case
    when jsonb_typeof(p_request -> 'participants') = 'array' then p_request -> 'participants'
    else '[]'::jsonb
  end;
  select exists(
    select 1 from jsonb_array_elements(v_participants) elem
    where upper(trim(coalesce(elem ->> 'dispatcher', ''))) = v_actor
  ) into v_is_participant;

  if v_actor <> '' and not v_is_participant and v_actor <> v_owner then
    v_participants := v_participants || jsonb_build_array(jsonb_build_object(
      'dispatcher', v_actor,
      'driverId', '',
      'driverName', '',
      'note', '',
      'createdAt', v_now_text
    ));
  end if;

  v_status := case
    when (v_role in ('admin', 'branch_manager') or v_actor = v_owner)
      and lower(trim(coalesce(p_request ->> 'status', 'new'))) in ('new', 'contacting', 'available', 'unavailable', 'closed')
      then lower(trim(coalesce(p_request ->> 'status', 'new')))
    else 'new'
  end;
  v_open := v_status not in ('unavailable', 'closed');

  v_payload := p_request;
  v_payload := jsonb_set(v_payload, '{id}', to_jsonb(v_incoming_ref), true);
  v_payload := jsonb_set(v_payload, '{requesterDispatcher}', to_jsonb(v_actor), true);
  v_payload := jsonb_set(v_payload, '{participants}', v_participants, true);
  v_payload := jsonb_set(v_payload, '{status}', to_jsonb(v_status), true);
  v_payload := jsonb_set(v_payload, '{updatedBy}', to_jsonb(v_actor), true);
  v_payload := jsonb_set(v_payload, '{updatedAt}', to_jsonb(v_now_text), true);

  begin
    insert into public.tms_load_requests(
      request_ref, merge_key, payload, status, is_open,
      created_by, updated_by, created_at, updated_at
    ) values (
      v_incoming_ref, v_merge_key, v_payload, v_status, v_open,
      auth.uid(), auth.uid(), now(), now()
    );
    return v_incoming_ref;
  exception when unique_violation then
    -- Dwa komputery mogły wysłać identyczne zapytanie jednocześnie.
    -- Pobieramy istniejący rekord i dokładamy bieżącego spedytora jako uczestnika.
    select * into v_existing
    from public.tms_load_requests r
    where r.merge_key = v_merge_key and r.is_open = true
    order by r.created_at asc
    limit 1
    for update;
    if not found then raise; end if;

    v_participants := case
      when jsonb_typeof(v_existing.payload -> 'participants') = 'array' then v_existing.payload -> 'participants'
      else '[]'::jsonb
    end;
    select exists(
      select 1 from jsonb_array_elements(v_participants) elem
      where upper(trim(coalesce(elem ->> 'dispatcher', ''))) = v_actor
    ) into v_is_participant;

    if v_actor <> '' and not v_is_participant and v_actor <> upper(trim(coalesce(v_existing.payload ->> 'ownerDispatcher', ''))) then
      v_participants := v_participants || jsonb_build_array(jsonb_build_object(
        'dispatcher', v_actor,
        'driverId', '',
        'driverName', '',
        'note', '',
        'createdAt', v_now_text
      ));
      update public.tms_load_requests
      set payload = jsonb_set(
            jsonb_set(payload, '{participants}', v_participants, true),
            '{updatedAt}', to_jsonb(v_now_text), true
          ),
          updated_by = auth.uid(),
          updated_at = now()
      where request_ref = v_existing.request_ref;
    end if;
    return v_existing.request_ref;
  end;
end;
$$;

revoke all on function public.upsert_tms_load_request(jsonb, text) from public;
grant execute on function public.upsert_tms_load_request(jsonb, text) to authenticated;

-- Realtime dla obu nowych modułów.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tms_load_queue'
    ) then
      execute 'alter publication supabase_realtime add table public.tms_load_queue';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tms_load_requests'
    ) then
      execute 'alter publication supabase_realtime add table public.tms_load_requests';
    end if;
  end if;
end
$$;

commit;
