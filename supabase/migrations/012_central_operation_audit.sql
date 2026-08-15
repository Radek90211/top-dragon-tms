-- Top Dragon TMS — Etap 3J
-- Centralna, nieusuwalna historia operacji w Supabase.
-- Wpisy tworzą wyłącznie aktywni użytkownicy przez kontrolowaną funkcję RPC.

begin;

alter table public.operation_audit
  add column if not exists branch_id uuid references public.branches(id),
  add column if not exists branch_name text,
  add column if not exists actor_name text,
  add column if not exists actor_role public.app_role,
  add column if not exists details text;

create index if not exists operation_audit_created_at_idx
  on public.operation_audit(created_at desc);
create index if not exists operation_audit_actor_idx
  on public.operation_audit(actor_id, created_at desc);
create index if not exists operation_audit_branch_idx
  on public.operation_audit(branch_id, created_at desc);
create index if not exists operation_audit_action_idx
  on public.operation_audit(action, created_at desc);

alter table public.operation_audit enable row level security;

-- Historia pozostaje tylko do odczytu dla administratora.
drop policy if exists "admins_read_audit" on public.operation_audit;
create policy "admins_read_audit"
on public.operation_audit
for select
to authenticated
using (public.is_admin());

revoke insert, update, delete on public.operation_audit from authenticated;
revoke all on public.operation_audit from anon;
grant select on public.operation_audit to authenticated;

create or replace function public.write_tms_operation_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_details text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_branch_name text := '';
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Brak aktywnej sesji użytkownika.';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;

  if not found then
    raise exception 'Profil użytkownika jest nieaktywny albo nie istnieje.';
  end if;

  if length(trim(coalesce(p_action, ''))) = 0 then
    raise exception 'Brak nazwy operacji.';
  end if;

  if length(trim(coalesce(p_entity_type, ''))) = 0 then
    raise exception 'Brak typu obiektu.';
  end if;

  if v_profile.branch_id is not null then
    select coalesce(b.name, '') into v_branch_name
    from public.branches b
    where b.id = v_profile.branch_id
    limit 1;
  end if;

  insert into public.operation_audit(
    actor_id,
    branch_id,
    branch_name,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    details,
    old_data,
    new_data
  ) values (
    auth.uid(),
    v_profile.branch_id,
    v_branch_name,
    coalesce(v_profile.display_name, ''),
    v_profile.role,
    left(trim(p_action), 180),
    left(trim(p_entity_type), 120),
    nullif(left(trim(coalesce(p_entity_id, '')), 240), ''),
    nullif(left(trim(coalesce(p_details, '')), 4000), ''),
    null,
    null
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_tms_operation_audit(text, text, text, text) from public;
grant execute on function public.write_tms_operation_audit(text, text, text, text) to authenticated;

-- operation_audit ma być widoczny w Realtime dla administratora.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'operation_audit'
    ) then
      execute 'alter publication supabase_realtime add table public.operation_audit';
    end if;
  end if;
end $$;

commit;
