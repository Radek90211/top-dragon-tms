-- Asystent giełdy: dane własnego zespołu. Nie korzysta z API Trans.eu.
begin;
create table if not exists public.tms_exchange_records (
  branch_id uuid not null references public.branches(id),
  kind text not null check (kind in ('offer','client')),
  record_key text not null check (length(record_key) between 1 and 180),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=20000),
  owner_id uuid references public.profiles(id) on delete set null,
  owner_name text not null default '',
  version integer not null default 0,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(branch_id,kind,record_key)
);
create index if not exists tms_exchange_records_recent on public.tms_exchange_records(branch_id,updated_at desc);
alter table public.tms_exchange_records enable row level security;
drop policy if exists tms_exchange_records_read on public.tms_exchange_records;
create policy tms_exchange_records_read on public.tms_exchange_records for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true
  and (p.role::text='admin' or (p.branch_id=tms_exchange_records.branch_id and p.role::text in ('dispatcher','branch_manager','accounting')))));
revoke all on public.tms_exchange_records from anon,authenticated;
grant select on public.tms_exchange_records to authenticated;

create or replace function public.list_tms_exchange_records(p_branch_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at desc),'[]'::jsonb)
  from (select * from public.tms_exchange_records where branch_id=p_branch_id order by updated_at desc limit 1000) r;
$$;

create or replace function public.save_tms_exchange_record(
  p_branch_id uuid,p_kind text,p_key text,p_payload jsonb,p_version integer,p_action text default 'write'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor public.profiles%rowtype;
  item public.tms_exchange_records%rowtype;
begin
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if not found or actor.role::text not in ('admin','branch_manager','dispatcher') then raise exception 'Brak uprawnień do zapisu.'; end if;
  if p_branch_id is null or (actor.role::text<>'admin' and p_branch_id is distinct from actor.branch_id) then raise exception 'Brak dostępu do tego oddziału.'; end if;
  if p_kind not in ('offer','client') or p_key is null or length(trim(p_key)) not between 1 and 180 then raise exception 'Nieprawidłowy identyfikator.'; end if;
  if p_action not in ('write','claim','release') or (p_kind='client' and p_action<>'write') then raise exception 'Nieprawidłowa operacja.'; end if;
  if p_version is null or p_version<0 or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Nieprawidłowe dane.'; end if;

  insert into public.tms_exchange_records(branch_id,kind,record_key,payload,updated_by)
  values(p_branch_id,p_kind,trim(p_key),p_payload,actor.id) on conflict do nothing;
  select * into item from public.tms_exchange_records
  where branch_id=p_branch_id and kind=p_kind and record_key=trim(p_key) for update;
  if item.version<>p_version then raise exception 'Sprawa została zmieniona przez inną osobę. Odśwież dane przed zapisem.'; end if;
  if p_action='claim' then
    if item.owner_id is not null and item.owner_id<>actor.id then raise exception 'Ofertą zajmuje się już inna osoba.'; end if;
    item.owner_id:=actor.id;item.owner_name:=coalesce(nullif(actor.display_name,''),'Spedytor');
  elsif p_action='release' then
    if item.owner_id is not null and item.owner_id<>actor.id and actor.role::text<>'admin' then raise exception 'Tylko opiekun lub administrator może zwolnić ofertę.'; end if;
    item.owner_id:=null;item.owner_name:='';
  else
    item.payload:=p_payload;
  end if;
  update public.tms_exchange_records set payload=item.payload,owner_id=item.owner_id,owner_name=item.owner_name,
    version=item.version+1,updated_by=actor.id,updated_at=now()
  where branch_id=p_branch_id and kind=p_kind and record_key=trim(p_key) returning * into item;
  perform public.write_tms_operation_audit('exchange.'||p_action,'exchange_'||p_kind,p_key,'Wersja '||item.version::text);
  return to_jsonb(item);
end;
$$;
revoke all on function public.list_tms_exchange_records(uuid) from public,anon;
revoke all on function public.save_tms_exchange_record(uuid,text,text,jsonb,integer,text) from public,anon;
grant execute on function public.list_tms_exchange_records(uuid) to authenticated;
grant execute on function public.save_tms_exchange_record(uuid,text,text,jsonb,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
