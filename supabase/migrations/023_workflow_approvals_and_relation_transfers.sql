-- Top Dragon TMS — Etap 3L.31
-- Akceptacja przypisania opiekuna klienta + transfer relacji pomiędzy spedytorami.
-- Nie rozszerza prawa spedytora do edycji cudzych relacji.

begin;

create schema if not exists private;

create or replace function private.tms_login_from_display_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '_' from regexp_replace(upper(trim(coalesce(p_name, ''))), '[^A-ZĄĆĘŁŃÓŚŹŻ0-9_-]+', '_', 'g'));
$$;

revoke all on function private.tms_login_from_display_name(text) from public;
grant execute on function private.tms_login_from_display_name(text) to authenticated;

-- =========================================================
-- 1. Wnioski o przypisanie opiekuna klienta
-- =========================================================
create table if not exists public.tms_client_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  client_ref text not null,
  client_name text not null default '',
  requested_dispatcher_id uuid not null references public.profiles(id) on delete restrict,
  requested_dispatcher_name text not null default '',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_by_name text not null default '',
  status text not null default 'pending',
  decision_comment text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  responded_by uuid null references public.profiles(id) on delete restrict,
  constraint tms_client_assignment_requests_status_check check (status in ('pending','accepted','rejected','cancelled')),
  constraint tms_client_assignment_requests_comment_check check (char_length(decision_comment) <= 1200)
);

create index if not exists tms_client_assignment_requests_branch_status_idx
  on public.tms_client_assignment_requests(branch_id, status, created_at desc);
create index if not exists tms_client_assignment_requests_client_idx
  on public.tms_client_assignment_requests(branch_id, client_ref, created_at desc);

alter table public.tms_client_assignment_requests enable row level security;

drop policy if exists tms_client_assignment_requests_select on public.tms_client_assignment_requests;
create policy tms_client_assignment_requests_select
on public.tms_client_assignment_requests
for select
to authenticated
using (
  private.tms_role() in ('admin','accounting')
  or (branch_id = private.tms_branch_id() and private.tms_role() in ('dispatcher','branch_manager'))
);

revoke insert, update, delete on public.tms_client_assignment_requests from authenticated;
grant select on public.tms_client_assignment_requests to authenticated;

create or replace function public.request_tms_client_assignment(
  p_client_ref text,
  p_to_dispatcher_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_client public.tms_clients_central%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_role not in ('dispatcher','branch_manager','admin') then
    raise exception 'Brak uprawnień do wnioskowania o opiekuna klienta.';
  end if;
  if trim(coalesce(p_client_ref,'')) = '' or p_to_dispatcher_id is null then
    raise exception 'Wybierz klienta i spedytora.';
  end if;

  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  if not found then raise exception 'Nie znaleziono aktywnego profilu użytkownika.'; end if;

  select * into v_target
  from public.profiles
  where id = p_to_dispatcher_id and role = 'dispatcher' and active = true;
  if not found then raise exception 'Wybrany opiekun nie jest aktywnym spedytorem.'; end if;

  select * into v_client
  from public.tms_clients_central
  where client_ref = trim(p_client_ref) and active = true
    and (v_role = 'admin' or branch_id = v_actor.branch_id)
  order by updated_at desc
  limit 1;
  if not found then raise exception 'Nie znaleziono aktywnego klienta w Twoim oddziale.'; end if;

  if v_target.branch_id is distinct from v_client.branch_id then
    raise exception 'Opiekun klienta musi należeć do tego samego oddziału.';
  end if;

  update public.tms_client_assignment_requests
  set status = 'cancelled', responded_at = now(), responded_by = auth.uid(), decision_comment = 'Zastąpione nowszym wnioskiem.'
  where branch_id = v_client.branch_id and client_ref = v_client.client_ref and status = 'pending';

  insert into public.tms_client_assignment_requests(
    branch_id, client_ref, client_name,
    requested_dispatcher_id, requested_dispatcher_name,
    requested_by, requested_by_name
  ) values (
    v_client.branch_id,
    v_client.client_ref,
    coalesce(v_client.payload->>'name', v_client.client_ref),
    v_target.id,
    coalesce(v_target.display_name,''),
    v_actor.id,
    coalesce(v_actor.display_name,'')
  ) returning id into v_id;

  update public.tms_clients_central
  set payload = jsonb_set(
        jsonb_set(
          jsonb_set(payload, '{assignmentApprovalStatus}', '"pending"'::jsonb, true),
          '{assignmentRequestedDispatcher}', to_jsonb(coalesce(v_target.display_name,'')), true
        ),
        '{assignmentRequestId}', to_jsonb(v_id::text), true
      ),
      updated_by = auth.uid(), updated_at = now()
  where branch_id = v_client.branch_id and client_ref = v_client.client_ref;

  return v_id;
end;
$$;

create or replace function public.respond_tms_client_assignment(
  p_request_id uuid,
  p_status text,
  p_comment text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_status text := lower(trim(coalesce(p_status,'')));
  v_req public.tms_client_assignment_requests%rowtype;
  v_target public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_status not in ('accepted','rejected') then raise exception 'Nieprawidłowy status decyzji.'; end if;
  if char_length(coalesce(p_comment,'')) > 1200 then raise exception 'Komentarz jest zbyt długi.'; end if;

  select * into v_req from public.tms_client_assignment_requests where id = p_request_id;
  if not found then raise exception 'Nie znaleziono wniosku.'; end if;
  if v_req.status <> 'pending' then raise exception 'Wniosek został już rozpatrzony.'; end if;

  if v_role = 'branch_manager' then
    if v_req.branch_id is distinct from private.tms_branch_id() then
      raise exception 'Kierownik może zatwierdzać klientów wyłącznie swojego oddziału.';
    end if;
  elsif v_role <> 'admin' then
    raise exception 'Przypisanie musi zatwierdzić kierownik oddziału lub administrator.';
  end if;

  select * into v_target from public.profiles where id = v_req.requested_dispatcher_id and active = true and role = 'dispatcher';
  if not found then raise exception 'Wybrany spedytor nie jest już aktywny.'; end if;

  if v_status = 'accepted' then
    update public.tms_clients_central
    set payload = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(payload, '{dispatcher}', to_jsonb(coalesce(v_target.display_name,'')), true),
              '{databaseType}', '"assigned"'::jsonb, true
            ),
            '{assignmentApprovalStatus}', '"accepted"'::jsonb, true
          ),
          '{assignmentRequestedDispatcher}', '""'::jsonb, true
        ) || jsonb_build_object('assignmentApprovedAt', now()::text, 'assignmentRequestId', v_req.id::text),
        updated_by = auth.uid(), updated_at = now()
    where branch_id = v_req.branch_id and client_ref = v_req.client_ref and active = true;
  else
    update public.tms_clients_central
    set payload = jsonb_set(
          jsonb_set(payload, '{assignmentApprovalStatus}', '"rejected"'::jsonb, true),
          '{assignmentRequestedDispatcher}', '""'::jsonb, true
        ) || jsonb_build_object('assignmentRequestId', v_req.id::text),
        updated_by = auth.uid(), updated_at = now()
    where branch_id = v_req.branch_id and client_ref = v_req.client_ref and active = true;
  end if;

  update public.tms_client_assignment_requests
  set status = v_status,
      decision_comment = trim(coalesce(p_comment,'')),
      responded_at = now(),
      responded_by = auth.uid()
  where id = v_req.id;

  return true;
end;
$$;

-- Dispatcher nie może obejść procesu akceptacji przez zwykły upsert klienta.
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
  v_existing_payload jsonb;
  v_existing_dispatcher text;
  v_new_dispatcher text;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_role not in ('admin','branch_manager','dispatcher') then raise exception 'Brak uprawnień do zapisywania klientów.'; end if;
  if p_client is null or jsonb_typeof(p_client) <> 'object' then raise exception 'Nieprawidłowe dane klienta.'; end if;
  v_client_ref := trim(coalesce(p_client->>'id',''));
  if v_client_ref = '' then raise exception 'Klient nie ma identyfikatora.'; end if;

  if v_role = 'admin' then
    v_branch_id := coalesce(p_branch_id, private.tms_branch_id());
  else
    v_branch_id := private.tms_branch_id();
    if p_branch_id is not null and p_branch_id <> v_branch_id then raise exception 'Klient należy do innego oddziału.'; end if;
  end if;
  if v_branch_id is null then raise exception 'Nie udało się ustalić oddziału klienta.'; end if;

  if v_role = 'dispatcher' then
    select payload into v_existing_payload
    from public.tms_clients_central
    where branch_id = v_branch_id and client_ref = v_client_ref
    limit 1;
    v_existing_dispatcher := trim(coalesce(v_existing_payload->>'dispatcher',''));
    v_new_dispatcher := trim(coalesce(p_client->>'dispatcher',''));
    if v_existing_payload is null then
      if v_new_dispatcher <> '' then raise exception 'Przypisanie opiekuna nowego klienta wymaga akceptacji kierownika oddziału.'; end if;
    elsif lower(v_existing_dispatcher) <> lower(v_new_dispatcher) then
      raise exception 'Zmiana opiekuna klienta wymaga akceptacji kierownika oddziału.';
    end if;
  end if;

  insert into public.tms_clients_central(branch_id,client_ref,payload,active,created_by,updated_by,created_at,updated_at)
  values(v_branch_id,v_client_ref,p_client,true,auth.uid(),auth.uid(),now(),now())
  on conflict (branch_id,client_ref)
  do update set payload=excluded.payload, active=true, updated_by=auth.uid(), updated_at=now();
  return v_client_ref;
end;
$$;

-- =========================================================
-- 2. Transfer relacji do innego spedytora z akceptacją odbiorcy
-- =========================================================
create table if not exists public.tms_relation_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  relation_ref text not null,
  relation_label text not null default '',
  from_dispatcher_id uuid not null references public.profiles(id) on delete restrict,
  from_dispatcher_name text not null default '',
  to_dispatcher_id uuid not null references public.profiles(id) on delete restrict,
  to_dispatcher_name text not null default '',
  comment text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint tms_relation_transfer_requests_people_check check (from_dispatcher_id <> to_dispatcher_id),
  constraint tms_relation_transfer_requests_status_check check (status in ('pending','accepted','rejected','cancelled')),
  constraint tms_relation_transfer_requests_comment_check check (char_length(comment) <= 1200)
);

create index if not exists tms_relation_transfer_requests_branch_status_idx
  on public.tms_relation_transfer_requests(branch_id,status,created_at desc);
create index if not exists tms_relation_transfer_requests_relation_idx
  on public.tms_relation_transfer_requests(branch_id,relation_ref,created_at desc);

alter table public.tms_relation_transfer_requests enable row level security;

drop policy if exists tms_relation_transfer_requests_select on public.tms_relation_transfer_requests;
create policy tms_relation_transfer_requests_select
on public.tms_relation_transfer_requests
for select
to authenticated
using (
  private.tms_role() in ('admin','accounting')
  or (branch_id = private.tms_branch_id() and private.tms_role() in ('dispatcher','branch_manager'))
);

revoke insert, update, delete on public.tms_relation_transfer_requests from authenticated;
grant select on public.tms_relation_transfer_requests to authenticated;

create or replace function public.request_tms_relation_transfer(
  p_relation_ref text,
  p_to_dispatcher_id uuid,
  p_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_relation public.tms_relations%rowtype;
  v_actor_login text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if private.tms_role() <> 'dispatcher' then raise exception 'Transfer relacji może rozpocząć wyłącznie spedytor.'; end if;
  if trim(coalesce(p_relation_ref,'')) = '' or p_to_dispatcher_id is null then raise exception 'Wybierz relację i spedytora.'; end if;
  if char_length(coalesce(p_comment,'')) > 1200 then raise exception 'Komentarz jest zbyt długi.'; end if;

  select * into v_actor from public.profiles where id = auth.uid() and active = true;
  select * into v_target from public.profiles where id = p_to_dispatcher_id and role='dispatcher' and active=true;
  if not found then raise exception 'Wybrany odbiorca nie jest aktywnym spedytorem.'; end if;
  if v_target.id = auth.uid() then raise exception 'Wybierz innego spedytora.'; end if;
  if v_target.branch_id is distinct from v_actor.branch_id then raise exception 'Relację można przekazać spedytorowi z tego samego oddziału.'; end if;

  select * into v_relation
  from public.tms_relations
  where branch_id = v_actor.branch_id and relation_ref = trim(p_relation_ref) and active=true
  limit 1;
  if not found then raise exception 'Nie znaleziono aktywnej relacji.'; end if;

  v_actor_login := private.tms_login_from_display_name(v_actor.display_name);
  if lower(trim(coalesce(v_relation.payload->>'ownerDispatcher',''))) <> lower(v_actor_login)
     and lower(trim(coalesce(v_relation.payload->>'ownerDispatcher',''))) <> lower(trim(coalesce(v_actor.display_name,''))) then
    raise exception 'Możesz przekazać wyłącznie własną relację.';
  end if;

  update public.tms_relation_transfer_requests
  set status='cancelled', responded_at=now(), comment=case when comment='' then 'Zastąpione nowszym wnioskiem.' else comment end
  where branch_id=v_relation.branch_id and relation_ref=v_relation.relation_ref and status='pending';

  insert into public.tms_relation_transfer_requests(
    branch_id,relation_ref,relation_label,
    from_dispatcher_id,from_dispatcher_name,to_dispatcher_id,to_dispatcher_name,comment
  ) values (
    v_relation.branch_id,v_relation.relation_ref,
    concat(coalesce(v_relation.payload->>'load',''), ' → ', coalesce(v_relation.payload->>'unload','')),
    v_actor.id,coalesce(v_actor.display_name,''),v_target.id,coalesce(v_target.display_name,''),trim(coalesce(p_comment,''))
  ) returning id into v_id;

  update public.tms_relations
  set payload = payload || jsonb_build_object(
      'transferStatus','pending',
      'transferRequestId',v_id::text,
      'transferToDispatcher',private.tms_login_from_display_name(v_target.display_name)
    ),
    updated_by=auth.uid(),updated_at=now()
  where branch_id=v_relation.branch_id and relation_ref=v_relation.relation_ref;

  return v_id;
end;
$$;

create or replace function public.respond_tms_relation_transfer(
  p_request_id uuid,
  p_status text,
  p_assignment_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(trim(coalesce(p_status,'')));
  v_req public.tms_relation_transfer_requests%rowtype;
  v_target public.profiles%rowtype;
  v_assignment public.fleet_assignments%rowtype;
  v_target_login text;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if private.tms_role() <> 'dispatcher' then raise exception 'Transfer może zatwierdzić wyłącznie spedytor odbiorca.'; end if;
  if v_status not in ('accepted','rejected') then raise exception 'Nieprawidłowy status transferu.'; end if;

  select * into v_req from public.tms_relation_transfer_requests where id=p_request_id;
  if not found then raise exception 'Nie znaleziono transferu.'; end if;
  if v_req.status <> 'pending' then raise exception 'Transfer został już rozpatrzony.'; end if;
  if v_req.to_dispatcher_id <> auth.uid() then raise exception 'Tylko wskazany odbiorca może zatwierdzić ten transfer.'; end if;

  select * into v_target from public.profiles where id=auth.uid() and active=true and role='dispatcher';
  v_target_login := private.tms_login_from_display_name(v_target.display_name);

  if v_status='accepted' then
    if p_assignment_id is null then raise exception 'Przy akceptacji wybierz własnego kierowcę/pojazd.'; end if;
    select * into v_assignment
    from public.fleet_assignments
    where id=p_assignment_id and active=true and assigned_dispatcher_id=auth.uid();
    if not found then raise exception 'Wybrany pojazd nie należy do odbiorcy transferu.'; end if;
    if v_assignment.branch_id is distinct from v_req.branch_id then raise exception 'Pojazd należy do innego oddziału.'; end if;

    update public.tms_relations
    set payload = (payload - 'transferToDispatcher') || jsonb_build_object(
        'ownerDispatcher',v_target_login,
        'driverId',v_assignment.id::text,
        'transferStatus','accepted',
        'transferRequestId',v_req.id::text,
        'transferredFromDispatcher',private.tms_login_from_display_name(v_req.from_dispatcher_name),
        'transferredAt',now()::text,
        'approvalStatus','accepted'
      ),
      updated_by=auth.uid(),updated_at=now()
    where branch_id=v_req.branch_id and relation_ref=v_req.relation_ref and active=true;
  else
    update public.tms_relations
    set payload = (payload - 'transferToDispatcher') || jsonb_build_object(
        'transferStatus','rejected',
        'transferRequestId',v_req.id::text
      ),
      updated_by=auth.uid(),updated_at=now()
    where branch_id=v_req.branch_id and relation_ref=v_req.relation_ref and active=true;
  end if;

  update public.tms_relation_transfer_requests
  set status=v_status, responded_at=now()
  where id=v_req.id;
  return true;
end;
$$;

revoke all on function public.request_tms_client_assignment(text,uuid) from public, anon;
revoke all on function public.respond_tms_client_assignment(uuid,text,text) from public, anon;
revoke all on function public.request_tms_relation_transfer(text,uuid,text) from public, anon;
revoke all on function public.respond_tms_relation_transfer(uuid,text,uuid) from public, anon;
grant execute on function public.request_tms_client_assignment(text,uuid) to authenticated;
grant execute on function public.respond_tms_client_assignment(uuid,text,text) to authenticated;
grant execute on function public.request_tms_relation_transfer(text,uuid,text) to authenticated;
grant execute on function public.respond_tms_relation_transfer(uuid,text,uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='tms_client_assignment_requests'
    ) then
      execute 'alter publication supabase_realtime add table public.tms_client_assignment_requests';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='tms_relation_transfer_requests'
    ) then
      execute 'alter publication supabase_realtime add table public.tms_relation_transfer_requests';
    end if;
  end if;
end $$;

commit;
