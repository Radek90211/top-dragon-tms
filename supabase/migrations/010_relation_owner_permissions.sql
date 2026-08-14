-- Top Dragon TMS — Etap 3H.3
-- Blokada edycji cudzych relacji przez spedytorów.
-- Admin zachowuje pełny dostęp, kierownik oddziału zarządza relacjami oddziału.

begin;

create schema if not exists private;

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

create or replace function private.tms_relation_owned_by_current_dispatcher(p_payload jsonb)
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
        nullif(trim(p_payload ->> 'ownerDispatcher'), ''),
        nullif(trim(p_payload ->> 'createdBy'), ''),
        ''
      )
    ) = lower(private.tms_display_name());
$$;

revoke all on function private.tms_relation_owned_by_current_dispatcher(jsonb) from public;
grant execute on function private.tms_relation_owned_by_current_dispatcher(jsonb) to authenticated;

-- INSERT: spedytor może utworzyć tylko własną relację w swoim oddziale.
drop policy if exists tms_relations_insert on public.tms_relations;
create policy tms_relations_insert
on public.tms_relations
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
    and private.tms_relation_owned_by_current_dispatcher(payload)
  )
);

-- UPDATE: polityka sprawdza właściciela zarówno przed, jak i po zmianie.
-- Dzięki temu spedytor nie może przejąć cudzej relacji przez zmianę ownerDispatcher.
drop policy if exists tms_relations_update on public.tms_relations;
create policy tms_relations_update
on public.tms_relations
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
    and private.tms_relation_owned_by_current_dispatcher(payload)
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
    and private.tms_relation_owned_by_current_dispatcher(payload)
  )
);

-- Dodatkowe sprawdzenie w RPC, aby błąd był jednoznaczny również przy zapisie przez aplikację.
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
  v_existing_payload jsonb;
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

  if v_role = 'dispatcher' then
    if not private.tms_relation_owned_by_current_dispatcher(p_relation) then
      raise exception 'Nie możesz zapisać relacji należącej do innego spedytora.';
    end if;

    select r.payload
      into v_existing_payload
    from public.tms_relations r
    where r.branch_id = v_branch_id
      and r.relation_ref = v_relation_ref
    limit 1;

    if v_existing_payload is not null
       and not private.tms_relation_owned_by_current_dispatcher(v_existing_payload) then
      raise exception 'Nie możesz zmienić relacji należącej do innego spedytora.';
    end if;
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
    and active = true
    and (
      v_role in ('admin', 'branch_manager')
      or private.tms_relation_owned_by_current_dispatcher(payload)
    );

  get diagnostics v_count = row_count;

  if v_count = 0 and v_role = 'dispatcher' then
    raise exception 'Nie możesz usunąć relacji należącej do innego spedytora.';
  end if;

  return v_count > 0;
end;
$$;

revoke all on function public.upsert_tms_relation(uuid, jsonb) from public;
revoke all on function public.archive_tms_relation(uuid, text) from public;
grant execute on function public.upsert_tms_relation(uuid, jsonb) to authenticated;
grant execute on function public.archive_tms_relation(uuid, text) to authenticated;

commit;
