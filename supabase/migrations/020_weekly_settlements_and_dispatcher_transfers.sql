-- Top Dragon TMS — Etap 3L.19
-- Tygodniowe wyrównania przewoźników oraz przelewy wyniku pomiędzy spedytorami.
-- Założenia:
-- 1) dodatnie wyrównanie przewoźnika zwiększa kwotę do wypłaty przewoźnikowi,
-- 2) zaakceptowany przelew obniża wynik nadawcy i zwiększa wynik odbiorcy,
-- 3) przelew zaczyna wpływać na statystyki dopiero po akceptacji odbiorcy,
-- 4) wszystkie zalogowane osoby mogą widzieć tygodniowe korekty i przelewy,
--    ale operacje zapisu są kontrolowane przez RPC i role.

begin;

create table if not exists public.tms_carrier_week_adjustments (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  branch_id uuid null references public.branches(id) on delete restrict,
  carrier_id uuid not null references public.carriers(id) on delete restrict,
  carrier_name text not null,
  amount numeric(14,2) not null,
  comment text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  constraint tms_carrier_week_adjustments_amount_check check (amount <> 0 and abs(amount) <= 10000000),
  constraint tms_carrier_week_adjustments_comment_check check (char_length(comment) <= 1200)
);

create index if not exists tms_carrier_week_adjustments_week_idx
  on public.tms_carrier_week_adjustments(week_start, active);
create index if not exists tms_carrier_week_adjustments_carrier_idx
  on public.tms_carrier_week_adjustments(carrier_id, week_start);

alter table public.tms_carrier_week_adjustments enable row level security;

drop policy if exists tms_carrier_week_adjustments_select_authenticated on public.tms_carrier_week_adjustments;
create policy tms_carrier_week_adjustments_select_authenticated
on public.tms_carrier_week_adjustments
for select
to authenticated
using (true);

revoke insert, update, delete on public.tms_carrier_week_adjustments from authenticated;
grant select on public.tms_carrier_week_adjustments to authenticated;

create table if not exists public.tms_dispatcher_week_transfers (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  from_dispatcher_id uuid not null references public.profiles(id) on delete restrict,
  to_dispatcher_id uuid not null references public.profiles(id) on delete restrict,
  from_branch_id uuid null references public.branches(id) on delete set null,
  to_branch_id uuid null references public.branches(id) on delete set null,
  amount numeric(14,2) not null,
  comment text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint tms_dispatcher_week_transfers_people_check check (from_dispatcher_id <> to_dispatcher_id),
  constraint tms_dispatcher_week_transfers_amount_check check (amount > 0 and amount <= 10000000),
  constraint tms_dispatcher_week_transfers_status_check check (status in ('pending','accepted','rejected','cancelled')),
  constraint tms_dispatcher_week_transfers_comment_check check (char_length(comment) <= 1200)
);

create index if not exists tms_dispatcher_week_transfers_week_idx
  on public.tms_dispatcher_week_transfers(week_start, status);
create index if not exists tms_dispatcher_week_transfers_to_idx
  on public.tms_dispatcher_week_transfers(to_dispatcher_id, status, week_start);
create index if not exists tms_dispatcher_week_transfers_from_idx
  on public.tms_dispatcher_week_transfers(from_dispatcher_id, status, week_start);

alter table public.tms_dispatcher_week_transfers enable row level security;

drop policy if exists tms_dispatcher_week_transfers_select_authenticated on public.tms_dispatcher_week_transfers;
create policy tms_dispatcher_week_transfers_select_authenticated
on public.tms_dispatcher_week_transfers
for select
to authenticated
using (true);

revoke insert, update, delete on public.tms_dispatcher_week_transfers from authenticated;
grant select on public.tms_dispatcher_week_transfers to authenticated;

create or replace function public.create_tms_carrier_week_adjustment(
  p_week_start date,
  p_carrier_id uuid,
  p_amount numeric,
  p_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_week_start date;
  v_carrier public.carriers%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  if v_role not in ('dispatcher','branch_manager','accounting','admin') then
    raise exception 'Brak uprawnień do dodawania wyrównań przewoźnika.';
  end if;
  if p_week_start is null or p_carrier_id is null then
    raise exception 'Wybierz tydzień i przewoźnika.';
  end if;
  if coalesce(p_amount,0) = 0 or abs(p_amount) > 10000000 then
    raise exception 'Kwota wyrównania musi być różna od zera.';
  end if;
  if char_length(coalesce(p_comment,'')) > 1200 then
    raise exception 'Komentarz jest zbyt długi.';
  end if;

  v_week_start := p_week_start - ((extract(isodow from p_week_start)::integer) - 1);

  select * into v_carrier
  from public.carriers
  where id = p_carrier_id and active = true;
  if not found then raise exception 'Nie znaleziono aktywnego przewoźnika.'; end if;

  if v_role = 'dispatcher' then
    if v_carrier.branch_id is distinct from private.tms_branch_id() then
      raise exception 'Spedytor może rozliczać przewoźników ze swojego oddziału.';
    end if;
    if not exists (
      select 1 from public.fleet_assignments fa
      where fa.carrier_id = p_carrier_id
        and fa.assigned_dispatcher_id = auth.uid()
        and fa.active = true
    ) then
      raise exception 'Spedytor może dodać wyrównanie tylko dla przewoźnika, którego prowadzi.';
    end if;
  elsif v_role = 'branch_manager' and v_carrier.branch_id is distinct from private.tms_branch_id() then
    raise exception 'Kierownik może rozliczać przewoźników swojego oddziału.';
  end if;

  insert into public.tms_carrier_week_adjustments(
    week_start, branch_id, carrier_id, carrier_name, amount, comment, created_by
  ) values (
    v_week_start,
    v_carrier.branch_id,
    v_carrier.id,
    v_carrier.name,
    round(p_amount::numeric,2),
    trim(coalesce(p_comment,'')),
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.archive_tms_carrier_week_adjustment(p_adjustment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_row public.tms_carrier_week_adjustments%rowtype;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  select * into v_row from public.tms_carrier_week_adjustments where id = p_adjustment_id and active = true;
  if not found then return false; end if;

  if v_role in ('admin','accounting') then
    null;
  elsif v_role = 'branch_manager' and v_row.branch_id = private.tms_branch_id() then
    null;
  elsif v_row.created_by = auth.uid() then
    null;
  else
    raise exception 'Możesz usunąć tylko własne wyrównanie.';
  end if;

  update public.tms_carrier_week_adjustments set active = false where id = v_row.id;
  return true;
end;
$$;

create or replace function public.create_tms_dispatcher_week_transfer(
  p_week_start date,
  p_to_dispatcher_id uuid,
  p_amount numeric,
  p_comment text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_start date;
  v_target public.profiles%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if private.tms_role() <> 'dispatcher' then
    raise exception 'Przelew wyniku może utworzyć wyłącznie spedytor.';
  end if;
  if p_to_dispatcher_id is null or p_to_dispatcher_id = auth.uid() then
    raise exception 'Wybierz innego spedytora.';
  end if;
  if coalesce(p_amount,0) <= 0 or p_amount > 10000000 then
    raise exception 'Kwota przelewu musi być większa od zera.';
  end if;
  if char_length(coalesce(p_comment,'')) > 1200 then
    raise exception 'Komentarz jest zbyt długi.';
  end if;

  select * into v_target
  from public.profiles
  where id = p_to_dispatcher_id
    and role = 'dispatcher'
    and active = true;
  if not found then raise exception 'Wybrany odbiorca nie jest aktywnym spedytorem.'; end if;

  v_week_start := p_week_start - ((extract(isodow from p_week_start)::integer) - 1);

  insert into public.tms_dispatcher_week_transfers(
    week_start, from_dispatcher_id, to_dispatcher_id,
    from_branch_id, to_branch_id, amount, comment
  ) values (
    v_week_start, auth.uid(), v_target.id,
    private.tms_branch_id(), v_target.branch_id,
    round(p_amount::numeric,2), trim(coalesce(p_comment,''))
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.respond_tms_dispatcher_week_transfer(
  p_transfer_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(trim(coalesce(p_status,'')));
  v_row public.tms_dispatcher_week_transfers%rowtype;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if private.tms_role() <> 'dispatcher' then
    raise exception 'Tylko spedytor może zaakceptować lub odrzucić przelew.';
  end if;
  if v_status not in ('accepted','rejected') then
    raise exception 'Nieprawidłowy status przelewu.';
  end if;

  select * into v_row from public.tms_dispatcher_week_transfers where id = p_transfer_id;
  if not found then raise exception 'Nie znaleziono przelewu.'; end if;
  if v_row.to_dispatcher_id <> auth.uid() then
    raise exception 'Tylko odbiorca może zatwierdzić ten przelew.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Ten przelew został już rozpatrzony.';
  end if;

  update public.tms_dispatcher_week_transfers
  set status = v_status, responded_at = now()
  where id = v_row.id;
  return true;
end;
$$;

create or replace function public.cancel_tms_dispatcher_week_transfer(p_transfer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tms_dispatcher_week_transfers%rowtype;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  select * into v_row from public.tms_dispatcher_week_transfers where id = p_transfer_id;
  if not found then return false; end if;
  if v_row.from_dispatcher_id <> auth.uid() and private.tms_role() <> 'admin' then
    raise exception 'Tylko nadawca może anulować oczekujący przelew.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Można anulować tylko przelew oczekujący.';
  end if;
  update public.tms_dispatcher_week_transfers
  set status = 'cancelled', responded_at = now()
  where id = v_row.id;
  return true;
end;
$$;

revoke all on function public.create_tms_carrier_week_adjustment(date, uuid, numeric, text) from public, anon;
revoke all on function public.archive_tms_carrier_week_adjustment(uuid) from public, anon;
revoke all on function public.create_tms_dispatcher_week_transfer(date, uuid, numeric, text) from public, anon;
revoke all on function public.respond_tms_dispatcher_week_transfer(uuid, text) from public, anon;
revoke all on function public.cancel_tms_dispatcher_week_transfer(uuid) from public, anon;

grant execute on function public.create_tms_carrier_week_adjustment(date, uuid, numeric, text) to authenticated;
grant execute on function public.archive_tms_carrier_week_adjustment(uuid) to authenticated;
grant execute on function public.create_tms_dispatcher_week_transfer(date, uuid, numeric, text) to authenticated;
grant execute on function public.respond_tms_dispatcher_week_transfer(uuid, text) to authenticated;
grant execute on function public.cancel_tms_dispatcher_week_transfer(uuid) to authenticated;

-- Realtime dla wspólnego tygodniowego podsumowania.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tms_carrier_week_adjustments'
  ) then
    alter publication supabase_realtime add table public.tms_carrier_week_adjustments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tms_dispatcher_week_transfers'
  ) then
    alter publication supabase_realtime add table public.tms_dispatcher_week_transfers;
  end if;
end $$;

commit;
