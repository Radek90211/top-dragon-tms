-- ETAP 1: użytkownicy, oddziały, role i bezpieczny szkielet audytu.
-- Uruchom w Supabase SQL Editor na projekcie TESTOWYM.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('dispatcher', 'branch_manager', 'accounting', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'dispatcher',
  branch_id uuid references public.branches(id),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operation_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

insert into public.branches(name)
values ('Oddział 1'), ('Oddział 2'), ('Oddział 3')
on conflict (name) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.operation_audit enable row level security;

revoke all on public.branches from anon;
revoke all on public.profiles from anon;
revoke all on public.operation_audit from anon;

grant select on public.branches to authenticated;
grant select on public.profiles to authenticated;
grant select on public.operation_audit to authenticated;

create policy "authenticated_read_active_branches"
on public.branches for select
to authenticated
using (active = true or public.is_admin());

create policy "users_read_own_profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "admins_read_all_profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

create policy "admins_update_profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins_read_audit"
on public.operation_audit for select
to authenticated
using (public.is_admin());

-- Nie dodajemy polityki INSERT/UPDATE/DELETE dla operation_audit z klienta.
-- Docelowo wpisy będą tworzone wyłącznie przez triggery/funkcje serwerowe.
