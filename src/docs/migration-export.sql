-- ============================================================
-- TRAKALOG — Full Schema Migration Export
-- Compatible with Supabase SQL Editor (PostgreSQL 15+)
-- Generated: 2026-03-11
--
-- Execution order:
--   1. ENUMs
--   2. Tables (dependency order)
--   3. Indexes
--   4. Triggers (updated_at)
--   5. SECURITY DEFINER functions
--   6. Enable RLS + Policies
--   7. Trigger handle_new_user (depends on tables + functions)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────

create type public.app_role as enum (
  'admin','manager','a_r','assistant','producer',
  'songwriter','musician','mix_engineer','mastering_engineer',
  'publisher','viewer'
);

create type public.approval_status as enum ('pending','approved','rejected');
create type public.link_status as enum ('active','expired','disabled');
create type public.notification_type as enum (
  'pitch_opened','pitch_accepted','pitch_declined',
  'track_uploaded','track_status_changed',
  'link_opened','link_downloaded',
  'approval_requested','approval_resolved',
  'member_invited','member_joined','comment_added'
);
create type public.pitch_status as enum ('draft','sent','opened','declined','accepted');
create type public.share_type as enum ('stems','track','playlist','pack');
create type public.stem_type as enum (
  'kick','snare','bass','guitar','vocal','synth',
  'drums','background_vocal','fx','other'
);
create type public.track_gender as enum ('male','female','duet','n_a');
create type public.track_status as enum ('available','on_hold','released');
create type public.track_type as enum ('instrumental','sample','acapella','song');

-- ────────────────────────────────────────────────────────────
-- 2. TABLES (dependency order)
-- ────────────────────────────────────────────────────────────

-- workspaces (root table — no FK dependencies)
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  owner_id   uuid not null,
  plan       text not null default 'free',
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- workspace_members (depends on: workspaces)
create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  unique (user_id, workspace_id)
);

-- user_roles (depends on: workspaces)
create table public.user_roles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role         app_role not null,
  unique (user_id, workspace_id, role)
);

-- tracks (depends on: workspaces)
create table public.tracks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  artist       text not null,
  featuring    text,
  genre        text,
  bpm          smallint,
  key          text,
  duration_sec integer,
  mood         text[] default '{}'::text[],
  gender       track_gender,
  status       track_status not null default 'available',
  track_type   track_type not null default 'song',
  isrc         text,
  iswc         text,
  language     text default 'Instrumental',
  labels       text[] default '{}'::text[],
  publishers   text[] default '{}'::text[],
  audio_url    text,
  cover_url    text,
  lyrics       text,
  notes        text,
  splits       jsonb default '[]'::jsonb,
  waveform_data jsonb,
  released_at  timestamptz,
  uploaded_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- stems (depends on: workspaces, tracks)
create table public.stems (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  track_id        uuid not null references public.tracks(id) on delete cascade,
  file_name       text not null,
  file_url        text not null,
  stem_type       stem_type not null default 'other',
  file_size_bytes bigint,
  duration_sec    integer,
  sample_rate     integer,
  bit_depth       smallint,
  uploaded_by     uuid,
  created_at      timestamptz not null default now()
);

-- playlists (depends on: workspaces)
create table public.playlists (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  cover_url    text,
  is_public    boolean not null default false,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- playlist_tracks (depends on: playlists, tracks)
create table public.playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id    uuid not null references public.tracks(id) on delete cascade,
  position    smallint not null default 0,
  added_by    uuid,
  added_at    timestamptz not null default now(),
  unique (playlist_id, track_id)
);

-- contacts (depends on: workspaces)
create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  role         text,
  company      text,
  notes        text,
  tags         text[] default '{}'::text[],
  favorite     boolean not null default false,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- shared_links (depends on: workspaces, tracks, playlists)
create table public.shared_links (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  share_type       share_type not null,
  track_id         uuid references public.tracks(id) on delete set null,
  playlist_id      uuid references public.playlists(id) on delete set null,
  link_name        text not null,
  link_slug        text not null unique,
  link_type        text not null default 'public',
  allow_download   boolean not null default false,
  download_quality text,
  password_hash    text,
  message          text,
  pack_items       jsonb default '[]'::jsonb,
  expires_at       timestamptz,
  status           link_status not null default 'active',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- pitches (depends on: workspaces, contacts, shared_links)
create table public.pitches (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  contact_id        uuid references public.contacts(id) on delete set null,
  share_link_id     uuid references public.shared_links(id) on delete set null,
  recipient_name    text not null,
  recipient_email   text,
  recipient_company text,
  subject           text not null,
  message           text,
  track_ids         uuid[] not null default '{}'::uuid[],
  status            pitch_status not null default 'draft',
  sent_by           uuid,
  sent_at           timestamptz,
  opened_at         timestamptz,
  responded_at      timestamptz,
  response_note     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- link_downloads (depends on: shared_links)
create table public.link_downloads (
  id               uuid primary key default gen_random_uuid(),
  link_id          uuid not null references public.shared_links(id) on delete cascade,
  downloader_name  text,
  downloader_email text,
  organization     text,
  role             text,
  track_name       text,
  stems_downloaded text[] default '{}'::text[],
  ip_address       inet,
  user_agent       text,
  downloaded_at    timestamptz not null default now()
);

-- approvals (depends on: workspaces, tracks)
create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  track_id      uuid not null references public.tracks(id) on delete cascade,
  requested_by  uuid,
  reviewed_by   uuid,
  status        approval_status not null default 'pending',
  changes       jsonb not null default '{}'::jsonb,
  review_note   text,
  requested_at  timestamptz not null default now(),
  reviewed_at   timestamptz
);

-- notifications (depends on: workspaces, tracks, pitches, shared_links, approvals)
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null,
  type         notification_type not null,
  title        text not null,
  message      text,
  is_read      boolean not null default false,
  track_id     uuid references public.tracks(id) on delete set null,
  pitch_id     uuid references public.pitches(id) on delete set null,
  link_id      uuid references public.shared_links(id) on delete set null,
  approval_id  uuid references public.approvals(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────────────────────────

create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_ws on public.workspace_members(workspace_id);
create index idx_user_roles_user_ws on public.user_roles(user_id, workspace_id);
create index idx_tracks_ws_status on public.tracks(workspace_id, status);
create index idx_tracks_ws_genre on public.tracks(workspace_id, genre);
create index idx_stems_track on public.stems(track_id);
create index idx_stems_ws on public.stems(workspace_id);
create index idx_playlists_ws on public.playlists(workspace_id);
create index idx_playlist_tracks_playlist on public.playlist_tracks(playlist_id, position);
create index idx_contacts_ws on public.contacts(workspace_id);
create index idx_contacts_ws_email on public.contacts(workspace_id, email);
create index idx_pitches_ws_status on public.pitches(workspace_id, status);
create index idx_shared_links_ws on public.shared_links(workspace_id);
create index idx_shared_links_slug on public.shared_links(link_slug);
create index idx_link_downloads_link on public.link_downloads(link_id);
create index idx_notifications_user on public.notifications(user_id, is_read);
create index idx_notifications_ws on public.notifications(workspace_id);
create index idx_approvals_ws_status on public.approvals(workspace_id, status);
create index idx_approvals_track on public.approvals(track_id);

-- ────────────────────────────────────────────────────────────
-- 4. TRIGGERS — updated_at
-- ────────────────────────────────────────────────────────────

create or replace function public.update_updated_at_column()
returns trigger language plpgsql
set search_path = 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.workspaces
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.tracks
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.playlists
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.contacts
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.pitches
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.shared_links
  for each row execute function public.update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 5. SECURITY DEFINER FUNCTIONS
--    (created AFTER tables they reference exist)
-- ────────────────────────────────────────────────────────────

-- Workspace membership check (references: workspace_members)
create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id
  );
$$;

-- Single role check (references: user_roles)
create or replace function public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = _role
  );
$$;

-- Multi-role check (references: user_roles)
create or replace function public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = any(_roles)
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 6. ENABLE RLS + POLICIES
-- ────────────────────────────────────────────────────────────

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.user_roles enable row level security;
alter table public.tracks enable row level security;
alter table public.stems enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.contacts enable row level security;
alter table public.pitches enable row level security;
alter table public.shared_links enable row level security;
alter table public.link_downloads enable row level security;
alter table public.notifications enable row level security;
alter table public.approvals enable row level security;

-- ── workspaces ──
create policy "Members can view their workspace" on public.workspaces
  for select to authenticated using (public.is_workspace_member(auth.uid(), id));

create policy "Authenticated users can create workspaces" on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());

create policy "Admins can update workspace" on public.workspaces
  for update to authenticated
  using (public.has_workspace_role(auth.uid(), id, 'admin'))
  with check (public.has_workspace_role(auth.uid(), id, 'admin'));

create policy "Owner can delete workspace" on public.workspaces
  for delete to authenticated using (owner_id = auth.uid());

-- ── workspace_members ──
create policy "Members can view team" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Admins can invite members" on public.workspace_members
  for insert to authenticated with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can update members" on public.workspace_members
  for update to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can remove members" on public.workspace_members
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Members can leave workspace" on public.workspace_members
  for delete to authenticated using (user_id = auth.uid());

-- ── user_roles ──
create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy "Admins can view workspace roles" on public.user_roles
  for select to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can insert roles" on public.user_roles
  for insert to authenticated with check (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can update roles" on public.user_roles
  for update to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Admins can delete roles" on public.user_roles
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── tracks ──
create policy "Members can view tracks" on public.tracks
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Creators can upload tracks" on public.tracks
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','producer','songwriter','musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    and uploaded_by = auth.uid()
  );

create policy "Write roles can edit all tracks" on public.tracks
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Creators can edit own tracks" on public.tracks
  for update to authenticated using (
    uploaded_by = auth.uid() and public.is_workspace_member(auth.uid(), workspace_id)
  );

create policy "Admins can delete tracks" on public.tracks
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── stems ──
create policy "Members can view stems" on public.stems
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Creators can upload stems" on public.stems
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','producer','songwriter','musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    and uploaded_by = auth.uid()
  );

create policy "Write roles can edit stems" on public.stems
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Creators can edit own stems" on public.stems
  for update to authenticated using (
    uploaded_by = auth.uid() and public.is_workspace_member(auth.uid(), workspace_id)
  );

create policy "Admins can delete stems" on public.stems
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── playlists ──
create policy "Members can view playlists" on public.playlists
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create playlists" on public.playlists
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
    and created_by = auth.uid()
  );

create policy "Write roles can edit playlists" on public.playlists
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete playlists" on public.playlists
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── playlist_tracks ──
create policy "Members can view playlist tracks" on public.playlist_tracks
  for select to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_tracks.playlist_id and public.is_workspace_member(auth.uid(), p.workspace_id))
  );

create policy "Write roles can add playlist tracks" on public.playlist_tracks
  for insert to authenticated with check (
    exists (select 1 from public.playlists p where p.id = playlist_tracks.playlist_id
      and public.has_any_workspace_role(auth.uid(), p.workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[]))
  );

create policy "Write roles can update playlist tracks" on public.playlist_tracks
  for update to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_tracks.playlist_id
      and public.has_any_workspace_role(auth.uid(), p.workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[]))
  );

create policy "Admins can delete playlist tracks" on public.playlist_tracks
  for delete to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_tracks.playlist_id
      and public.has_workspace_role(auth.uid(), p.workspace_id, 'admin'))
  );

-- ── contacts ──
create policy "Members can view contacts" on public.contacts
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create contacts" on public.contacts
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Write roles can edit contacts" on public.contacts
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete contacts" on public.contacts
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── pitches ──
create policy "Members can view pitches" on public.pitches
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create pitches" on public.pitches
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
    and sent_by = auth.uid()
  );

create policy "Write roles can update pitches" on public.pitches
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete pitches" on public.pitches
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ── shared_links ──
create policy "Members can view shared links" on public.shared_links
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create shared links" on public.shared_links
  for insert to authenticated with check (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
    and created_by = auth.uid()
  );

create policy "Write roles can update shared links" on public.shared_links
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete shared links" on public.shared_links
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

create policy "Creators can delete own shared links" on public.shared_links
  for delete to authenticated using (
    created_by = auth.uid() and public.is_workspace_member(auth.uid(), workspace_id)
  );

-- ── link_downloads ──
create policy "Members can view link downloads" on public.link_downloads
  for select to authenticated using (
    exists (select 1 from public.shared_links sl where sl.id = link_downloads.link_id and public.is_workspace_member(auth.uid(), sl.workspace_id))
  );

create policy "Anyone can log a download for valid links" on public.link_downloads
  for insert to anon, authenticated with check (
    exists (select 1 from public.shared_links sl where sl.id = link_downloads.link_id and sl.status = 'active')
  );

-- ── notifications ──
create policy "Users can view own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "System can create notifications" on public.notifications
  for insert to authenticated with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Users can mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid());

create policy "Users can delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ── approvals ──
create policy "Members can view approvals" on public.approvals
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Members can request approvals" on public.approvals
  for insert to authenticated with check (
    public.is_workspace_member(auth.uid(), workspace_id) and requested_by = auth.uid()
  );

create policy "Admins can update approvals" on public.approvals
  for update to authenticated using (
    public.has_any_workspace_role(auth.uid(), workspace_id, array['admin','manager']::app_role[])
  );

create policy "Admins can delete approvals" on public.approvals
  for delete to authenticated using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ────────────────────────────────────────────────────────────
-- 7. TRIGGER — handle_new_user (depends on all tables + functions)
-- ────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  ws_id uuid;
  user_slug text;
  user_name text;
begin
  user_name := split_part(new.email, '@', 1);
  user_slug := lower(regexp_replace(user_name, '[^a-z0-9]', '-', 'gi')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (id, name, slug, owner_id, plan, settings)
  values (
    gen_random_uuid(),
    user_name || '''s Workspace',
    user_slug,
    new.id,
    'free',
    '{"defaultLanguage":"en","allowPublicLinks":true,"requireApproval":false,"maxMembers":5,"storageQuotaMB":2048}'::jsonb
  )
  returning id into ws_id;

  insert into public.workspace_members (user_id, workspace_id)
  values (new.id, ws_id);

  insert into public.user_roles (user_id, workspace_id, role)
  values (new.id, ws_id, 'admin');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════
