# 03 - Data Architecture

> **Status:** Draft  
> **Version:** 1.0.0  
> **Created:** August 11, 2026  
> **Last Updated:** August 11, 2026  
> **Owner:** Ishan  
> **Related:** [01 - Vision & Overview](01-VISION_AND_OVERVIEW.md), [02 - System Architecture](02-SYSTEM_ARCHITECTURE.md), [06 - Security Architecture](06-SECURITY_ARCHITECTURE.md), [RPCS.md](../RPCS.md)

---

## Abstract

This document provides a comprehensive overview of Trakalog's data architecture, including database schema, entity relationships, Row-Level Security (RLS) policies, storage organization, and data flow patterns. It serves as the primary reference for understanding how data is structured and protected in Trakalog.

---

## 1. Database Overview

### 1.1 Database System

| Property | Value |
|----------|-------|
| **Database** | PostgreSQL 17.6 |
| **Provider** | Supabase |
| **Project ID** | `mdokdfljnruitfnnmkif` |
| **Deployment** | Managed cloud database |
| **Backup** | Automated daily backups |

### 1.2 Schema Organization

**Primary Schema:** `public`

All application tables and functions reside in the public schema. Supabase extensions (auth, storage) use their own schemas (`auth`, `storage`).

```sql
-- Schema structure
public               -- Application tables and functions
auth                 -- Supabase Auth tables (users, providers)
storage              -- Supabase Storage metadata
pg_catalog           -- PostgreSQL system catalog
information_schema   -- Database metadata
```

---

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    %% Users and Authentication
    auth.users ||--o{ profiles : has
    auth.users ||--o{ workspace_members : belongs_to
    auth.users ||--o{ user_roles : has
    
    %% Workspaces
    workspaces ||--o{ workspace_members : contains
    workspaces ||--o{ tracks : owns
    workspaces ||--o{ playlists : owns
    workspaces ||--o{ contacts : owns
    workspaces ||--o{ shared_links : creates
    workspaces ||--o{ catalog_shares : source
    workspaces ||--o{ catalog_shares : target
    
    %% Tracks
    tracks ||--o{ stems : has
    tracks ||--o{ documents : has
    tracks ||--o{ track_comments : has
    tracks ||--o{ splits : has
    tracks ||--o{ playlist_tracks : in
    tracks ||--o{ catalog_shares : shared
    tracks ||--o{ studio_submissions : captures
    
    %% Playlists
    playlists ||--o{ playlist_tracks : contains
    
    %% Sharing
    shared_links ||--o{ shared_links_access : accessed_by
    
    %% Catalog Sharing
    catalog_shares ||--|| workspaces : source_workspace
    catalog_shares ||--|| workspaces : target_workspace
    catalog_shares ||--|| tracks : track
    
    %% Team
    workspace_members ||--|| auth.users : user
    workspace_members ||--|| workspaces : workspace
    user_roles ||--|| workspace_members : member
    
    %% Other
    contacts ||--o{ contact_aliases : has
    pitches ||--o{ pitch_tracks : contains
    approvals ||--|| tracks : track
    notifications ||--|| auth.users : recipient
    audit_logs ||--|| auth.users : user
    rate_limits ||--o{ } : tracks_by_key
```

---

## 3. Core Tables

### 3.1 Authentication Tables (Supabase Auth)

Managed by Supabase Auth service:

#### `auth.users`

The primary user table. Contains authentication data and basic profile information.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key, user identifier |
| `instance_id` | uuid | NO | Supabase instance identifier |
| `aud` | text | NO | Audience (default: 'authenticated') |
| `created_at` | timestamptz | NO | Account creation timestamp |
| `updated_at` | timestamptz | NO | Last update timestamp |
| `email` | text | YES | User email (unique when not null) |
| `email_confirmed_at` | timestamptz | YES | Email confirmation timestamp |
| `phone` | text | YES | Phone number |
| `phone_confirmed_at` | timestamptz | YES | Phone confirmation timestamp |
| `last_sign_in_at` | timestamptz | YES | Last login timestamp |
| `raw_app_meta_data` | jsonb | YES | Custom user metadata |
| `raw_user_meta_data` | jsonb | YES | User metadata from OAuth providers |
| `is_sso_user` | boolean | NO | Whether user signed up via SSO |
| `is_anonymous` | boolean | NO | Whether user is anonymous |
| `banned_until` | timestamptz | YES | Account suspension end time |
| `reauthentication_timeout` | timestamptz | YES | Reauthentication timeout |
| `recovery_sent_at` | timestamptz | YES | Password recovery timestamp |

#### `auth.providers`

OAuth provider configurations and user provider links.

#### `auth.refresh_tokens`

Refresh token storage for session management.

#### `auth.sessions`

Active user sessions.

---

### 3.2 User Profile Tables

#### `profiles`

Extended user profile information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key (references auth.users.id) |
| `email` | text | YES | | Email (denormalized from auth.users) |
| `first_name` | text | YES | | User's first name |
| `last_name` | text | YES | | User's last name |
| `avatar_url` | text | YES | | Profile picture URL |
| `bio` | text | YES | | User biography |
| `phone` | text | YES | | Phone number |
| `created_at` | timestamptz | NO | now() | Profile creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Index:** `profiles_email_idx` (email) - For fast lookup

---

### 3.3 Workspace Tables

#### `workspaces`

The container for all user content. Each user can own multiple workspaces.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `name` | text | NO | | Workspace display name |
| `slug` | text | YES | | URL-friendly workspace identifier |
| `description` | text | YES | | Workspace description |
| `created_by` | uuid | NO | | Owner user ID (references auth.users.id) |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |
| `is_personal` | boolean | NO | false | Whether this is the user's personal workspace |
| `is_archived` | boolean | NO | false | Whether workspace is archived |
| `settings` | jsonb | YES | '{}' | Workspace settings (approval mode, etc.) |
| `hero_image_url` | text | YES | | Hero/background image URL |
| `logo_url` | text | YES | | Logo image URL |
| `brand_color` | text | YES | | Primary brand color (hex) |
| `hero_position` | text | YES | 'center' | Hero image positioning |
| `hero_focal_point` | jsonb | YES | | Hero image focal point coordinates |
| `social_instagram` | text | YES | | Instagram URL |
| `social_tiktok` | text | YES | | TikTok URL |
| `social_youtube` | text | YES | | YouTube URL |
| `social_facebook` | text | YES | | Facebook URL |
| `social_x` | text | YES | | X/Twitter URL |

**Indexes:**
- `workspaces_created_by_idx` (created_by)
- `workspaces_slug_idx` (slug) - Unique
- `workspaces_name_idx` (name)

#### `workspace_members`

Users who have access to a workspace and their permissions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | References workspaces.id |
| `user_id` | uuid | NO | | References auth.users.id |
| `access_level` | text | NO | 'viewer' | Permission level: viewer, editor, admin |
| `professional_title` | text | YES | | Job title (display only, no permissions) |
| `invited_by` | uuid | YES | | User who invited this member |
| `invited_at` | timestamptz | YES | | Invitation timestamp |
| `joined_at` | timestamptz | YES | | When user accepted invitation |
| `created_at` | timestamptz | NO | now() | Record creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `workspace_members_workspace_id_user_id_idx` (workspace_id, user_id) - Unique (one membership per user per workspace)
- `workspace_members_user_id_idx` (user_id)
- `workspace_members_workspace_id_idx` (workspace_id)

#### `user_roles`

Professional titles available for users (reference data, not permissions).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | References auth.users.id |
| `workspace_id` | uuid | NO | References workspaces.id |
| `role` | app_role | NO | Professional title (enum: admin, manager, a_r, etc.) |

**Note:** These are **display titles only** and do NOT grant any permissions. Permissions are determined solely by `workspace_members.access_level`.

---

### 3.4 Track Tables

#### `tracks`

The central entity in Trakalog - represents a music track.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Owning workspace ID |
| `created_by` | uuid | NO | | User who created the track |
| `title` | text | NO | | Track title |
| `artist` | text | NO | | Primary artist name |
| `featuring` | text | YES | | Featuring artists (comma-separated) |
| `type` | text | YES | | Track type: song, instrumental, sample, acapella |
| `status` | text | YES | 'draft' | Track status: draft, ready, released, archived |
| `bpm` | numeric | YES | | Beats per minute |
| `key` | text | YES | | Musical key (e.g., 'C minor', 'A major') |
| `genre` | text[] | YES | | Array of genres |
| `mood` | text[] | YES | | Array of mood tags |
| `language` | text | YES | | Primary language |
| `isrc` | text | YES | | International Standard Recording Code |
| `upc` | text | YES | | Universal Product Code |
| `copyright` | text | YES | | Copyright information |
| `publisher` | text[] | YES | | Array of publisher names |
| `label` | text[] | YES | | Array of label names |
| `explicit` | boolean | NO | false | Whether track contains explicit content |
| `duration` | numeric | YES | | Duration in seconds |
| `file_path` | text | YES | | Original audio file path in R2 |
| `file_size` | bigint | YES | | Original file size in bytes |
| `audio_preview_url` | text | YES | | URL to 128kbps MP3 preview |
| `cover_url` | text | YES | | Cover art image URL |
| `waveform_data` | jsonb | YES | | Waveform visualization data |
| `lyrics` | text | YES | | Track lyrics |
| `notes` | text | YES | | Internal notes |
| `tags` | text[] | YES | | Custom tags |
| `sonic_dna` | jsonb | YES | | Audio analysis results from Railway service |
| `completeness` | numeric | YES | 0 | Metadata completeness percentage (0-100) |
| `qr_token` | text | YES | | Token for studio QR code |
| `chapters` | jsonb | YES | | Timecoded sections/chapters |
| `splits` | jsonb | YES | | Split percentages by collaborator |
| `version` | integer | NO | 1 | Track version number |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |
| `is_deleted` | boolean | NO | false | Soft delete flag |
| `deleted_at` | timestamptz | YES | | Soft delete timestamp |

**Indexes:**
- `tracks_workspace_id_idx` (workspace_id)
- `tracks_created_by_idx` (created_by)
- `tracks_isrc_idx` (isrc) - Unique
- `tracks_workspace_id_is_deleted_idx` (workspace_id, is_deleted)

#### `track_versions`

Track version history for change tracking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `track_id` | uuid | NO | References tracks.id |
| `version_number` | integer | NO | Version number (auto-incrementing) |
| `title` | text | YES | Title at this version |
| `artist` | text | YES | Artist at this version |
| `metadata_snapshot` | jsonb | YES | Complete metadata snapshot |
| `created_at` | timestamptz | NO | now() | Version creation timestamp |

#### `track_tags`

Normalized tags for tracks (many-to-many relationship).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `track_id` | uuid | NO | References tracks.id |
| `tag` | text | NO | Tag name |
| `type` | text | YES | Tag type/category |

---

### 3.5 Stems Tables

#### `stems`

Component audio files attached to tracks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | NO | | Parent track ID |
| `name` | text | NO | | Stem name (e.g., 'Drums', 'Vocals') |
| `stem_type` | stem_type | YES | | Stem category (enum: drums, bass, vocals, etc.) |
| `file_url` | text | NO | | R2 storage URL for stem file |
| `file_path` | text | YES | | File path in R2 bucket |
| `file_size` | bigint | YES | | File size in bytes |
| `duration` | numeric | YES | | Stem duration in seconds |
| `created_by` | uuid | YES | | User who uploaded the stem |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `stems_track_id_idx` (track_id)

---

### 3.6 Playlist Tables

#### `playlists`

Ordered collections of tracks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Owning workspace ID |
| `created_by` | uuid | NO | | User who created the playlist |
| `name` | text | NO | | Playlist name |
| `description` | text | YES | | Playlist description |
| `cover_url` | text | YES | | Playlist cover image URL |
| `is_public` | boolean | NO | false | Whether playlist is publicly shareable |
| `position` | integer | YES | | Sort order |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |
| `is_deleted` | boolean | NO | false | Soft delete flag |

**Indexes:**
- `playlists_workspace_id_idx` (workspace_id)
- `playlists_created_by_idx` (created_by)

#### `playlist_tracks`

Many-to-many relationship between playlists and tracks with ordering.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `playlist_id` | uuid | NO | | References playlists.id |
| `track_id` | uuid | NO | | References tracks.id |
| `position` | integer | NO | | Position in playlist (0-based) |
| `added_by` | uuid | YES | | User who added the track |
| `added_at` | timestamptz | NO | now() | When track was added |

**Indexes:**
- `playlist_tracks_playlist_id_position_idx` (playlist_id, position) - For ordered queries
- `playlist_tracks_playlist_id_idx` (playlist_id)
- `playlist_tracks_track_id_idx` (track_id)

---

### 3.7 Sharing Tables

#### `shared_links`

URLs for sharing tracks, playlists, stems, or packs externally.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Creating workspace ID |
| `created_by` | uuid | NO | | User who created the link |
| `share_type` | share_type | NO | | Type: track, playlist, stems, pack |
| `link_name` | text | YES | | Human-readable link name |
| `link_slug` | text | NO | | URL slug (unique) |
| `link_type` | text | YES | | Link classification |
| `track_id` | uuid | YES | | Shared track ID (for track/stems shares) |
| `playlist_id` | uuid | YES | | Shared playlist ID |
| `password_hash` | text | YES | | PBKDF2 hashed password |
| `message` | text | YES | | Custom message for recipients |
| `allow_download` | boolean | NO | true | Whether downloads are enabled |
| `allow_save` | boolean | NO | true | Whether recipients can save to their Trakalog |
| `download_quality` | text | YES | 'high' | Download quality: low, medium, high |
| `expires_at` | timestamptz | YES | | Expiration timestamp |
| `disabled` | boolean | NO | false | Whether link is disabled |
| `disabled_at` | timestamptz | YES | | When link was disabled |
| `pack_items` | jsonb | YES | | Items included in pack shares |
| `branding_overrides` | jsonb | YES | | Custom branding for this link |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Indexes:**
- `shared_links_link_slug_idx` (link_slug) - Unique
- `shared_links_workspace_id_idx` (workspace_id)
- `shared_links_created_by_idx` (created_by)
- `shared_links_share_type_idx` (share_type)
- `shared_links_track_id_idx` (track_id)
- `shared_links_playlist_id_idx` (playlist_id)

#### `shared_links_access`

Logs of who accessed shared links.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `link_id` | uuid | NO | References shared_links.id |
| `name` | text | YES | Recipient name |
| `email` | text | YES | Recipient email |
| `role` | text | YES | Recipient role |
| `company` | text | YES | Recipient company |
| `ip_address` | text | YES | Recipient IP address |
| `user_agent` | text | YES | Recipient browser/device |
| `accessed_at` | timestamptz | NO | now() | Access timestamp |
| `has_opted_in` | boolean | NO | false | Whether recipient opted into contact list |

**Indexes:**
- `shared_links_access_link_id_idx` (link_id)
- `shared_links_access_email_idx` (email)
- `shared_links_access_accessed_at_idx` (accessed_at)

---

### 3.8 Catalog Sharing Tables

#### `catalog_shares`

Workspace-to-workspace sharing of tracks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | YES | | Specific track being shared (NULL = entire catalog) |
| `source_workspace_id` | uuid | NO | | Workspace sharing the track/catalog |
| `target_workspace_id` | uuid | NO | | Workspace receiving the share |
| `shared_by` | uuid | NO | | User who created the share |
| `access_level` | text | NO | 'pitcher' | Access level: viewer, pitcher, editor, admin |
| `status` | text | NO | 'active' | Status: active, revoked |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `revoked_at` | timestamptz | YES | | When share was revoked |

**Indexes:**
- `catalog_shares_source_workspace_id_idx` (source_workspace_id)
- `catalog_shares_target_workspace_id_idx` (target_workspace_id)
- `catalog_shares_track_id_idx` (track_id)
- `catalog_shares_status_idx` (status)
- `catalog_shares_source_target_idx` (source_workspace_id, target_workspace_id)

---

### 3.9 Comment and Rating Tables

#### `track_comments`

Timecoded comments on tracks from recipients and team members.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | NO | | Commented track ID |
| `author_name` | text | NO | | Comment author name |
| `author_email` | text | YES | | Comment author email |
| `author_type` | text | YES | | Author type: team, recipient, guest |
| `timestamp_sec` | numeric | NO | | Timestamp in seconds (for waveform positioning) |
| `content` | text | NO | | Comment text content |
| `rating` | integer | YES | | Star rating (1-5) |
| `is_public` | boolean | NO | true | Whether comment is visible to recipient |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |
| `is_deleted` | boolean | NO | false | Soft delete flag |

**Indexes:**
- `track_comments_track_id_timestamp_idx` (track_id, timestamp_sec)
- `track_comments_track_id_idx` (track_id)

---

### 3.10 Contact Tables

#### `contacts`

Address book entries for workspaces.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Owning workspace ID |
| `created_by` | uuid | NO | | User who created the contact |
| `first_name` | text | NO | | First name |
| `last_name` | text | YES | | Last name |
| `email` | text | YES | | Email address |
| `role` | text | YES | | Professional role |
| `stage_name` | text | YES | | Stage/artist name |
| `company` | text | YES | | Company/organization |
| `phone` | text | YES | | Phone number |
| `pro` | text[] | YES | | Professional specialties |
| `ipi` | text | YES | | Interested Parties Information code |
| `publisher` | text | YES | | Publisher name |
| `notes` | text | YES | | Internal notes |
| `is_verified` | boolean | NO | false | Whether contact has verified their identity |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |
| `is_deleted` | boolean | NO | false | Soft delete flag |

**Indexes:**
- `contacts_workspace_id_idx` (workspace_id)
- `contacts_workspace_id_email_idx` (workspace_id, LOWER(email)) - Unique per workspace
- `contacts_created_by_idx` (created_by)

#### `contact_aliases`

Alternative names for contacts (e.g., artist names, stage names).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `contact_id` | uuid | NO | References contacts.id |
| `name` | text | NO | Alias name |
| `is_primary` | boolean | NO | Whether this is the primary display name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### 3.11 Split and Signature Tables

#### `splits`

Ownership percentages for tracks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | NO | | Track ID |
| `collaborator_name` | text | NO | | Collaborator name |
| `collaborator_email` | text | YES | | Collaborator email |
| `role` | text | YES | | Role in collaboration |
| `percentage` | numeric | NO | | Ownership percentage (0-100) |
| `ipi_code` | text | YES | | IPI code for rights management |
| `publisher` | text | YES | | Publisher name |
| `status` | text | NO | 'pending' | Status: pending, approved, rejected |
| `notes` | text | YES | | Internal notes |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Constraint:** Sum of percentages for a track must equal 100.

#### `signatures`

Digital signatures on split agreements.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `split_id` | uuid | NO | References splits.id |
| `signer_name` | text | NO | Signer name |
| `signer_email` | text | NO | Signer email |
| `signature_data` | text | YES | Base64-encoded signature image |
| `signed_at` | timestamptz | NO | now() | Signature timestamp |
| `ip_address` | text | YES | Signer IP address |
| `user_agent` | text | YES | Signer browser/device |

#### `studio_submissions`

Collaborator submissions captured via QR code in studio sessions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | NO | | Track being worked on |
| `name` | text | NO | | Collaborator name |
| `email` | text | NO | | Collaborator email |
| `role` | text | YES | | Professional role |
| `submitted_at` | timestamptz | NO | now() | Submission timestamp |
| `status` | text | NO | 'pending' | Status: pending, accepted, rejected |
| `accepted_by` | uuid | YES | | Admin who accepted/rejected |
| `accepted_at` | timestamptz | YES | | Acceptance timestamp |

---

### 3.12 Pitch and Approval Tables

#### `pitches`

Pitches sent to external recipients (currently flagged off in UI).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Sending workspace ID |
| `created_by` | uuid | NO | | User who created the pitch |
| `recipient_name` | text | NO | | Recipient name |
| `recipient_email` | text | NO | | Recipient email |
| `recipient_company` | text | YES | | Recipient company |
| `subject` | text | NO | | Pitch email subject |
| `message` | text | NO | | Pitch message content |
| `track_ids` | uuid[] | YES | | Array of track IDs included |
| `playlist_ids` | uuid[] | YES | | Array of playlist IDs included |
| `link_type` | text | YES | | Type of shared link created |
| `status` | pitch_status | NO | 'draft' | Status: draft, sent, opened, declined, accepted |
| `sent_at` | timestamptz | YES | | When pitch was sent |
| `opened_at` | timestamptz | YES | | When recipient opened pitch |
| `branding` | jsonb | YES | | Custom branding for pitch |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

#### `approvals`

Approval requests for track sends (currently flagged off in UI).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `workspace_id` | uuid | NO | | Workspace ID |
| `track_id` | uuid | NO | | Track needing approval |
| `created_by` | uuid | NO | | User requesting approval |
| `send_type` | text | NO | | Type of send (pitch, share, etc.) |
| `team_id` | uuid | YES | | Team member to approve |
| `status` | approval_status | NO | 'pending' | Status: pending, approved, rejected |
| `note` | text | YES | | Approval/rejection note |
| `resolved_by` | uuid | YES | | User who resolved approval |
| `resolved_at` | timestamptz | YES | | Resolution timestamp |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### 3.13 Billing and Usage Tables

#### `subscriptions`

User subscription and billing information.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | References auth.users.id |
| `plan_id` | text | NO | Stripe plan ID |
| `customer_id` | text | NO | Stripe customer ID |
| `subscription_id` | text | NO | Stripe subscription ID |
| `status` | text | NO | Subscription status |
| `current_period_end` | timestamptz | YES | End of current billing period |
| `cancel_at_period_end` | boolean | NO | Whether subscription will cancel at period end |
| `created_at` | timestamptz | NO | now() | Subscription creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

#### `plan_limits`

Feature limits by plan tier.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `plan_name` | text | NO | Plan name (free, starter, pro, business, enterprise) |
| `max_tracks` | integer | NO | Maximum number of tracks |
| `max_storage_bytes` | bigint | NO | Maximum storage in bytes |
| `max_workspaces` | integer | NO | Maximum workspaces per user |
| `max_seats` | integer | NO | Maximum seats per workspace |
| `max_shared_links` | integer | YES | Maximum shared links |
| `max_smart_ar_queries` | integer | YES | Maximum Smart A&R queries per period |
| `features` | jsonb | YES | Enabled features for this plan |

#### `usage_tracking`

Tracks user usage against plan limits.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | References auth.users.id |
| `workspace_id` | uuid | YES | Related workspace (if applicable) |
| `metric` | text | NO | Usage metric type (tracks, storage, smart_ar, etc.) |
| `value` | numeric | NO | Current usage value |
| `period_start` | timestamptz | NO | Start of tracking period |
| `period_end` | timestamptz | NO | End of tracking period |

#### `storage_usage`

Tracks storage usage by workspace.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `workspace_id` | uuid | NO | Workspace ID |
| `file_type` | text | NO | Type of files (tracks, stems, covers, documents) |
| `file_count` | integer | NO | Number of files |
| `total_bytes` | bigint | NO | Total storage used in bytes |
| `updated_at` | timestamptz | NO | Last update timestamp |

---

### 3.14 System and Audit Tables

#### `audit_logs`

Audit trail for important actions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | References auth.users.id |
| `workspace_id` | uuid | YES | Related workspace (if applicable) |
| `action` | text | NO | Action performed |
| `entity_type` | text | YES | Type of entity affected |
| `entity_id` | uuid | YES | ID of affected entity |
| `metadata` | jsonb | YES | Additional action metadata |
| `ip_address` | text | YES | User IP address |
| `user_agent` | text | YES | User browser/device |
| `created_at` | timestamptz | NO | now() | Log entry timestamp |

**Indexes:**
- `audit_logs_user_id_idx` (user_id)
- `audit_logs_workspace_id_idx` (workspace_id)
- `audit_logs_created_at_idx` (created_at)
- `audit_logs_action_idx` (action)

#### `rate_limits`

Rate limiting tracking.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `key` | text | NO | Rate limit key (IP, user ID, etc.) |
| `endpoint` | text | YES | API endpoint being rate limited |
| `request_count` | integer | NO | Number of requests in current window |
| `window_start` | timestamptz | NO | Start of current window |
| `max_requests` | integer | NO | Maximum requests per window |

#### `notifications`

In-app notifications.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `user_id` | uuid | NO | | Recipient user ID |
| `type` | notification_type | NO | | Notification type |
| `title` | text | NO | | Notification title |
| `message` | text | YES | | Notification message |
| `data` | jsonb | YES | | Additional notification data |
| `is_read` | boolean | NO | false | Whether notification has been read |
| `link` | text | YES | | Deep link for notification |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**Indexes:**
- `notifications_user_id_idx` (user_id)
- `notifications_user_id_is_read_idx` (user_id, is_read)
- `notifications_created_at_idx` (created_at)

#### `notification_preferences`

User notification preferences.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `user_id` | uuid | NO | References auth.users.id |
| `preferences` | jsonb | NO | Notification preferences object |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### 3.15 Document Tables

#### `documents`

Files attached to tracks (contracts, agreements, riders, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | | Primary key |
| `track_id` | uuid | NO | | Parent track ID |
| `name` | text | NO | | Document name |
| `file_url` | text | NO | | R2 storage URL |
| `file_path` | text | YES | | File path in R2 bucket |
| `file_size` | bigint | YES | | File size in bytes |
| `doc_type` | text | YES | | Document type/category |
| `status` | document_status | NO | 'draft' | Status: draft, pending, signed |
| `uploaded_by` | uuid | YES | | User who uploaded |
| `created_at` | timestamptz | NO | now() | Upload timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### 3.16 Other Reference Tables

#### `whitelist`

Beta access whitelist.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `email` | text | NO | Email address |
| `reason` | text | YES | Reason for whitelisting |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

## 4. Entity Relationships

### 4.1 Ownership Hierarchy

```
Account (auth.users)
└── Workspaces (workspaces)
    ├── Tracks (tracks)
    │   ├── Stems (stems)
    │   ├── Documents (documents)
    │   ├── Comments (track_comments)
    │   ├── Splits (splits)
    │   │   └── Signatures (signatures)
    │   └── Studio Submissions (studio_submissions)
    ├── Playlists (playlists)
    │   └── Playlist Tracks (playlist_tracks) → Tracks
    ├── Contacts (contacts)
    │   └── Contact Aliases (contact_aliases)
    ├── Shared Links (shared_links)
    │   └── Shared Links Access (shared_links_access)
    ├── Catalog Shares (catalog_shares) → Target Workspace
    └── Team Members (workspace_members)
```

### 4.2 Cross-Workspace Relationships

```
Catalog Share (catalog_shares)
├── Source: Workspace (source_workspace_id)
│   └── Track (track_id)
└── Target: Workspace (target_workspace_id)
    └── Access: Tracks appear in target catalog with reference to source
```

### 4.3 Key Constraints

1. **Circular References:** RLS policies prevent circular workspace access
2. **Soft Deletes:** Most tables use `is_deleted` flag + `deleted_at` timestamp
3. **Cascading Deletes:** Soft delete on parent usually doesn't affect children
4. **Unique Constraints:** Slugs, ISRC codes, email per workspace for contacts

---

## 5. Row-Level Security (RLS)

### 5.1 RLS Overview

All tables have **Row-Level Security** policies that automatically filter data based on user permissions. This is the primary security mechanism in Trakalog.

**Key Principle:** Users can only see and modify data they have permission to access within their workspaces.

### 5.2 RLS Policy Structure

```sql
-- Standard RLS policy pattern
CREATE POLICY "policy_name ON table FOR operation"
USING (
  -- Condition that must be true for row to be accessible
  workspace_id = current_workspace_id()
  OR exists (
    select 1 from workspace_members
    where workspace_id = table.workspace_id
    and user_id = auth.uid()
  )
);
```

### 5.3 Key RLS Policies by Table

#### Workspaces

```sql
-- Users can see workspaces they belong to
CREATE POLICY "Users can view workspaces they belong to"
ON workspaces FOR SELECT
USING (
  exists (
    select 1 from workspace_members
    where workspace_id = workspaces.id
    and user_id = auth.uid()
  )
);

-- Users can insert their own workspaces
CREATE POLICY "Users can create workspaces"
ON workspaces FOR INSERT
WITH CHECK (
  created_by = auth.uid()
);

-- Users can update workspaces they own
CREATE POLICY "Users can update workspaces they own"
ON workspaces FOR UPDATE
USING (
  created_by = auth.uid()
) WITH CHECK (
  created_by = auth.uid()
);

-- Users can delete workspaces they own
CREATE POLICY "Users can delete workspaces they own"
ON workspaces FOR DELETE
USING (
  created_by = auth.uid()
);
```

#### Tracks

```sql
-- Users can see tracks in workspaces they belong to
CREATE POLICY "Users can view tracks in their workspaces"
ON tracks FOR SELECT
USING (
  is_deleted = false AND (
    workspace_id = current_workspace_id() OR
    exists (
      select 1 from catalog_shares
      where track_id = tracks.id
      and target_workspace_id = current_workspace_id()
      and status = 'active'
    )
  )
);

-- Users can insert tracks in their workspaces
CREATE POLICY "Users can create tracks in their workspaces"
ON tracks FOR INSERT
WITH CHECK (
  workspace_id = current_workspace_id() AND
  created_by = auth.uid()
);

-- Users can update tracks they own or have edit access to
CREATE POLICY "Users can update tracks in their workspaces"
ON tracks FOR UPDATE
USING (
  workspace_id = current_workspace_id() AND
  exists (
    select 1 from workspace_members
    where workspace_id = current_workspace_id()
    and user_id = auth.uid()
    and access_level IN ('editor', 'admin')
  )
) WITH CHECK (
  workspace_id = current_workspace_id()
);

-- Users can delete tracks they own
CREATE POLICY "Users can delete tracks they own"
ON tracks FOR DELETE
USING (
  workspace_id = current_workspace_id() AND
  exists (
    select 1 from workspace_members
    where workspace_id = current_workspace_id()
    and user_id = auth.uid()
    and access_level = 'admin'
  )
);
```

#### Shared Links

```sql
-- Anyone with the link can view it (public access)
CREATE POLICY "Public access to shared links"
ON shared_links FOR SELECT
USING (
  disabled = false AND (
    expires_at IS NULL OR expires_at > now()
  )
);

-- Only workspace members can create shared links
CREATE POLICY "Users can create shared links in their workspaces"
ON shared_links FOR INSERT
WITH CHECK (
  workspace_id = current_workspace_id() AND
  created_by = auth.uid()
);

-- Only link creators or workspace admins can manage links
CREATE POLICY "Users can manage their own shared links"
ON shared_links FOR UPDATE, DELETE
USING (
  workspace_id = current_workspace_id() AND (
    created_by = auth.uid() OR
    exists (
      select 1 from workspace_members
      where workspace_id = current_workspace_id()
      and user_id = auth.uid()
      and access_level = 'admin'
    )
  )
);
```

#### Catalog Shares

```sql
-- Source workspace can see shares they created
CREATE POLICY "Source workspace can view their outgoing shares"
ON catalog_shares FOR SELECT
USING (
  source_workspace_id = current_workspace_id()
);

-- Target workspace can see shares coming to them
CREATE POLICY "Target workspace can view incoming shares"
ON catalog_shares FOR SELECT
USING (
  target_workspace_id = current_workspace_id() AND
  status = 'active'
);

-- Only source workspace can create shares
CREATE POLICY "Source workspace can create shares"
ON catalog_shares FOR INSERT
WITH CHECK (
  source_workspace_id = current_workspace_id() AND
  shared_by = auth.uid()
);

-- Only source workspace can revoke shares
CREATE POLICY "Source workspace can revoke their shares"
ON catalog_shares FOR UPDATE
USING (
  source_workspace_id = current_workspace_id() AND
  shared_by = auth.uid()
) WITH CHECK (
  source_workspace_id = current_workspace_id()
);
```

### 5.4 RLS Helper Functions

```sql
-- Get current workspace ID from JWT
CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS uuid AS $$
BEGIN
  RETURN (select workspace_id from workspace_members
         where user_id = auth.uid()
         order by is_personal desc, created_at asc
         limit 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin in current workspace
CREATE OR REPLACE FUNCTION is_workspace_admin()
RETURNS boolean AS $$
BEGIN
  RETURN exists (
    select 1 from workspace_members
    where workspace_id = current_workspace_id()
    and user_id = auth.uid()
    and access_level = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Storage Organization

### 6.1 Storage Providers

| Provider | Purpose | Bucket | URL Pattern |
|----------|---------|--------|-------------|
| **Cloudflare R2** | Primary storage | `trakalog-tracks` | `https://trakalog-tracks.r2.cloudflarestorage.com/` |
| **Supabase Storage** | Secondary storage | `tracks`, `covers`, `stems`, `documents` | Supabase URLs |

### 6.2 R2 Bucket Structure

```
r2-bucket/
├── tracks/
│   ├── {workspace_id}/
│   │   ├── {track_id}/
│   │   │   ├── original.{ext}          # Original WAV/MP3
│   │   │   ├── preview.mp3             # 128kbps MP3 preview
│   │   │   └── watermarked/
│   │   │       └── {hash}-{recipient}.mp3  # Watermarked versions
│   └── temp/
│       └── {upload_id}.{ext}          # Temporary uploads
├── covers/
│   └── {workspace_id}/
│       └── {track_id}-{timestamp}.{ext}  # Cover art images
├── stems/
│   └── {workspace_id}/
│       └── {track_id}/
│           └── {stem_id}.{ext}          # Individual stem files
└── documents/
    └── {workspace_id}/
        └── {track_id}/
            └── {document_id}.{ext}      # Contracts, agreements, etc.
```

### 6.3 Supabase Storage Structure

```
supabase-storage/
├── tracks/
│   └── {workspace_id}/
│       └── previews/
│           └── {track_id}.mp3           # MP3 previews (legacy)
├── covers/
│   └── {workspace_id}/
│       └── {cover_id}.{ext}             # Cover art (smaller files)
├── stems/
│   └── {workspace_id}/
│       └── {track_id}/
│           └── {stem_id}.{ext}          # Stem files (smaller)
└── documents/
    └── {workspace_id}/
        └── {document_id}.{ext}          # PDFs, text documents
```

### 6.4 File Naming Conventions

- **UUIDs:** All files use UUID-based names to prevent collisions
- **Timestamps:** Some files include timestamps for versioning
- **Hashes:** Watermarked files include recipient hash for tracing
- **Extensions:** Original extensions preserved where possible

---

## 7. Data Flow Patterns

### 7.1 CRUD Patterns

All Create, Read, Update, Delete operations follow consistent patterns:

#### Create (Insert)
```typescript
// Always include: created_by, workspace_id
const { data, error } = await supabase
  .from('tracks')
  .insert({
    title: 'My Track',
    workspace_id: currentWorkspaceId,
    created_by: userId,
    // ... other fields
  })
  .select()
  .single();
```

#### Read (Select)
```typescript
// Always filter by current workspace and check is_deleted
const { data, error } = await supabase
  .from('tracks')
  .select('*')
  .eq('workspace_id', currentWorkspaceId)
  .eq('is_deleted', false)
  .order('created_at', { ascending: false });
```

#### Update
```typescript
// Always include updated_at
const { data, error } = await supabase
  .from('tracks')
  .update({
    title: 'Updated Title',
    updated_at: new Date().toISOString()
  })
  .eq('id', trackId)
  .eq('workspace_id', currentWorkspaceId)
  .select()
  .single();
```

#### Delete (Soft Delete)
```typescript
// Never hard delete - use is_deleted flag
const { data, error } = await supabase
  .from('tracks')
  .update({
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('id', trackId)
  .eq('workspace_id', currentWorkspaceId);
```

### 7.2 Transaction Patterns

```typescript
// For operations requiring multiple updates
const { data, error } = await supabase.rpc('complex_operation', {
  track_id: trackId,
  user_id: userId,
  workspace_id: workspaceId
});
```

---

## 8. Key Data Constraints

### 8.1 Business Rules Enforced at Database Level

1. **Split Totals:** Sum of split percentages for a track = 100
2. **Unique Slugs:** Shared link slugs must be unique
3. **Unique ISRC:** ISRC codes must be unique across all workspaces
4. **Version Sequences:** Track version numbers auto-increment
5. **Access Level Hierarchy:** admin > editor > pitcher > viewer (enforced in RLS)

### 8.2 Validation Rules

**Application-Level:**
- File size limits (configurable per plan)
- File type restrictions (audio files only for track uploads)
- Metadata completeness calculations
- Permission checks before sensitive operations

**Database-Level:**
- NOT NULL constraints on required fields
- CHECK constraints on numeric ranges (percentages 0-100)
- Foreign key constraints
- Unique constraints

---

## 9. Backup and Recovery

### 9.1 Backup Strategy

- **Automated Daily:** Supabase managed backups
- **Point-in-Time Recovery:** Available for disaster recovery
- **Manual Export:** Database dumps can be generated on demand

### 9.2 Data Retention

| Data Type | Retention Policy |
|-----------|-----------------|
| Soft-deleted data | Retained indefinitely, can be restored |
| Audit logs | Retained for 7 years |
| Usage tracking | Retained for 2 years |
| Temporary files | Automatically cleaned after 30 days |

---

## 📝 Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 1.0.0 |
| **Owner** | Ishan |
| **Status** | Draft |
| **Next Review** | September 11, 2026 |
| **Related Documents** | [01 - Vision & Overview](01-VISION_AND_OVERVIEW.md), [02 - System Architecture](02-SYSTEM_ARCHITECTURE.md), [06 - Security Architecture](06-SECURITY_ARCHITECTURE.md) |
| **Source Files** | [RPCS.md](../RPCS.md), [supabase/migrations/](../../supabase/migrations/) |

---

*This document is based on analysis of the existing database schema, RPCs, and migrations. For the most current schema, always check the actual database or the latest migrations.*