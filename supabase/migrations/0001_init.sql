-- LUMEN — production schema (Supabase / PostgreSQL).
-- The web demo mirrors this model in src/backend (local store + api.ts acting as RLS/Edge Functions).

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums
create type album_privacy as enum ('private', 'invite', 'link', 'public', 'nft');
create type album_theme   as enum ('classic', 'lavender', 'editorial', 'gallery', 'midnight');
create type member_role   as enum ('viewer', 'contributor');
create type invite_status as enum ('pending', 'accepted', 'revoked');
create type nft_standard  as enum ('ERC-721', 'ERC-1155');

-- ---------------------------------------------------------------- users
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  username    text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_path text,
  bio         text check (char_length(bio) <= 160),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- albums & photos
create table albums (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 60),
  description   text not null default '',
  theme         album_theme not null default 'classic',
  privacy       album_privacy not null default 'private',
  category      text,
  cover_photo_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table photos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  original_path text not null,           -- private bucket: originals/{owner}/{id}
  thumb_path    text not null,           -- private bucket: thumbs/{owner}/{id}.jpg
  mime_type     text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  width         int, height int,
  file_name     text not null,
  caption       text not null default '' check (char_length(caption) <= 280),
  exif_stripped boolean not null default true, -- location EXIF is never exposed by default
  status        text not null default 'pending' check (status in ('pending','ready','failed')),
  created_at    timestamptz not null default now()
);

create table album_photos (
  album_id  uuid references albums(id) on delete cascade,
  photo_id  uuid references photos(id) on delete cascade,
  position  int not null,
  added_by  uuid references auth.users(id),
  primary key (album_id, photo_id)
);
alter table albums add constraint albums_cover_fk foreign key (cover_photo_id) references photos(id) on delete set null;

create table album_themes (
  id    album_theme primary key,
  label text not null,
  tokens jsonb not null
);

create table favorites (
  user_id  uuid references auth.users(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);

-- ---------------------------------------------------------------- sharing
create table album_invitations (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references albums(id) on delete cascade,
  email      citext not null,
  role       member_role not null default 'viewer',
  status     invite_status not null default 'pending',
  token_hash text not null,
  created_at timestamptz not null default now(),
  unique (album_id, email)
);

create table album_permissions (
  album_id   uuid references albums(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       member_role not null,
  granted_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create table share_links (
  id            uuid primary key default gen_random_uuid(),
  album_id      uuid not null references albums(id) on delete cascade,
  token_hash    text unique not null,      -- only the hash is stored; token shown once
  enabled       boolean not null default true,
  expires_at    timestamptz,
  passcode_hash text,
  role          member_role not null default 'viewer' check (role = 'viewer'),
  view_count    int not null default 0,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

-- ---------------------------------------------------------------- web3
create table wallet_connections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  address     text not null check (address ~* '^0x[0-9a-f]{40}$'),
  chain_id    int not null,
  verified_at timestamptz not null,       -- set only after server-side SIWE signature check
  unique (user_id, address, chain_id)
);

create table wallet_nonces (
  nonce      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

create table nft_assets (
  id        uuid primary key default gen_random_uuid(),
  chain_id  int not null,
  contract  text not null,
  token_id  numeric not null,
  standard  nft_standard not null,
  name      text, collection text, image_url text,
  simulated boolean not null default false,
  unique (chain_id, contract, token_id)
);

create table album_nft_links (
  album_id  uuid primary key references albums(id) on delete cascade,
  nft_id    uuid not null references nft_assets(id),
  linked_by uuid not null references auth.users(id),
  linked_at timestamptz not null default now()
);

create table nft_access_policies (
  album_id    uuid primary key references albums(id) on delete cascade,
  nft_id      uuid not null references nft_assets(id),
  min_balance numeric not null default 1,
  grant_ttl_seconds int not null default 600
);

create table nft_access_grants (
  album_id   uuid references albums(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  wallet     text not null,
  expires_at timestamptz not null,
  primary key (album_id, user_id)
);

create table audit_events (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references auth.users(id) on delete set null,
  action    text not null,
  target_id uuid,
  meta      jsonb not null default '{}',
  at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- access function (single source of truth)
create or replace function can_view_album(a albums, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    a.owner_id = uid
    or a.privacy = 'public'
    or (a.privacy = 'invite' and exists (select 1 from album_permissions p where p.album_id = a.id and p.user_id = uid))
    or (a.privacy = 'nft' and exists (select 1 from nft_access_grants g where g.album_id = a.id and g.user_id = uid and g.expires_at > now()));
  -- 'link' access is never granted by RLS: share links are resolved by the `open-share-link` Edge Function.
$$;

-- ---------------------------------------------------------------- RLS
alter table user_profiles      enable row level security;
alter table albums             enable row level security;
alter table photos             enable row level security;
alter table album_photos       enable row level security;
alter table favorites          enable row level security;
alter table album_invitations  enable row level security;
alter table album_permissions  enable row level security;
alter table share_links        enable row level security;
alter table wallet_connections enable row level security;
alter table wallet_nonces      enable row level security;
alter table album_nft_links    enable row level security;
alter table nft_access_policies enable row level security;
alter table nft_access_grants  enable row level security;
alter table audit_events       enable row level security;

create policy "profiles readable" on user_profiles for select using (true);
create policy "own profile" on user_profiles for update using (id = auth.uid());

create policy "view albums" on albums for select using (can_view_album(albums, auth.uid()));
create policy "own albums write" on albums for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "view photos" on photos for select using (
  owner_id = auth.uid() or exists (
    select 1 from album_photos ap join albums a on a.id = ap.album_id
    where ap.photo_id = photos.id and can_view_album(a, auth.uid())));
create policy "own photos write" on photos for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "view album_photos" on album_photos for select using (
  exists (select 1 from albums a where a.id = album_id and can_view_album(a, auth.uid())));
create policy "owner/contributor add" on album_photos for insert with check (
  exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid())
  or exists (select 1 from album_permissions p where p.album_id = album_id and p.user_id = auth.uid() and p.role = 'contributor'));
create policy "owner manage album_photos" on album_photos for update using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));
create policy "owner delete album_photos" on album_photos for delete using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));

create policy "own favorites" on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner manages invitations" on album_invitations for all using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));
create policy "owner manages permissions" on album_permissions for all using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));
create policy "member sees own permission" on album_permissions for select using (user_id = auth.uid());
create policy "owner manages links" on share_links for all using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));

create policy "own wallets read" on wallet_connections for select using (user_id = auth.uid());
create policy "own wallets delete" on wallet_connections for delete using (user_id = auth.uid());
-- inserts into wallet_connections / nft_access_grants happen only via Edge Functions (service role).

create policy "owner manages nft link" on album_nft_links for all using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));
create policy "view nft link" on album_nft_links for select using (exists (select 1 from albums a where a.id = album_id and (a.owner_id = auth.uid() or a.privacy in ('public','nft'))));
create policy "owner manages policy" on nft_access_policies for all using (exists (select 1 from albums a where a.id = album_id and a.owner_id = auth.uid()));
create policy "own grants read" on nft_access_grants for select using (user_id = auth.uid());
create policy "own audit read" on audit_events for select using (actor_id = auth.uid());

-- ---------------------------------------------------------------- storage (private bucket)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "owner reads own objects" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "owner deletes own objects" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[2] = auth.uid()::text);
-- Non-owners never read storage directly: the `photo-url` Edge Function checks can_view_album()
-- (or a valid share link / NFT grant) and returns a signed URL that expires in 5 minutes.

-- ---------------------------------------------------------------- housekeeping
-- Orphaned uploads (status = 'pending' older than 24h) are removed by a scheduled job (pg_cron):
-- select cron.schedule('cleanup-orphans', '0 * * * *', $$delete from photos where status = 'pending' and created_at < now() - interval '24 hours'$$);
