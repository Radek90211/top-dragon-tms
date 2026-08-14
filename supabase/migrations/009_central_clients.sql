-- Top Dragon TMS — Etap 3H
-- Centralna baza klientów w Supabase.
-- Dane klienta przechowujemy jako payload JSONB, a usunięcie z aktywnej bazy jest miękkie (active=false).

begin;

create table if not exists public.tms_clients_central (
  branch_id uuid not null references public.branches(id),
  client_ref text not null,
  payload jsonb not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, client_ref),
  constraint tms_clients_central_client_ref_check check (length(trim(client_ref)) between 1 and 180),
  constraint tms_clients_central_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index if not exists tms_clients_central_branch_active_idx
  on public.tms_clients_central(branch_id, active, updated_at desc);

alter table public.tms_clients_central enable row level security;

-- SELECT: aktywny użytkownik widzi bazę klientów swojego oddziału; admin widzi wszystkie oddziały.
drop policy if exists tms_clients_central_select on public.tms_clients_central;
create policy tms_clients_central_select
on public.tms_clients_central
for select
to authenticated
using (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager', 'accounting')
  )
);

-- INSERT/UPDATE: spedytor i kierownik tylko w swoim oddziale, admin wszędzie.
drop policy if exists tms_clients_central_insert on public.tms_clients_central;
create policy tms_clients_central_insert
on public.tms_clients_central
for insert
to authenticated
with check (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager')
  )
);

drop policy if exists tms_clients_central_update on public.tms_clients_central;
create policy tms_clients_central_update
on public.tms_clients_central
for update
to authenticated
using (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager')
  )
)
with check (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager')
  )
);

-- Nie udostępniamy fizycznego DELETE z aplikacji. Klient jest archiwizowany przez active=false.
grant select, insert, update on public.tms_clients_central to authenticated;

create or replace function public.upsert_tms_client(
  p_branch_id uuid,
  p_client jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_client_ref text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do zapisywania klientów.';
  end if;

  if p_client is null or jsonb_typeof(p_client) <> 'object' then
    raise exception 'Nieprawidłowe dane klienta.';
  end if;

  v_client_ref := trim(coalesce(p_client ->> 'id', ''));
  if v_client_ref = '' then
    raise exception 'Klient nie ma identyfikatora.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Klient należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału klienta.';
  end if;

  insert into public.tms_clients_central(
    branch_id,
    client_ref,
    payload,
    active,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    v_branch_id,
    v_client_ref,
    p_client,
    true,
    auth.uid(),
    auth.uid(),
    now(),
    now()
  )
  on conflict (branch_id, client_ref)
  do update set
    payload = excluded.payload,
    active = true,
    updated_by = auth.uid(),
    updated_at = now();

  return v_client_ref;
end;
$$;

create or replace function public.archive_tms_client(
  p_branch_id uuid,
  p_client_ref text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_client_ref text := trim(coalesce(p_client_ref, ''));
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do usuwania klienta z aktywnej bazy.';
  end if;

  if v_client_ref = '' then
    raise exception 'Brak identyfikatora klienta.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Klient należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału klienta.';
  end if;

  update public.tms_clients_central
  set active = false,
      updated_by = auth.uid(),
      updated_at = now()
  where branch_id = v_branch_id
    and client_ref = v_client_ref
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.upsert_tms_client(uuid, jsonb) from public;
revoke all on function public.archive_tms_client(uuid, text) from public;
grant execute on function public.upsert_tms_client(uuid, jsonb) to authenticated;
grant execute on function public.archive_tms_client(uuid, text) to authenticated;

-- Realtime: zmiany w bazie klientów są natychmiast widoczne w innych otwartych sesjach.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'tms_clients_central'
     ) then
    execute 'alter publication supabase_realtime add table public.tms_clients_central';
  end if;
end
$$;

commit;
