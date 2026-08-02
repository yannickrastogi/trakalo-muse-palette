-- ═══════════════════════════════════════════════════════
-- TRAKALOG — Tables: tracks, playlists, playlist_tracks, contacts
-- ═══════════════════════════════════════════════════════

-- 1. ENUMs
create type public.track_status as enum ('available', 'on_hold', 'released');
create type public.track_type as enum ('instrumental', 'sample', 'acapella', 'song');
create type public.track_gender as enum ('male', 'female', 'duet', 'n_a');

-- ═══════════════════════════════════════════════════════
-- 2. Table: tracks
-- ═══════════════════════════════════════════════════════
create table public.tracks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  uploaded_by     uuid references auth.users(id) on delete set null,
  title           text not null,
  artist          text not null,
  featuring       text,
  track_type      track_type not null default 'song',
  status          track_status not null default 'available',
  bpm             smallint check (bpm > 0 and bpm < 999),
  key             text,
  duration_sec    integer check (duration_sec > 0),
  genre           text,
  mood            text[] default '{}',
  language        text default 'Instrumental',
  gender          track_gender,
  labels          text[] default '{}',
  publishers      text[] default '{}',
  audio_url       text,
  cover_url       text,
  waveform_data   jsonb,
  lyrics          text,
  notes           text,
  splits          jsonb default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  released_at     timestamptz,
  isrc            text,
  iswc            text
);
alter table public.tracks enable row level security;

create index idx_tracks_workspace on public.tracks(workspace_id);
create index idx_tracks_status on public.tracks(workspace_id, status);
create index idx_tracks_genre on public.tracks(workspace_id, genre);
create index idx_tracks_artist on public.tracks(workspace_id, artist);
create index idx_tracks_bpm on public.tracks(workspace_id, bpm);
create index idx_tracks_uploaded_by on public.tracks(uploaded_by);
create index idx_tracks_created on public.tracks(workspace_id, created_at desc);
create index idx_tracks_fts on public.tracks
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(artist,'')));

create trigger update_tracks_updated_at
  before update on public.tracks
  for each row execute function public.update_updated_at_column();

-- RLS: tracks
create policy "Members can view tracks"
  on public.tracks for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Creators can upload tracks"
  on public.tracks for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','producer','songwriter',
            'musician','mix_engineer','mastering_engineer','publisher']::app_role[])
    and uploaded_by = auth.uid()
  );

create policy "Write roles can edit all tracks"
  on public.tracks for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Creators can edit own tracks"
  on public.tracks for update to authenticated
  using (
    uploaded_by = auth.uid()
    and public.is_workspace_member(auth.uid(), workspace_id)
  );

create policy "Admins can delete tracks"
  on public.tracks for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ═══════════════════════════════════════════════════════
-- 3. Table: playlists
-- ═══════════════════════════════════════════════════════
create table public.playlists (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  created_by      uuid references auth.users(id) on delete set null,
  name            text not null,
  description     text,
  cover_url       text,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.playlists enable row level security;

create index idx_playlists_workspace on public.playlists(workspace_id);
create index idx_playlists_created_by on public.playlists(created_by);

create trigger update_playlists_updated_at
  before update on public.playlists
  for each row execute function public.update_updated_at_column();

-- RLS: playlists
create policy "Members can view playlists"
  on public.playlists for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create playlists"
  on public.playlists for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
    and created_by = auth.uid()
  );

create policy "Write roles can edit playlists"
  on public.playlists for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete playlists"
  on public.playlists for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- ═══════════════════════════════════════════════════════
-- 4. Table: playlist_tracks
-- ═══════════════════════════════════════════════════════
create table public.playlist_tracks (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid references public.playlists(id) on delete cascade not null,
  track_id      uuid references public.tracks(id) on delete cascade not null,
  position      smallint not null default 0,
  added_at      timestamptz not null default now(),
  added_by      uuid references auth.users(id) on delete set null,
  unique (playlist_id, track_id)
);
alter table public.playlist_tracks enable row level security;

create index idx_pt_playlist on public.playlist_tracks(playlist_id);
create index idx_pt_track on public.playlist_tracks(track_id);
create index idx_pt_position on public.playlist_tracks(playlist_id, position);

-- RLS: playlist_tracks inherits from playlist access
create policy "Members can view playlist tracks"
  on public.playlist_tracks for select to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

create policy "Write roles can add playlist tracks"
  on public.playlist_tracks for insert to authenticated
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and public.has_any_workspace_role(auth.uid(), p.workspace_id,
          array['admin','manager','a_r','assistant','publisher']::app_role[])
    )
  );

create policy "Write roles can update playlist tracks"
  on public.playlist_tracks for update to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and public.has_any_workspace_role(auth.uid(), p.workspace_id,
          array['admin','manager','a_r','assistant','publisher']::app_role[])
    )
  );

create policy "Admins can delete playlist tracks"
  on public.playlist_tracks for delete to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and public.has_workspace_role(auth.uid(), p.workspace_id, 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════
-- 5. Table: contacts
-- ═══════════════════════════════════════════════════════
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  created_by      uuid references auth.users(id) on delete set null,
  first_name      text not null,
  last_name       text,
  email           text,
  phone           text,
  company         text,
  role            text,
  tags            text[] default '{}',
  notes           text,
  favorite        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.contacts enable row level security;

create index idx_contacts_workspace on public.contacts(workspace_id);
create index idx_contacts_email on public.contacts(workspace_id, email);
create index idx_contacts_company on public.contacts(workspace_id, company);

create trigger update_contacts_updated_at
  before update on public.contacts
  for each row execute function public.update_updated_at_column();

-- RLS: contacts
create policy "Members can view contacts"
  on public.contacts for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Write roles can create contacts"
  on public.contacts for insert to authenticated
  with check (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Write roles can edit contacts"
  on public.contacts for update to authenticated
  using (
    public.has_any_workspace_role(auth.uid(), workspace_id,
      array['admin','manager','a_r','assistant','publisher']::app_role[])
  );

create policy "Admins can delete contacts"
  on public.contacts for delete to authenticated
  using (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
