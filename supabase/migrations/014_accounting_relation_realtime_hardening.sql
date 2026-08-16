-- Top Dragon TMS — Etap 3L.11
-- Utwardzenie centralnej synchronizacji statusów Rozliczeń.
-- Migracja jest samowystarczalna: może zostać uruchomiona także wtedy,
-- gdy wcześniejsza 013_accounting_relation_status_sync.sql nie została wykonana.

begin;

create or replace function public.patch_tms_relation_accounting(
  p_branch_id uuid,
  p_relation_ref text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_branch_id uuid;
  v_relation_ref text := trim(coalesce(p_relation_ref, ''));
  v_patch jsonb := '{}'::jsonb;
  v_status text;
  v_count integer := 0;
  v_unknown_key text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  v_role := private.tms_role();
  if v_role not in ('accounting', 'admin') then
    raise exception 'Status rozliczeń może zmieniać tylko grupa Rozliczenia.';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Nieprawidłowe dane aktualizacji rozliczeń.';
  end if;

  if v_relation_ref = '' then
    raise exception 'Brak identyfikatora relacji.';
  end if;

  select key
    into v_unknown_key
  from jsonb_object_keys(p_patch) as keys(key)
  where key not in (
    'accountingStatus',
    'accountingFinal',
    'accountingCheck',
    'approachKm',
    'loadedKm',
    'baseKm',
    'rate',
    'oversizedCost',
    'cost',
    'oversizedTransport'
  )
  limit 1;

  if v_unknown_key is not null then
    raise exception 'Pole % nie może być zmieniane przez Rozliczenia.', v_unknown_key;
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

  if p_patch ? 'accountingStatus' then
    v_status := trim(coalesce(p_patch ->> 'accountingStatus', 'Nowe'));
    if v_status not in ('Nowe', 'Niezgodności', 'Krytyczne', 'Wprowadzone') then
      raise exception 'Nieprawidłowy status rozliczeń.';
    end if;
    v_patch := v_patch || jsonb_build_object('accountingStatus', v_status);
  end if;

  if p_patch ? 'accountingFinal' then
    if jsonb_typeof(p_patch -> 'accountingFinal') <> 'boolean' then
      raise exception 'Nieprawidłowa wartość accountingFinal.';
    end if;
    v_patch := v_patch || jsonb_build_object('accountingFinal', (p_patch ->> 'accountingFinal')::boolean);
  end if;

  if p_patch ? 'accountingCheck' then
    if jsonb_typeof(p_patch -> 'accountingCheck') <> 'boolean' then
      raise exception 'Nieprawidłowa wartość accountingCheck.';
    end if;
    v_patch := v_patch || jsonb_build_object('accountingCheck', (p_patch ->> 'accountingCheck')::boolean);
  end if;

  if p_patch ? 'approachKm' then
    if jsonb_typeof(p_patch -> 'approachKm') <> 'number' then raise exception 'Nieprawidłowa wartość approachKm.'; end if;
    v_patch := v_patch || jsonb_build_object('approachKm', p_patch -> 'approachKm');
  end if;
  if p_patch ? 'loadedKm' then
    if jsonb_typeof(p_patch -> 'loadedKm') <> 'number' then raise exception 'Nieprawidłowa wartość loadedKm.'; end if;
    v_patch := v_patch || jsonb_build_object('loadedKm', p_patch -> 'loadedKm');
  end if;
  if p_patch ? 'baseKm' then
    if jsonb_typeof(p_patch -> 'baseKm') <> 'number' then raise exception 'Nieprawidłowa wartość baseKm.'; end if;
    v_patch := v_patch || jsonb_build_object('baseKm', p_patch -> 'baseKm');
  end if;
  if p_patch ? 'rate' then
    if jsonb_typeof(p_patch -> 'rate') <> 'number' then raise exception 'Nieprawidłowa wartość rate.'; end if;
    v_patch := v_patch || jsonb_build_object('rate', p_patch -> 'rate');
  end if;
  if p_patch ? 'oversizedCost' then
    if jsonb_typeof(p_patch -> 'oversizedCost') <> 'number' then raise exception 'Nieprawidłowa wartość oversizedCost.'; end if;
    v_patch := v_patch || jsonb_build_object('oversizedCost', p_patch -> 'oversizedCost');
  end if;
  if p_patch ? 'cost' then
    if jsonb_typeof(p_patch -> 'cost') <> 'number' then raise exception 'Nieprawidłowa wartość cost.'; end if;
    v_patch := v_patch || jsonb_build_object('cost', p_patch -> 'cost');
  end if;
  if p_patch ? 'oversizedTransport' then
    if jsonb_typeof(p_patch -> 'oversizedTransport') <> 'boolean' then
      raise exception 'Nieprawidłowa wartość oversizedTransport.';
    end if;
    v_patch := v_patch || jsonb_build_object('oversizedTransport', (p_patch ->> 'oversizedTransport')::boolean);
  end if;

  if v_patch = '{}'::jsonb then
    raise exception 'Brak dozwolonych pól do aktualizacji.';
  end if;

  update public.tms_relations
  set payload = payload || v_patch,
      updated_by = auth.uid(),
      updated_at = now()
  where branch_id = v_branch_id
    and relation_ref = v_relation_ref
    and active = true;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Nie znaleziono aktywnej relacji.';
  end if;

  return v_patch;
end;
$$;

revoke all on function public.patch_tms_relation_accounting(uuid, text, jsonb) from public;
grant execute on function public.patch_tms_relation_accounting(uuid, text, jsonb) to authenticated;

-- Zapewniamy Realtime także przy instalacji, w której 008 nie dodała jeszcze tabeli
-- do publikacji (blok jest idempotentny).
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
