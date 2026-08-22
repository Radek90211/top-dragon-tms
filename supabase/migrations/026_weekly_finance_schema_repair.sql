-- Top Dragon TMS — Etap 3L.37
-- Naprawa schematu tygodniowych rozliczeń po częściowym/nieudanym wdrożeniu 025.
-- Migracja jest idempotentna: można ją uruchomić niezależnie od tego, czy 025
-- wykonała się w całości, częściowo, czy nie wykonała się wcale.

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

-- Kolumny 3L.36 dodajemy bez FK w tej samej instrukcji. Dzięki temu naprawa nie
-- może wycofać się przez różnicę historycznego constraintu w istniejącym projekcie.
alter table public.tms_carrier_week_adjustments
  add column if not exists driver_id uuid null,
  add column if not exists driver_name text null;

create index if not exists tms_carrier_week_adjustments_week_idx
  on public.tms_carrier_week_adjustments(week_start, active);
create index if not exists tms_carrier_week_adjustments_carrier_idx
  on public.tms_carrier_week_adjustments(carrier_id, week_start);
create index if not exists tms_carrier_week_adjustments_driver_week_idx
  on public.tms_carrier_week_adjustments(driver_id, week_start)
  where active = true;

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
  constraint tms_dispatcher_week_transfers_comment_check check (char_length(comment) <= 1200)
);

alter table public.tms_dispatcher_week_transfers
  add column if not exists recipient_approved_at timestamptz null,
  add column if not exists recipient_approved_by uuid null,
  add column if not exists from_manager_approved_at timestamptz null,
  add column if not exists from_manager_approved_by uuid null,
  add column if not exists to_manager_approved_at timestamptz null,
  add column if not exists to_manager_approved_by uuid null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists rejected_at timestamptz null,
  add column if not exists rejected_by uuid null;

create index if not exists tms_dispatcher_week_transfers_week_idx
  on public.tms_dispatcher_week_transfers(week_start, status);
create index if not exists tms_dispatcher_week_transfers_to_idx
  on public.tms_dispatcher_week_transfers(to_dispatcher_id, status, week_start);
create index if not exists tms_dispatcher_week_transfers_from_idx
  on public.tms_dispatcher_week_transfers(from_dispatcher_id, status, week_start);

alter table public.tms_dispatcher_week_transfers
  drop constraint if exists tms_dispatcher_week_transfers_status_check;

update public.tms_dispatcher_week_transfers
set status = 'deleted',
    deleted_at = coalesce(deleted_at, responded_at, created_at)
where status = 'cancelled';

alter table public.tms_dispatcher_week_transfers
  add constraint tms_dispatcher_week_transfers_status_check
  check (status in ('pending','accepted','rejected','deleted'));

update public.tms_dispatcher_week_transfers
set recipient_approved_at = coalesce(recipient_approved_at, responded_at, created_at),
    recipient_approved_by = coalesce(recipient_approved_by, to_dispatcher_id),
    from_manager_approved_at = coalesce(from_manager_approved_at, responded_at, created_at),
    to_manager_approved_at = coalesce(to_manager_approved_at, responded_at, created_at)
where status = 'accepted';

alter table public.tms_carrier_week_adjustments enable row level security;
alter table public.tms_dispatcher_week_transfers enable row level security;

drop policy if exists tms_carrier_week_adjustments_select_authenticated on public.tms_carrier_week_adjustments;
create policy tms_carrier_week_adjustments_select_authenticated
on public.tms_carrier_week_adjustments for select to authenticated using (true);

drop policy if exists tms_dispatcher_week_transfers_select_authenticated on public.tms_dispatcher_week_transfers;
create policy tms_dispatcher_week_transfers_select_authenticated
on public.tms_dispatcher_week_transfers for select to authenticated using (true);

revoke insert, update, delete on public.tms_carrier_week_adjustments from authenticated;
revoke insert, update, delete on public.tms_dispatcher_week_transfers from authenticated;
grant select on public.tms_carrier_week_adjustments to authenticated;
grant select on public.tms_dispatcher_week_transfers to authenticated;

create or replace function public.create_tms_carrier_week_adjustment_v2(
  p_week_start date,
  p_carrier_id uuid,
  p_driver_id uuid,
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
  v_driver public.drivers%rowtype;
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

  if p_driver_id is not null then
    select * into v_driver
    from public.drivers
    where id = p_driver_id and active = true;
    if not found then raise exception 'Nie znaleziono aktywnego kierowcy.'; end if;
    if v_driver.carrier_id is distinct from p_carrier_id then
      raise exception 'Kierowca nie należy do wybranego przewoźnika.';
    end if;
  end if;

  if v_role = 'dispatcher' then
    if v_carrier.branch_id is distinct from private.tms_branch_id() then
      raise exception 'Spedytor może rozliczać przewoźników ze swojego oddziału.';
    end if;
    if not exists (
      select 1 from public.fleet_assignments fa
      where fa.carrier_id = p_carrier_id
        and fa.assigned_dispatcher_id = auth.uid()
        and fa.active = true
        and (p_driver_id is null or fa.driver_id = p_driver_id)
    ) then
      raise exception 'Spedytor może dodać wyrównanie tylko dla przewoźnika/kierowcy, którego prowadzi.';
    end if;
  elsif v_role = 'branch_manager' and v_carrier.branch_id is distinct from private.tms_branch_id() then
    raise exception 'Kierownik może rozliczać przewoźników swojego oddziału.';
  end if;

  insert into public.tms_carrier_week_adjustments(
    week_start, branch_id, carrier_id, carrier_name, driver_id, driver_name,
    amount, comment, created_by
  ) values (
    v_week_start,
    v_carrier.branch_id,
    v_carrier.id,
    v_carrier.name,
    p_driver_id,
    case when p_driver_id is null then null else v_driver.full_name end,
    round(p_amount::numeric,2),
    trim(coalesce(p_comment,'')),
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Nowy przelew zawsze zaczyna jako oczekujący na trzy akceptacje.
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
    from_branch_id, to_branch_id, amount, comment, status,
    recipient_approved_at, recipient_approved_by,
    from_manager_approved_at, from_manager_approved_by,
    to_manager_approved_at, to_manager_approved_by,
    deleted_at, deleted_by, rejected_at, rejected_by, responded_at
  ) values (
    v_week_start, auth.uid(), v_target.id,
    private.tms_branch_id(), v_target.branch_id,
    round(p_amount::numeric,2), trim(coalesce(p_comment,'')), 'pending',
    null, null, null, null, null, null, null, null, null, null, null
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Odbiorca potwierdza lub odrzuca przelew. Finalne accepted pojawi się dopiero
-- po akceptacji kierowników obu oddziałów.
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
    raise exception 'Tylko spedytor-odbiorca może potwierdzić lub odrzucić przelew.';
  end if;
  if v_status not in ('accepted','rejected') then raise exception 'Nieprawidłowy status przelewu.'; end if;

  select * into v_row from public.tms_dispatcher_week_transfers where id = p_transfer_id;
  if not found then raise exception 'Nie znaleziono przelewu.'; end if;
  if v_row.to_dispatcher_id <> auth.uid() then raise exception 'Tylko odbiorca może potwierdzić ten przelew.'; end if;
  if v_row.status <> 'pending' then raise exception 'Ten przelew nie oczekuje już na decyzję.'; end if;

  if v_status = 'rejected' then
    update public.tms_dispatcher_week_transfers
    set status='rejected', rejected_at=now(), rejected_by=auth.uid(), responded_at=now()
    where id=v_row.id;
    return true;
  end if;

  update public.tms_dispatcher_week_transfers
  set recipient_approved_at = coalesce(recipient_approved_at, now()),
      recipient_approved_by = coalesce(recipient_approved_by, auth.uid())
  where id=v_row.id;

  update public.tms_dispatcher_week_transfers
  set status='accepted', responded_at=now()
  where id=v_row.id
    and status='pending'
    and recipient_approved_at is not null
    and from_manager_approved_at is not null
    and to_manager_approved_at is not null;

  return true;
end;
$$;

create or replace function public.approve_tms_dispatcher_week_transfer_manager(
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
  v_role text;
  v_branch uuid;
  v_row public.tms_dispatcher_week_transfers%rowtype;
  v_can_from boolean := false;
  v_can_to boolean := false;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  v_role := private.tms_role();
  v_branch := private.tms_branch_id();
  if v_role not in ('branch_manager','admin') then
    raise exception 'Decyzję kierownika może wykonać kierownik oddziału lub administrator.';
  end if;
  if v_status not in ('accepted','rejected') then raise exception 'Nieprawidłowy status decyzji.'; end if;

  select * into v_row from public.tms_dispatcher_week_transfers where id=p_transfer_id;
  if not found then raise exception 'Nie znaleziono przelewu.'; end if;
  if v_row.status <> 'pending' then raise exception 'Ten przelew nie oczekuje już na akceptację.'; end if;

  if v_role = 'admin' then
    v_can_from := true;
    v_can_to := true;
  else
    v_can_from := v_row.from_branch_id is not distinct from v_branch;
    v_can_to := v_row.to_branch_id is not distinct from v_branch;
  end if;
  if not v_can_from and not v_can_to then
    raise exception 'Ten przelew nie dotyczy Twojego oddziału.';
  end if;

  if v_status = 'rejected' then
    update public.tms_dispatcher_week_transfers
    set status='rejected', rejected_at=now(), rejected_by=auth.uid(), responded_at=now()
    where id=v_row.id;
    return true;
  end if;

  update public.tms_dispatcher_week_transfers
  set from_manager_approved_at = case when v_can_from then coalesce(from_manager_approved_at, now()) else from_manager_approved_at end,
      from_manager_approved_by = case when v_can_from then coalesce(from_manager_approved_by, auth.uid()) else from_manager_approved_by end,
      to_manager_approved_at = case when v_can_to then coalesce(to_manager_approved_at, now()) else to_manager_approved_at end,
      to_manager_approved_by = case when v_can_to then coalesce(to_manager_approved_by, auth.uid()) else to_manager_approved_by end
  where id=v_row.id;

  update public.tms_dispatcher_week_transfers
  set status='accepted', responded_at=now()
  where id=v_row.id
    and status='pending'
    and recipient_approved_at is not null
    and from_manager_approved_at is not null
    and to_manager_approved_at is not null;

  return true;
end;
$$;

create or replace function public.delete_tms_dispatcher_week_transfer(p_transfer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tms_dispatcher_week_transfers%rowtype;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  select * into v_row from public.tms_dispatcher_week_transfers where id=p_transfer_id;
  if not found then return false; end if;
  if v_row.to_dispatcher_id <> auth.uid() then
    raise exception 'Tylko spedytor, do którego wysłano pieniądze, może usunąć przelew.';
  end if;
  if v_row.status = 'deleted' then return false; end if;

  update public.tms_dispatcher_week_transfers
  set status='deleted', deleted_at=now(), deleted_by=auth.uid()
  where id=v_row.id;
  return true;
end;
$$;

-- Stary endpoint anulowania pozostaje kompatybilny z cache starszych klientów,
-- ale respektuje nową zasadę: tylko odbiorca może usunąć przelew.
create or replace function public.cancel_tms_dispatcher_week_transfer(p_transfer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.delete_tms_dispatcher_week_transfer(p_transfer_id);
end;
$$;

revoke all on function public.create_tms_carrier_week_adjustment_v2(date,uuid,uuid,numeric,text) from public, anon;
revoke all on function public.approve_tms_dispatcher_week_transfer_manager(uuid,text) from public, anon;
revoke all on function public.delete_tms_dispatcher_week_transfer(uuid) from public, anon;
grant execute on function public.create_tms_carrier_week_adjustment_v2(date,uuid,uuid,numeric,text) to authenticated;
grant execute on function public.create_tms_dispatcher_week_transfer(date,uuid,numeric,text) to authenticated;
grant execute on function public.respond_tms_dispatcher_week_transfer(uuid,text) to authenticated;
grant execute on function public.cancel_tms_dispatcher_week_transfer(uuid) to authenticated;
grant execute on function public.approve_tms_dispatcher_week_transfer_manager(uuid,text) to authenticated;
grant execute on function public.delete_tms_dispatcher_week_transfer(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
