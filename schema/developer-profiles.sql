-- DEVPAGES public developer identity and publishing attribution.
-- This migration has been applied to the production Supabase project.

create table if not exists public.developer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  bio text not null default '',
  website_url text,
  show_credit boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.developer_profiles enable row level security;
grant select on public.developer_profiles to anon, authenticated;
grant update (display_name, bio, website_url, show_credit, avatar_url) on public.developer_profiles to authenticated;

drop policy if exists "Developer profiles are public" on public.developer_profiles;
create policy "Developer profiles are public" on public.developer_profiles
for select to anon, authenticated using (true);

drop policy if exists "Developers update their own profile" on public.developer_profiles;
create policy "Developers update their own profile" on public.developer_profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.create_developer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text;
  base_slug text;
begin
  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'preferred_developer_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1),
    'Developer'
  );
  base_slug := trim(both '-' from regexp_replace(lower(chosen_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'developer'; end if;
  insert into public.developer_profiles (id, slug, display_name)
  values (new.id, base_slug || '-' || left(replace(new.id::text, '-', ''), 6), chosen_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.create_developer_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_developer_profile on auth.users;
create trigger on_auth_user_created_developer_profile
after insert on auth.users
for each row execute function public.create_developer_profile();

-- Backfill profiles for accounts created before this feature.
insert into public.developer_profiles (id, slug, display_name)
select
  u.id,
  coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(u.raw_user_meta_data ->> 'preferred_developer_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'developer')), '[^a-z0-9]+', '-', 'g')), ''), 'developer')
    || '-' || left(replace(u.id::text, '-', ''), 6),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'preferred_developer_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'Developer')
from auth.users u
on conflict (id) do nothing;


-- Public developer profile picture/logo.
alter table public.developer_profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('developer-avatars', 'developer-avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Developer avatar reads own folder" on storage.objects;
create policy "Developer avatar reads own folder"
on storage.objects for select to authenticated
using (bucket_id = 'developer-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Developer avatar uploads own folder" on storage.objects;
create policy "Developer avatar uploads own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'developer-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Developer avatar updates own folder" on storage.objects;
create policy "Developer avatar updates own folder"
on storage.objects for update to authenticated
using (bucket_id = 'developer-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'developer-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Developer avatar deletes own folder" on storage.objects;
create policy "Developer avatar deletes own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'developer-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
