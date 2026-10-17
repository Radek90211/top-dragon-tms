-- Indywidualne włączanie funkcji przez administratora.
alter table public.profiles
  add column if not exists feature_permissions jsonb not null default '{}'::jsonb;

create or replace function public.get_tms_feature_permissions()
returns table(user_id uuid, feature_permissions jsonb)
language sql
security definer
set search_path = public
as $$
  select p.id, coalesce(p.feature_permissions, '{}'::jsonb)
  from public.profiles p
  where p.active
    and (
      p.id = auth.uid()
      or exists (
        select 1 from public.profiles actor
        where actor.id = auth.uid() and actor.active and actor.role = 'admin'
      )
    );
$$;

create or replace function public.set_tms_user_feature_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles actor
    where actor.id = auth.uid() and actor.active and actor.role = 'admin'
  ) then
    raise exception 'Brak uprawnień administratora.';
  end if;

  update public.profiles
  set feature_permissions = coalesce(p_permissions, '{}'::jsonb)
  where id = p_user_id;

  if not found then
    raise exception 'Nie znaleziono użytkownika.';
  end if;
end;
$$;

revoke all on function public.get_tms_feature_permissions() from public;
grant execute on function public.get_tms_feature_permissions() to authenticated;
revoke all on function public.set_tms_user_feature_permissions(uuid, jsonb) from public;
grant execute on function public.set_tms_user_feature_permissions(uuid, jsonb) to authenticated;
