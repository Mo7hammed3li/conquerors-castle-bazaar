-- Public seller directory. Only approved sellers receive a public row.
create table public.seller_public_profiles (
  seller_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.seller_public_profiles enable row level security;
revoke all on public.seller_public_profiles from public, anon, authenticated;
grant select on public.seller_public_profiles to anon, authenticated;

create policy seller_public_profiles_read
  on public.seller_public_profiles for select to anon, authenticated
  using (true);

create or replace function public.sync_seller_public_profile()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare target_id uuid;
begin
  if tg_table_name = 'account_roles' then
    target_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    if tg_op = 'DELETE' then
      if old.role = 'seller' then
        delete from public.seller_public_profiles where seller_id = target_id;
      end if;
      return old;
    end if;
    if new.role = 'seller' then
      insert into public.seller_public_profiles (seller_id, display_name, created_at)
      select p.id, coalesce(nullif(trim(p.display_name), ''), 'Seller'), p.created_at
      from public.profiles p
      where p.id = new.user_id and p.is_banned = false
      on conflict (seller_id) do update set display_name = excluded.display_name;
    end if;
    return new;
  end if;

  target_id := new.id;
  if new.is_banned then
    delete from public.seller_public_profiles where seller_id = target_id;
  elsif exists (
    select 1 from public.account_roles ar
    where ar.user_id = target_id and ar.role = 'seller'
  ) then
    insert into public.seller_public_profiles (seller_id, display_name, created_at)
    values (target_id, coalesce(nullif(trim(new.display_name), ''), 'Seller'), new.created_at)
    on conflict (seller_id) do update set display_name = excluded.display_name;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_seller_public_profile() from public, anon, authenticated;

create trigger sync_seller_public_profile_role
  after insert or delete on public.account_roles
  for each row execute function public.sync_seller_public_profile();

create trigger sync_seller_public_profile_profile
  after update of display_name, is_banned on public.profiles
  for each row execute function public.sync_seller_public_profile();

insert into public.seller_public_profiles (seller_id, display_name, created_at)
select p.id, coalesce(nullif(trim(p.display_name), ''), 'Seller'), p.created_at
from public.profiles p
join public.account_roles ar on ar.user_id = p.id and ar.role = 'seller'
where p.is_banned = false
on conflict (seller_id) do update set display_name = excluded.display_name;

create view public.seller_directory with (security_invoker = true) as
select s.seller_id, s.display_name, s.created_at,
       count(l.id)::bigint as approved_listings
from public.seller_public_profiles s
left join public.listings l
  on l.user_id = s.seller_id
 and l.status = 'approved'
 and l.archived_at is null
group by s.seller_id, s.display_name, s.created_at;

grant select on public.seller_directory to anon, authenticated;
