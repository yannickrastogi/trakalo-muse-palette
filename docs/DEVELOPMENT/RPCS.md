# TRAKALOG — RPC Reference

> **Status:** Draft
> **Last Updated:** September 2, 2026
> **Owner:** Ishan
> **Related:** [03 - Data Architecture](../ARCHITECTURE/03-DATA_ARCHITECTURE.md), [06 - Security Architecture](../ARCHITECTURE/06-SECURITY_ARCHITECTURE.md), [AUTH_PATTERNS.md](../ARCHITECTURE/AUTH_PATTERNS.md)

Every sensitive database write goes through a `SECURITY DEFINER` RPC that takes an explicit
`_user_id`, rather than relying on `auth.uid()` inside an RLS policy. `auth.uid()` returns NULL
unpredictably on an unstable session — see [AUTH_PATTERNS.md](../ARCHITECTURE/AUTH_PATTERNS.md)
— so a policy that depends on it fails open or closed at random. An explicit `_user_id`
validated by `assert_caller` fails closed, every time.

---

## Coverage — read this before trusting the list

| Measure | Count |
|---|---|
| Functions defined in `supabase/migrations/` | **158** |
| Distinct RPCs actually called from `src/` | **94** |
| RPCs documented below | **47** |

**This reference covers about half the RPCs the frontend calls.** The 47 documented here were
verified signature-by-signature against `supabase/migrations/20260626144305_baseline_prod.sql`
plus later migrations on September 2, 2026. The other 47 are listed in §14 by name only —
they are real and called from `src/`, they simply have no entry yet. Treat §14 as a to-do
list, not as a claim that those RPCs are unimportant.

To regenerate the call-site inventory:

```bash
grep -rhoE "rpc\(\s*[\"'\`][a-z_]+" src/ | sed -E "s/rpc\(\s*[\"'\`]//" | sort -u
```

---

## 1. Auth & Profile

### update_user_profile
- **Description:** Updates the user's profile metadata.
- **Params:** `_user_id` (uuid), `_first_name` (text), `_last_name` (text), `_phone` (text), `_bio` (text), `_avatar_url` (text)
- **Returns:** void
- **Used in:** `SettingsPage.tsx`, `WelcomeOnboarding.tsx`
- **Writes:** ⚠️ **`auth.users.raw_user_meta_data`, not `public.profiles`.** The function merges
  a `jsonb_build_object` into the auth user's metadata. `public.profiles` has no `first_name`,
  `last_name`, `phone` or `bio` columns — it holds `full_name`, `email`, `avatar_url` and
  `onboarding_complete`. Anything reading these fields must read them from the session's user
  metadata.

### is_email_whitelisted
- **Description:** Checks whether an email is on the beta whitelist. Compares `lower(_email)`.
- **Params:** `_email` (text)
- **Returns:** boolean
- **Used in:** `lib/whitelist.ts`
- **Tables:** **`whitelisted_emails`** (there is no `whitelist` table)

### write_audit_log
- **Description:** Writes an audit-trail entry. Fire-and-forget.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_action` (text), `_entity_type` (text), `_entity_id` (uuid), `_metadata` (text)
- **Returns:** void
- **Used in:** `AuthContext.tsx`, `TrackDetail.tsx`, `DashboardContent.tsx`, `SharedLinkPage.tsx`
- **Tables:** `audit_logs`

---

## 2. Workspaces

### get_user_workspaces
- **Description:** Lists every workspace a user belongs to.
- **Params:** `_user_id` (uuid)
- **Returns:** `SETOF` — a result set, not a json array
- **Used in:** `WorkspaceContext.tsx`, `SharedLinkPage.tsx`
- **Tables:** `workspaces`, `workspace_members`

### create_workspace_with_member
- **Description:** Creates a workspace and adds the caller as its owner member.
- **Params:** `_name` (text), `_description` (text, default NULL), `_user_id` (uuid, default NULL)
- **Returns:** uuid — the new workspace id
- **Used in:** `WorkspaceContext.tsx`, `Onboarding.tsx`
- **Tables:** `workspaces`, `workspace_members`
- **Note:** `_user_id` is the **third** parameter here and defaults to NULL, unlike the
  `_user_id`-first convention everywhere else. Always pass it by name.

### mark_workspace_personal
- **Description:** Marks a workspace as personal, and unmarks the user's others.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** `WorkspaceContext.tsx`
- **Tables:** `workspaces`

### update_workspace_name
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_name` (text)
- **Returns:** void
- **Used in:** `WorkspaceSettings.tsx`, `WelcomeOnboarding.tsx`
- **Tables:** `workspaces`

### update_workspace_slug
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_slug` (text)
- **Returns:** void
- **Used in:** `WorkspaceSettings.tsx`, `WelcomeOnboarding.tsx`
- **Tables:** `workspaces`

### update_workspace_branding
- **Description:** Updates hero image, logo, colour, bio, socials and EPK URL.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_hero_image_url` (text), `_logo_url` (text), `_brand_color` (text), **`_hero_position` (numeric)**, `_hero_focal_point` (text), `_social_instagram` (text), `_social_tiktok` (text), `_social_youtube` (text), `_social_facebook` (text), `_social_x` (text), `_social_website` (text), `_bio` (text), `_social_spotify` (text), `_social_apple` (text), `_epk_url` (text), `_logo_size` (integer) — all optional after `_workspace_id`
- **Returns:** void
- **Used in:** `WorkspaceSettings.tsx`
- **Tables:** `workspaces`
- **Note:** `_hero_position` is **numeric**, not text, matching `workspaces.hero_position`
  (`integer`). Passing a string fails the cast.

### update_workspace_settings
- **Description:** Updates the workspace `settings` jsonb (approval mode, etc.).
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_settings` (jsonb)
- **Returns:** void
- **Used in:** `WorkspaceContext.tsx`
- **Tables:** `workspaces`

### delete_workspace
- **Description:** **Hard delete.** Removes `workspace_members`, then `user_roles`, then the
  `workspaces` row.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** `Workspaces.tsx`
- **Guards:** caller must be the workspace **owner**; a workspace with `is_personal = true`
  cannot be deleted (raises). There is **no soft delete** — this is irreversible.

---

## 3. Tracks

### insert_track
- **Description:** Creates a track row.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_title` (text), `_artist` (text), `_featuring` (text), `_type` (text), `_status` (text), `_bpm` (numeric), `_key` (text), `_duration_sec` (numeric), **`_genre` (text[])**, `_mood` (text[]), `_language` (text), `_gender` (text), `_labels` (text[]), `_publishers` (text[]), `_audio_url` (text), `_audio_preview_url` (text), **`_cover_art_url` (text)**, `_lyrics` (text), `_notes` (text), `_splits` (jsonb), `_isrc` (text), `_waveform_data` (jsonb), `_released_at` (timestamptz), `_file_size_bytes` (bigint)
- **Returns:** **uuid** — the new track id, not a json object
- **Used in:** `TrackContext.tsx`, `UploadTrackModal.tsx`
- **Tables:** `tracks`
- **Note:** `_genre` is a **`text[]`**, and the cover parameter is **`_cover_art_url`** (the
  column is `cover_url`). Extended metadata — `album`, `upc`, `copyright`, `credits`, `tags`,
  `chapters`, `explicit` — is **not** accepted here; write it with a follow-up `update_track`.

### update_track
- **Description:** Partial update through a jsonb patch.
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_updates` (jsonb — dynamic keys: `title`, `artist`, `bpm`, `key`, `genre`, `mood`, `lyrics`, `sonic_dna`, `waveform_data`, `audio_preview_url`, `qr_token`, `chapters`, `splits`, `credits`, `tags`, …)
- **Returns:** void
- **Used in:** `TrackContext.tsx`, `TrackDetail.tsx`, `UploadTrackModal.tsx`, `EditTrackModal.tsx`, `StudioQRModal.tsx`, `TrackReviewContext.tsx`
- **Tables:** `tracks`

### delete_track
- **Description:** **Hard delete.** `tracks` has no soft-delete column — no `is_deleted`, no
  `deleted_at`. The row and its audio reference are gone.
- **Params:** `_user_id` (uuid), `_track_id` (uuid)
- **Returns:** void
- **Used in:** `TrackContext.tsx`
- **Guards:** `assert_caller`, then `require_workspace_access_level(…, 'admin')` — **admin
  only**.

### remove_track_from_trakalog
- **Description:** Removes a track that was saved from a shared link.
- **Params:** `_track_id` (uuid), `_user_id` (uuid) — note the **reversed** parameter order
- **Returns:** void
- **Used in:** `TrackDetail.tsx`
- **Tables:** `catalog_shares`

### save_track_to_trakalog
- **Description:** Saves a shared track into a workspace the caller belongs to.
- **Params:** `_track_id` (uuid), `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_user_id` (uuid) — `_user_id` is **last**
- **Returns:** **uuid**
- **Used in:** `DashboardContent.tsx`, `SharedLinkPage.tsx` (via REST)
- **Tables:** `catalog_shares`

---

## 4. Stems

### insert_stem
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_name` (text), `_file_url` (text), `_file_size` (bigint), `_stem_type` (text)
- **Returns:** **uuid**
- **Used in:** `TrackContext.tsx`, `StemsTab.tsx`
- **Tables:** `stems`

### delete_stem
- **Params:** `_user_id` (uuid), `_stem_id` (uuid)
- **Returns:** void
- **Used in:** `TrackContext.tsx`, `StemsTab.tsx`
- **Tables:** `stems`

### update_stem_type
- **Description:** Changes a stem's type. `_stem_type` must be a `stem_type` enum value:
  `kick`, `snare`, `bass`, `guitar`, `vocal`, `synth`, `drums`, `background_vocal`, `fx`,
  `other`.
- **Params:** `_user_id` (uuid), `_stem_id` (uuid), `_stem_type` (text)
- **Returns:** void
- **Used in:** `StemsTab.tsx`
- **Tables:** `stems`

---

## 5. Playlists

### create_playlist
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_name` (text), `_description` (text, default NULL), `_cover_url` (text, default NULL)
- **Returns:** uuid
- **Used in:** `PlaylistContext.tsx`, `SmartAR.tsx`
- **Tables:** `playlists`

### update_playlist
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_name` (text, default NULL), `_description` (text, default NULL), `_cover_url` (text, default NULL)
- **Returns:** void
- **Used in:** `PlaylistContext.tsx`
- **Tables:** `playlists`

### delete_playlist
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid)
- **Returns:** void
- **Used in:** `PlaylistContext.tsx`
- **Tables:** `playlists`

### add_playlist_tracks
- **Description:** Appends tracks to a playlist.
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_track_ids` (uuid[])
- **Returns:** void
- **Used in:** `PlaylistContext.tsx`, `SmartAR.tsx`, `Radio.tsx`
- **Tables:** `playlist_tracks`

### replace_playlist_tracks
- **Description:** Replaces the whole track list — used for reordering and removal.
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_track_ids` (uuid[])
- **Returns:** void
- **Used in:** `PlaylistContext.tsx`
- **Tables:** `playlist_tracks`

### clean_revoked_playlist_tracks
- **Description:** Drops revoked tracks from the target workspace's playlists.
- **Params:** `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_track_id` (uuid, default NULL)
- **Returns:** **void** (not a count)
- **Used in:** `ShareToWorkspaceModal.tsx`
- **Tables:** `playlist_tracks`

---

## 6. Pitches

### create_pitch
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_recipient_name` (text), `_recipient_email` (text, default NULL), `_recipient_company` (text, default `''`), `_subject` (text, default `''`), `_message` (text, default NULL), `_track_ids` (uuid[], default `{}`), `_status` (text, default `'draft'`), `_sent_at` (timestamptz, default NULL)
- **Returns:** **uuid**
- **Used in:** `PitchContext.tsx`
- **Tables:** `pitches`
- **Note:** there is **no `_playlist_ids` and no `_link_type` parameter.** Tracks are the only
  payload, held in `pitches.track_ids uuid[]` — there is no `pitch_tracks` join table.
- **Feature-flagged:** the Pitch module is hidden behind `FEATURES.PITCH_ENABLED`, currently
  `false`.

---

## 7. Contacts

### upsert_contact
- **Description:** Creates or updates a contact. Deduplicates on `(workspace_id, lower(email))`
  when an email is supplied, otherwise on
  `(workspace_id, lower(first_name), lower(coalesce(last_name,'')))`. Empty values never
  overwrite existing data (`COALESCE`/`NULLIF`).
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_first_name` (text), `_last_name` (text), `_email` (text), `_stage_name` (text), `_role` (text), `_company` (text), `_phone` (text), `_city` (text), `_country` (text), `_pro` (text[]), `_ipi` (text), `_publisher` (text)
- **Returns:** uuid
- **Used in:** `ContactsContext.tsx`, `UploadTrackModal.tsx`, `EditTrackModal.tsx`, `TrackDetail.tsx`
- **Tables:** `contacts`
- **Note:** `_stage_name` comes **before** `_role`, and `_pro` is a **`text[]`**. Pass by name.

### add_contact_manual
- **Description:** Adds a contact from the manual form.
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_first_name` (text), `_last_name` (text), `_email` (text), `_role` (text), `_company` (text), `_phone` (text), `_pro` (text[]), `_ipi` (text), `_publisher` (text), `_city` (text), `_country` (text), `_stage_name` (text)
- **Returns:** **uuid**
- **Used in:** `AddContactModal.tsx`
- **Tables:** `contacts`

---

## 8. Shared Links

### create_shared_link
- **Description:** Creates a shared link (`track`, `playlist`, `stems` or `pack`).
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_share_type` (text), `_track_id` (uuid), `_playlist_id` (uuid), `_link_name` (text), `_link_slug` (text), `_link_type` (text), `_password_hash` (text), `_message` (text), `_allow_download` (boolean, default **false**), `_allow_save` (boolean, default true), `_download_quality` (text), `_expires_at` (timestamptz), **`_pack_items` (text)**, `_watermarking_enabled` (boolean, default true), `_gate_screen_enabled` (boolean, default true)
- **Returns:** json — the created row via `row_to_json`
- **Used in:** `SharedLinksContext.tsx`, `PitchContext.tsx`
- **Tables:** `shared_links`
- **Guards:** `assert_caller`, then `require_workspace_access_level(…, 'pitcher')`
- **Note:** `_pack_items` is passed as **text** and cast to jsonb inside the function.
  `_download_quality` must be `'hi-res'` or `'low-res'` — a CHECK constraint.

### update_shared_link_status
- **Description:** Enables or disables a link.
- **Params:** `_user_id` (uuid), `_link_id` (uuid), `_disabled` (boolean)
- **Returns:** void
- **Used in:** `SharedLinksContext.tsx`
- **Tables:** `shared_links`
- **Guards:** pitcher-or-above **and** (own link **or** admin)

---

## 9. Catalog Shares

### insert_catalog_share
- **Description:** Shares one track, or a whole catalog, with another workspace.
- **Params:** `_user_id` (uuid), `_track_id` (uuid — NULL means the whole catalog), `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_access_level` (text)
- **Returns:** **uuid**
- **Used in:** `ShareToWorkspaceModal.tsx`, `UploadTrackModal.tsx`
- **Tables:** `catalog_shares`

### revoke_catalog_share
- **Description:** Revokes a share. Soft: sets `status = 'revoked'` and stamps `revoked_at`.
- **Params:** `_user_id` (uuid), `_share_id` (uuid)
- **Returns:** void
- **Used in:** `ShareToWorkspaceModal.tsx`, `WorkspaceSettings.tsx`
- **Tables:** `catalog_shares`

### get_workspace_catalog_shares
- **Params:** `_workspace_id` (uuid)
- **Returns:** `SETOF`
- **Used in:** `TrackContext.tsx`, `TrackReviewContext.tsx`
- **Tables:** `catalog_shares`

### get_shared_workspace_tracks
- **Params:** `_source_workspace_id` (uuid), `_target_workspace_id` (uuid)
- **Returns:** `SETOF`
- **Used in:** `TrackContext.tsx`, `WorkspaceSwitcher.tsx`
- **Tables:** `tracks`, `catalog_shares`

---

## 10. Comments

### get_track_comments
- **Params:** `_track_id` (uuid), `_workspace_id` (uuid, default NULL)
- **Returns:** `SETOF`
- **Used in:** `TrackReviewContext.tsx`
- **Tables:** `track_comments`

### add_track_comment
- **Params:** `_track_id` (uuid), `_author_name` (text), `_author_email` (text), `_author_type` (text), `_timestamp_sec` (numeric), `_content` (text), `_workspace_id` (uuid, default NULL)
- **Returns:** **uuid**
- **Used in:** `TrackReviewContext.tsx`
- **Tables:** `track_comments`

### delete_track_comment
- **Description:** **Hard delete.**
- **Params:** `_comment_id` (uuid), **`_user_id` (uuid)** — the caller id is required and is the
  **second** parameter
- **Returns:** void
- **Used in:** `TrackReviewContext.tsx`
- **Guards:** `assert_caller`, then editor-or-above on the comment's track workspace

> Shared-link recipients have no session, so they use a separate token-authenticated family:
> `insert_track_comment_via_token`, `update_track_comment_via_token`,
> `delete_track_comment_via_token` (see §14).

---

## 11. Approvals

### insert_approval
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_track_id` (uuid), `_send_type` (text), `_team_id` (uuid) — **required**, pass NULL explicitly
- **Returns:** uuid
- **Used in:** `ApprovalContext.tsx`
- **Tables:** `approvals`

### update_approval_status
- **Params:** `_user_id` (uuid), `_approval_id` (uuid), `_status` (text — `'approved'` | `'rejected'`), `_note` (text) — **required**, pass NULL explicitly
- **Returns:** void
- **Used in:** `ApprovalContext.tsx`
- **Tables:** `approvals`
- **Feature-flagged:** hidden behind `FEATURES.APPROVALS_ENABLED`, currently `false`.

---

## 12. Documents

### insert_track_document
- **Description:** Attaches a document to a track (contract, rider, split sheet…).
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_name` (text), **`_file_path` (text)**, `_file_size` (bigint), `_doc_type` (text), `_file_name` (text), `_mime_type` (text)
- **Returns:** **uuid**
- **Used in:** `TrackDetail.tsx`
- **Tables:** **`track_documents`** (there is no `documents` table)
- **Note:** the parameter is `_file_path`, not `_file_url` — it is a storage path in the
  `documents` bucket, not a URL.

### delete_track_document
- **Params:** `_user_id` (uuid), `_doc_id` (uuid)
- **Returns:** void
- **Used in:** `TrackDetail.tsx`
- **Tables:** `track_documents`

### update_track_document_status
- **Description:** Updates a document's status — the `document_status` enum is
  `draft` | `pending` | `signed`.
- **Params:** `_user_id` (uuid), `_doc_id` (uuid), `_status` (text)
- **Returns:** void
- **Used in:** `TrackDetail.tsx`
- **Tables:** `track_documents`

---

## 13. Team, Notifications & Studio

### remove_workspace_member
- **Params:** `_user_id` (uuid), `_member_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** `TeamContext.tsx`
- **Tables:** `workspace_members`

### update_member_role
- **Params:** `_user_id` (uuid), `_member_user_id` (uuid), `_workspace_id` (uuid), `_access_level` (text), `_professional_title` (text, default NULL)
- **Returns:** void
- **Used in:** `TeamContext.tsx`
- **Tables:** `workspace_members`, `user_roles`
- **Note:** `_access_level` is one of `viewer`, `pitcher`, `editor`, `admin`. `pitcher` is no
  longer offered in role pickers (`FEATURES.PITCHER_ROLE_ENABLED` is `false`) but remains valid
  server-side so legacy members still resolve.

### upsert_notification_preferences
- **Params:** `_user_id` (uuid), `_preferences` (jsonb — keys: `link_activity`, `comments`, `signatures`, `new_member_joined`, `track_uploads`)
- **Returns:** void
- **Used in:** `SettingsPage.tsx`
- **Tables:** `notification_preferences`

### update_studio_submission_status
- **Description:** Accepts or rejects a collaborator submission captured through a studio QR
  session.
- **Params:** `_user_id` (uuid), `_submission_id` (uuid), `_status` (text — `'accepted'` | `'rejected'`)
- **Returns:** void
- **Used in:** `TrackDetail.tsx`
- **Tables:** `studio_submissions`

### check_rate_limit *(Edge Functions only)*
- **Description:** Checks and increments a rate-limit counter. **Calling it increments it**, so
  a refusal must short-circuit — never call it twice for one logical request.
- **Params:** `_key` (text), `_max_requests` (integer), `_window_seconds` (integer)
- **Returns:** boolean — `true` = allowed, `false` = rate limited
- **Used in:** most Edge Functions, including `get-audio-url`, `get-watermarked-audio`,
  `verify-link-password`, `hash-link-password`, `log-link-access`, `log-link-event`,
  `smart-ar`, `transcribe-lyrics`, `analyze-sonic-dna`, `get-upload-url`
- **Tables:** `rate_limits`

---

## 14. Called from `src/` but not yet documented

These 47 RPCs are real and in use. They need entries; none exists yet.

**Versioning:** `add_track_version`, `delete_track_version`, `set_track_version_active`,
`update_track_version_chapters`, `update_track_version_notes`, `update_track_version_waveform`

**Shared-link / anonymous access:** `get_shared_link_by_slug`, `get_shared_link_by_id`,
`get_track_for_shared_link`, `get_tracks_for_shared_link`,
`get_playlist_tracks_for_shared_link`, `get_workspace_branding_for_shared_link`,
`get_shared_playlist_tracks`, `get_shared_workspace_playlists`,
`insert_track_comment_via_token`, `update_track_comment_via_token`,
`delete_track_comment_via_token`, `get_signature_agreement_by_token`, `get_track_by_qr_token`

**Admin console:** `get_admin_overview`, `is_platform_admin`, `list_all_users`,
`list_all_contacts`, `list_waitlist_signups`, `get_waitlist_signups_`, `get_visit_stats`,
`log_site_visit`, `delete_leak_trace`

**Marketplace:** `search_marketplace_tracks`, `set_track_marketplace_public`,
`request_track_access`

**Tracks & media:** `bulk_update_tracks`, `edit_track_comment`, `upsert_track_rating`,
`update_track_video`, `delete_track_video`, `toggle_track_video_visibility`

**Contacts & aliases:** `update_contact`, `upsert_artist_alias`, `delete_artist_alias`

**Splits:** `mark_splits_signed_externally`, `unmark_splits_signed_externally`

**Other:** `get_my_subscription`, `mark_onboarding_complete`, `share_playlist_with_workspace`,
`update_pitch_share_link`, `update_workspace_member`

---

## 15. Writing a new RPC

```sql
CREATE OR REPLACE FUNCTION public.my_rpc(_user_id uuid, _workspace_id uuid, _other text)
RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $func$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Prove the caller is who they claim to be.
  PERFORM public.assert_caller(_user_id);

  -- 2. Prove they may do this here.
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');

  -- 3. Do the work. Cast enums explicitly.
  INSERT INTO public.some_table (workspace_id, status)
  VALUES (_workspace_id, 'active'::link_status)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$func$;
```

**Rules:**

1. Always `SECURITY DEFINER` with `SET search_path TO 'public'` — without the `search_path`,
   a definer function is vulnerable to search-path hijacking.
2. Always take `_user_id uuid` as the first parameter, and always `PERFORM assert_caller(_user_id)`
   first. Never rely on `auth.uid()` alone.
3. Enforce authorization inside the function, with
   `require_workspace_access_level(_user_id, _workspace_id, '<level>')`. RLS is the backstop,
   not the gate — a definer function bypasses it.
4. **Never use `$$`** — always a named delimiter such as `$func$ … $func$` (`$drop$ … $drop$`
   for DROP blocks).
5. Cast enums explicitly: `_status::track_status`, `'active'::link_status`.
6. When adding a parameter to an existing RPC, append it **last** with a `DEFAULT`, then drop
   the stale overload with a `pg_proc` loop. Postgres identifies overloads by parameter types,
   so a changed signature silently creates a duplicate rather than replacing the original.
7. Apply through `apply_migration` (Supabase MCP) and drop the identical SQL into
   `supabase/migrations/` in the same batch. Applying without versioning recreates the drift
   the August 2, 2026 baseline was laid to fix.
8. **Never auto-execute SQL against production without validation.** Hand over one copyable
   block for manual execution in the Supabase SQL Editor, one block at a time on error.
