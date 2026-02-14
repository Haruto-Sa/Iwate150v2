-- Supabase schema for Iwate150 (PostgreSQL)
-- Storage bucket: iwate150data

create extension if not exists pgcrypto;

create table if not exists public.cities (
  id serial primary key,
  name text not null,
  name_kana text,
  region text,
  image_thumb_path text,
  image_path text
);

create table if not exists public.genres (
  id serial primary key,
  name text not null,
  image_thumb_path text,
  image_path text
);

create table if not exists public.spots (
  id serial primary key,
  name text not null,
  description text not null,
  city_id integer references public.cities (id) on delete set null,
  genre_id integer references public.genres (id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  image_thumb_path text,
  image_path text,
  model_path text,
  reference_url text
);

create table if not exists public.events (
  id serial primary key,
  title text not null,
  location text,
  start_date date,
  end_date date,
  city_id integer references public.cities (id) on delete set null
);

create table if not exists public.users (
  id serial primary key,
  auth_id uuid unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stamps (
  id serial primary key,
  user_id integer references public.users (id) on delete cascade,
  spot_id integer references public.spots (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_spots_city on public.spots (city_id);
create index if not exists idx_spots_genre on public.spots (genre_id);
create index if not exists idx_events_city on public.events (city_id);
create unique index if not exists idx_stamps_user_spot on public.stamps (user_id, spot_id);

do $$
begin
  alter table public.users add constraint users_auth_id_key unique (auth_id);
exception
  when duplicate_object then null;
end $$;

alter table public.cities add column if not exists image_thumb_path text;
alter table public.genres add column if not exists image_thumb_path text;
alter table public.spots add column if not exists image_thumb_path text;

comment on table public.spots is 'Tourism spots across Iwate. image_thumb_path/image_path/model_path support Storage-relative paths (images/*, models/*).';
comment on table public.events is 'Event schedule derived from legacy CSV.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.cities enable row level security;
alter table public.genres enable row level security;
alter table public.spots enable row level security;
alter table public.events enable row level security;
alter table public.users enable row level security;
alter table public.stamps enable row level security;

drop policy if exists "public read cities" on public.cities;
create policy "public read cities"
  on public.cities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read genres" on public.genres;
create policy "public read genres"
  on public.genres
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read spots" on public.spots;
create policy "public read spots"
  on public.spots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public read events" on public.events;
create policy "public read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "user can read own profile" on public.users;
create policy "user can read own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = auth_id);

drop policy if exists "user can insert own profile" on public.users;
create policy "user can insert own profile"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = auth_id);

drop policy if exists "user can update own profile" on public.users;
create policy "user can update own profile"
  on public.users
  for update
  to authenticated
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

drop policy if exists "user can read own stamps" on public.stamps;
create policy "user can read own stamps"
  on public.stamps
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = stamps.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "user can insert own stamps" on public.stamps;
create policy "user can insert own stamps"
  on public.stamps
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      where u.id = stamps.user_id
        and u.auth_id = auth.uid()
    )
  );

drop policy if exists "user can delete own stamps" on public.stamps;
create policy "user can delete own stamps"
  on public.stamps
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = stamps.user_id
        and u.auth_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Auth user sync (auth.users -> public.users)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'User')
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.users (auth_id, display_name)
select
  au.id,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1), 'User')
from auth.users au
where not exists (
  select 1
  from public.users pu
  where pu.auth_id = au.id
);

-- ---------------------------------------------------------------------------
-- Storage bucket and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('iwate150data', 'iwate150data', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public bucket read" on storage.objects;
create policy "public bucket read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'iwate150data');

drop policy if exists "public bucket insert authenticated" on storage.objects;
create policy "public bucket insert authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'iwate150data');

drop policy if exists "public bucket update authenticated" on storage.objects;
create policy "public bucket update authenticated"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'iwate150data')
  with check (bucket_id = 'iwate150data');

drop policy if exists "public bucket delete authenticated" on storage.objects;
create policy "public bucket delete authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'iwate150data');
