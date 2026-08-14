-- Top Dragon TMS — Etap 3G
-- Centralne relacje / Plan kierowców w Supabase.
-- Każda relacja ma trwały identyfikator, a usunięcie z planu jest miękkie (active=false).

begin;

create table if not exists public.tms_relations (
  branch_id uuid not null references public.branches(id),
  relation_ref text not null,
  payload jsonb not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (branch_id, relation_ref),
  constraint tms_relations_relation_ref_check check (length(trim(relation_ref)) between 1 and 180),
  constraint tms_relations_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index if not exists tms_relations_branch_active_idx
  on public.tms_relations(branch_id, active, updated_at desc);

alter table public.tms_relations enable row level security;

-- SELECT: aktywny użytkownik widzi relacje swojego oddziału; admin widzi wszystkie.
drop policy if exists tms_relations_select on public.tms_relations;
create policy tms_relations_select
on public.tms_relations
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
drop policy if exists tms_relations_insert on public.tms_relations;
create policy tms_relations_insert
on public.tms_relations
for insert
to authenticated
with check (
  private.tms_role() = 'admin'
  or (
    branch_id = private.tms_branch_id()
    and private.tms_role() in ('dispatcher', 'branch_manager')
  )
);

drop policy if exists tms_relations_update on public.tms_relations;
create policy tms_relations_update
on public.tms_relations
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

-- Brak polityki DELETE: rekordów relacji nie kasujemy fizycznie z aplikacji.
grant select, insert, update on public.tms_relations to authenticated;

create or replace function public.upsert_tms_relation(
  p_branch_id uuid,
  p_relation jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_relation_ref text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do zapisywania relacji.';
  end if;

  if p_relation is null or jsonb_typeof(p_relation) <> 'object' then
    raise exception 'Nieprawidłowe dane relacji.';
  end if;

  v_relation_ref := trim(coalesce(p_relation ->> 'id', ''));
  if v_relation_ref = '' then
    raise exception 'Relacja nie ma identyfikatora.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Relacja należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału relacji.';
  end if;

  insert into public.tms_relations(
    branch_id,
    relation_ref,
    payload,
    active,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    v_branch_id,
    v_relation_ref,
    p_relation,
    true,
    auth.uid(),
    auth.uid(),
    now(),
    now()
  )
  on conflict (branch_id, relation_ref)
  do update set
    payload = excluded.payload,
    active = true,
    updated_by = auth.uid(),
    updated_at = now();

  return v_relation_ref;
end;
$$;

create or replace function public.archive_tms_relation(
  p_branch_id uuid,
  p_relation_ref text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_relation_ref text := trim(coalesce(p_relation_ref, ''));
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('admin', 'branch_manager', 'dispatcher') then
    raise exception 'Brak uprawnień do usuwania relacji z aktywnego planu.';
  end if;

  if v_relation_ref = '' then
    raise exception 'Brak identyfikatora relacji.';
  end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then
      raise exception 'Relacja należy do innego oddziału.';
    end if;
  end if;

  if v_branch_id is null then
    raise exception 'Nie udało się ustalić oddziału relacji.';
  end if;

  update public.tms_relations
  set active = false,
      updated_by = auth.uid(),
      updated_at = now()
  where branch_id = v_branch_id
    and relation_ref = v_relation_ref
    and active = true;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.upsert_tms_relation(uuid, jsonb) from public;
revoke all on function public.archive_tms_relation(uuid, text) from public;
grant execute on function public.upsert_tms_relation(uuid, jsonb) to authenticated;
grant execute on function public.archive_tms_relation(uuid, text) to authenticated;

-- Realtime: po zmianie relacji inne otwarte sesje tego samego oddziału dostaną odświeżony plan.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'tms_relations'
     ) then
    execute 'alter publication supabase_realtime add table public.tms_relations';
  end if;
end
$$;

commit;
