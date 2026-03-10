# TRAKALOG — Supabase Schema Reference

> Schéma PostgreSQL complet pour la migration Supabase.
> Toutes les tables sont isolées par `workspace_id`. Les RLS policies sont documentées dans `supabase-rls-policy.md`.

---

## ENUM Types

```sql
-- Rôles applicatifs (par workspace)
create type public.app_role as enum (
  'admin', 'manager', 'a_r', 'assistant', 'producer',
  'songwriter', 'musician', 'mix_engineer', 'mastering_engineer',
  'publisher', 'viewer'
);

-- Plan de workspace
create type public.workspace_plan as enum ('free', 'pro', 'enterprise');

-- Statut d'un track
create type public.track_status as enum ('available', 'on_hold', 'released');

-- Type de track
create type public.track_type as enum ('instrumental', 'sample', 'acapella', 'song');

-- Statut d'un pitch
create type public.pitch_status as enum ('draft', 'sent', 'opened', 'declined', 'accepted');

-- Type de stem
create type public.stem_type as enum (
  'kick', 'snare', 'bass', 'guitar', 'vocal', 'synth',
  'drums', 'background_vocal', 'fx', 'other'
);

-- Type de lien partagé
create type public.share_type as enum ('stems', 'track', 'playlist', 'pack');

-- Statut de lien partagé
create type public.link_status as enum ('active', 'expired', 'disabled');

-- Statut d'approbation
create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- Statut d'invitation membre
create type public.member_status as enum ('active', 'pending', 'expired');

-- Type de notification
create type public.notification_type as enum (
  'pitch_opened', 'pitch_accepted', 'pitch_declined',
  'track_uploaded', 'track_status_changed',
  'link_opened', 'link_downloaded',
  'approval_requested', 'approval_resolved',
  'member_invited', 'member_joined',
  'comment_added'
);

-- Genre musical (optionnel — peut aussi rester text avec check constraint)
create type public.track_gender as enum ('male', 'female', 'duet', 'n_a');
```

---

## Table : `workspaces`

```sql
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  plan        workspace_plan not null default 'free',
  settings    jsonb not null default '{
    "defaultLanguage": "en",
    "allowPublicLinks": true,
    "requireApproval": false,
    "maxMembers": 5,
    "storageQuotaMB": 2048
  }'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create unique index idx_workspaces_slug on public.workspaces(slug);
create index idx_workspaces_owner on public.workspaces(owner_id);

alter table public.workspaces enable row level security;
```

---

## Table : `workspace_members`

```sql
create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  status        member_status not null default 'pending',
  invited_by    uuid references auth.users(id) on delete set null,
  joined_at     timestamptz not null default now(),

  unique (workspace_id, user_id)
);

-- Indexes
create index idx_wm_workspace on public.workspace_members(workspace_id);
create index idx_wm_user on public.workspace_members(user_id);

alter table public.workspace_members enable row level security;
```

---

## Table : `user_roles`

```sql
create table public.user_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  role          app_role not null,

  unique (user_id, workspace_id, role)
);

-- Indexes
create index idx_ur_user_workspace on public.user_roles(user_id, workspace_id);

alter table public.user_roles enable row level security;
```

---

## Table : `tracks`

```sql
create table public.tracks (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  uploaded_by     uuid references auth.users(id) on delete set null,

  -- Métadonnées principales
  title           text not null,
  artist          text not null,
  featuring       text,                          -- artistes feat.
  track_type      track_type not null default 'song',
  status          track_status not null default 'available',

  -- Métadonnées audio
  bpm             smallint check (bpm > 0 and bpm < 999),
  key             text,                          -- ex: "C Min", "Ab Maj"
  duration_sec    integer check (duration_sec > 0),
  genre           text,
  mood            text[] default '{}',           -- tags: ["dark","energetic"]
  language        text default 'Instrumental',
  gender          track_gender,

  -- Ownership
  labels          text[] default '{}',           -- ex: ["Nightfall Records"]
  publishers      text[] default '{}',           -- ex: ["Sony/ATV"]

  -- Fichiers
  audio_url       text,                          -- URL Storage Supabase
  cover_url       text,                          -- URL image pochette
  waveform_data   jsonb,                         -- peaks pour affichage

  -- Texte
  lyrics          text,
  notes           text,

  -- Splits (stockés en JSONB pour flexibilité)
  splits          jsonb default '[]'::jsonb,
  -- Format: [{"name":"Artist","role":"Songwriter","share":50,"publisher":"Sony"}]

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  released_at     timestamptz,

  -- Codes industrie
  isrc            text,
  iswc            text
);

-- Indexes
create index idx_tracks_workspace on public.tracks(workspace_id);
create index idx_tracks_status on public.tracks(workspace_id, status);
create index idx_tracks_genre on public.tracks(workspace_id, genre);
create index idx_tracks_artist on public.tracks(workspace_id, artist);
create index idx_tracks_bpm on public.tracks(workspace_id, bpm);
create index idx_tracks_uploaded_by on public.tracks(uploaded_by);
create index idx_tracks_created on public.tracks(workspace_id, created_at desc);

-- Full-text search sur titre + artiste
create index idx_tracks_fts on public.tracks
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(artist,'')));

alter table public.tracks enable row level security;
```

---

## Table : `playlists`

```sql
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

-- Indexes
create index idx_playlists_workspace on public.playlists(workspace_id);
create index idx_playlists_created_by on public.playlists(created_by);

alter table public.playlists enable row level security;
```

---

## Table : `playlist_tracks` (table de jointure)

```sql
create table public.playlist_tracks (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid references public.playlists(id) on delete cascade not null,
  track_id      uuid references public.tracks(id) on delete cascade not null,
  position      smallint not null default 0,      -- ordre dans la playlist
  added_at      timestamptz not null default now(),
  added_by      uuid references auth.users(id) on delete set null,

  unique (playlist_id, track_id)
);

-- Indexes
create index idx_pt_playlist on public.playlist_tracks(playlist_id);
create index idx_pt_track on public.playlist_tracks(track_id);
create index idx_pt_position on public.playlist_tracks(playlist_id, position);

alter table public.playlist_tracks enable row level security;
```

---

## Table : `contacts`

```sql
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  created_by      uuid references auth.users(id) on delete set null,

  first_name      text not null,
  last_name       text,
  email           text,
  phone           text,
  company         text,                          -- label, éditeur, management
  role            text,                          -- "A&R", "Manager", "Supervisor"
  tags            text[] default '{}',
  notes           text,
  favorite        boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index idx_contacts_workspace on public.contacts(workspace_id);
create index idx_contacts_email on public.contacts(workspace_id, email);
create index idx_contacts_company on public.contacts(workspace_id, company);

alter table public.contacts enable row level security;
```

---

## Table : `pitches`

```sql
create table public.pitches (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  sent_by         uuid references auth.users(id) on delete set null,

  -- Cible
  contact_id      uuid references public.contacts(id) on delete set null,
  recipient_name  text not null,
  recipient_email text,
  recipient_company text,

  -- Contenu
  subject         text not null,
  message         text,
  track_ids       uuid[] not null default '{}',  -- tracks envoyées

  -- Statut
  status          pitch_status not null default 'draft',
  sent_at         timestamptz,
  opened_at       timestamptz,
  responded_at    timestamptz,
  response_note   text,

  -- Lien
  share_link_id   uuid references public.shared_links(id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index idx_pitches_workspace on public.pitches(workspace_id);
create index idx_pitches_status on public.pitches(workspace_id, status);
create index idx_pitches_sent_by on public.pitches(sent_by);
create index idx_pitches_contact on public.pitches(contact_id);
create index idx_pitches_sent_at on public.pitches(workspace_id, sent_at desc);

alter table public.pitches enable row level security;
```

---

## Table : `stems`

```sql
create table public.stems (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  track_id        uuid references public.tracks(id) on delete cascade not null,
  uploaded_by     uuid references auth.users(id) on delete set null,

  file_name       text not null,
  stem_type       stem_type not null default 'other',
  file_url        text not null,                 -- URL Storage Supabase
  file_size_bytes bigint check (file_size_bytes > 0),
  duration_sec    integer,
  sample_rate     integer,                       -- ex: 44100, 48000, 96000
  bit_depth       smallint,                      -- ex: 16, 24, 32

  created_at      timestamptz not null default now()
);

-- Indexes
create index idx_stems_workspace on public.stems(workspace_id);
create index idx_stems_track on public.stems(track_id);
create index idx_stems_type on public.stems(track_id, stem_type);

alter table public.stems enable row level security;
```

---

## Table : `shared_links`

```sql
create table public.shared_links (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references public.workspaces(id) on delete cascade not null,
  created_by        uuid references auth.users(id) on delete set null,

  -- Type et cible
  share_type        share_type not null,
  track_id          uuid references public.tracks(id) on delete cascade,
  playlist_id       uuid references public.playlists(id) on delete cascade,

  -- Config
  link_name         text not null,
  link_slug         text not null unique,         -- identifiant public du lien
  link_type         text not null default 'public' check (link_type in ('public','secured')),
  password_hash     text,                         -- bcrypt hash si secured
  message           text,
  allow_download    boolean not null default false,
  download_quality  text check (download_quality in ('hi-res','low-res')),

  -- Expiration
  expires_at        timestamptz,
  status            link_status not null default 'active',

  -- Pack items (pour share_type = 'pack')
  pack_items        jsonb default '[]'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes
create index idx_sl_workspace on public.shared_links(workspace_id);
create index idx_sl_slug on public.shared_links(link_slug);
create index idx_sl_track on public.shared_links(track_id);
create index idx_sl_playlist on public.shared_links(playlist_id);
create index idx_sl_status on public.shared_links(workspace_id, status);

alter table public.shared_links enable row level security;
```

### Table : `link_downloads` (événements de téléchargement)

```sql
create table public.link_downloads (
  id                uuid primary key default gen_random_uuid(),
  link_id           uuid references public.shared_links(id) on delete cascade not null,
  downloader_name   text,
  downloader_email  text,
  organization      text,
  role              text,
  track_name        text,
  stems_downloaded  text[] default '{}',
  ip_address        inet,
  user_agent        text,
  downloaded_at     timestamptz not null default now()
);

create index idx_ld_link on public.link_downloads(link_id);
create index idx_ld_date on public.link_downloads(downloaded_at desc);

alter table public.link_downloads enable row level security;
```

---

## Table : `notifications`

```sql
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,

  type            notification_type not null,
  title           text not null,
  message         text,
  is_read         boolean not null default false,

  -- Références optionnelles
  track_id        uuid references public.tracks(id) on delete set null,
  pitch_id        uuid references public.pitches(id) on delete set null,
  link_id         uuid references public.shared_links(id) on delete set null,
  approval_id     uuid references public.approvals(id) on delete set null,

  created_at      timestamptz not null default now()
);

-- Indexes
create index idx_notif_user on public.notifications(user_id, is_read);
create index idx_notif_workspace on public.notifications(workspace_id);
create index idx_notif_created on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
```

---

## Table : `approvals`

```sql
create table public.approvals (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade not null,
  track_id        uuid references public.tracks(id) on delete cascade not null,

  requested_by    uuid references auth.users(id) on delete set null,
  reviewed_by     uuid references auth.users(id) on delete set null,

  status          approval_status not null default 'pending',
  requested_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  review_note     text,

  -- Snapshot des changements proposés
  changes         jsonb not null default '{}'::jsonb
  -- Format: {"status":"released","metadata":{"bpm":120}}
);

-- Indexes
create index idx_approvals_workspace on public.approvals(workspace_id);
create index idx_approvals_track on public.approvals(track_id);
create index idx_approvals_status on public.approvals(workspace_id, status);
create index idx_approvals_requested on public.approvals(requested_by);

alter table public.approvals enable row level security;
```

---

## Diagramme des relations (ERD simplifié)

```
auth.users
  ├─── workspaces (owner_id)
  ├─── workspace_members (user_id)
  ├─── user_roles (user_id)
  ├─── tracks (uploaded_by)
  ├─── playlists (created_by)
  ├─── pitches (sent_by)
  ├─── stems (uploaded_by)
  ├─── shared_links (created_by)
  ├─── approvals (requested_by, reviewed_by)
  └─── notifications (user_id)

workspaces
  ├─── workspace_members
  ├─── user_roles
  ├─── tracks
  │      ├─── stems
  │      ├─── approvals
  │      └─── shared_links (track_id)
  ├─── playlists
  │      ├─── playlist_tracks → tracks
  │      └─── shared_links (playlist_id)
  ├─── contacts
  │      └─── pitches (contact_id)
  ├─── pitches
  │      └─── shared_links (share_link_id)
  ├─── shared_links
  │      └─── link_downloads
  ├─── approvals
  └─── notifications
```

---

## Notes d'implémentation

1. **UUIDs partout** — aucun `serial`/`bigint` pour les IDs, facilite la réplication et les merges offline.
2. **`updated_at` automatique** — utiliser un trigger Supabase :
   ```sql
   create or replace function public.update_updated_at()
   returns trigger language plpgsql as $$
   begin
     new.updated_at = now();
     return new;
   end;
   $$;
   -- Appliquer sur chaque table ayant updated_at :
   create trigger trg_tracks_updated before update on public.tracks
     for each row execute function public.update_updated_at();
   ```
3. **Indexes composites** — `(workspace_id, ...)` pour que toutes les queries tenant-scoped utilisent l'index.
4. **JSONB pour flexibilité** — `splits`, `waveform_data`, `settings`, `changes` restent en JSONB pour itérer vite sans migrations.
5. **Storage Supabase** — `audio_url`, `cover_url`, `file_url` pointent vers des buckets Storage avec policies par workspace.
6. **Soft delete** (optionnel futur) — ajouter `deleted_at timestamptz` sur `tracks`, `playlists`, `contacts` si besoin de corbeille.
