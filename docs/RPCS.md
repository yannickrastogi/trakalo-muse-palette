# TRAKALOG — RPCs Reference

> Updated 2026-04-22. Source of truth for all SECURITY DEFINER RPCs.
> 46 frontend RPCs + 1 Edge Function-only RPC = 47 total.

Toutes les queries DB sensibles passent par des RPCs `SECURITY DEFINER` pour contourner l'instabilité de `auth.uid()`.

---

## Auth & Profile

### update_user_profile
- **Description:** Met à jour le profil utilisateur (nom, avatar, bio, phone)
- **Params:** `_user_id` (uuid), `_first_name` (text), `_last_name` (text), `_phone` (text), `_bio` (text), `_avatar_url` (text)
- **Returns:** void
- **Used in:** SettingsPage.tsx, WelcomeOnboarding.tsx
- **Tables:** profiles

### is_email_whitelisted
- **Description:** Vérifie si un email est dans la whitelist beta
- **Params:** `_email` (text)
- **Returns:** boolean
- **Used in:** lib/whitelist.ts
- **Tables:** whitelist

### write_audit_log
- **Description:** Écrit une entrée dans le journal d'audit (fire-and-forget)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid, nullable), `_action` (text), `_entity_type` (text, optional), `_entity_id` (uuid, optional), `_metadata` (text, optional)
- **Returns:** void
- **Used in:** AuthContext.tsx, TrackDetail.tsx, DashboardContent.tsx
- **Tables:** audit_logs

---

## Workspaces

### get_user_workspaces
- **Description:** Liste tous les workspaces d'un utilisateur
- **Params:** `_user_id` (uuid)
- **Returns:** json[] (array of workspace objects)
- **Used in:** WorkspaceContext.tsx
- **Tables:** workspaces, workspace_members

### create_workspace_with_member
- **Description:** Crée un workspace et ajoute l'utilisateur comme membre owner
- **Params:** `_name` (text), `_description` (text, nullable), `_user_id` (uuid, optional)
- **Returns:** uuid (workspace ID)
- **Used in:** WorkspaceContext.tsx, Onboarding.tsx
- **Tables:** workspaces, workspace_members

### mark_workspace_personal
- **Description:** Marque un workspace comme personnel (et démarque les autres du même user)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** WorkspaceContext.tsx
- **Tables:** workspaces

### update_workspace_name
- **Description:** Met à jour le nom d'un workspace
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_name` (text)
- **Returns:** void
- **Used in:** WorkspaceSettings.tsx, WelcomeOnboarding.tsx
- **Tables:** workspaces

### update_workspace_slug
- **Description:** Met à jour le slug URL d'un workspace
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_slug` (text)
- **Returns:** void
- **Used in:** WorkspaceSettings.tsx, WelcomeOnboarding.tsx
- **Tables:** workspaces

### update_workspace_branding
- **Description:** Met à jour le branding (hero, logo, couleur, social links)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_hero_image_url` (text), `_logo_url` (text), `_brand_color` (text), `_hero_position` (text), `_hero_focal_point` (text), `_social_instagram` (text), `_social_tiktok` (text), `_social_youtube` (text), `_social_facebook` (text), `_social_x` (text)
- **Returns:** void
- **Used in:** WorkspaceSettings.tsx
- **Tables:** workspaces

### update_workspace_settings
- **Description:** Met à jour les settings jsonb d'un workspace (approval mode, etc.)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_settings` (jsonb)
- **Returns:** void
- **Used in:** WorkspaceContext.tsx
- **Tables:** workspaces

### delete_workspace
- **Description:** Supprime un workspace (soft delete)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** Workspaces.tsx
- **Tables:** workspaces

---

## Tracks

### insert_track
- **Description:** Insère un nouveau track avec ses métadonnées
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_title` (text), `_artist` (text), `_featuring` (text), `_type` (text), `_status` (text), `_bpm` (numeric), `_key` (text), `_genre` (text), `_mood` (text[]), `_isrc` (text), `_cover_url` (text), `_waveform_data` (jsonb), `_chapters` (jsonb), + other optional fields
- **Returns:** json (track object with id)
- **Used in:** TrackContext.tsx
- **Tables:** tracks

### update_track
- **Description:** Met à jour un ou plusieurs champs d'un track (partial update via jsonb)
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_updates` (jsonb — clés dynamiques: title, artist, bpm, key, genre, mood, lyrics, sonic_dna, waveform_data, audio_preview_url, qr_token, chapters, splits, etc.)
- **Returns:** void
- **Used in:** TrackContext.tsx, TrackDetail.tsx, UploadTrackModal.tsx, EditTrackModal.tsx, StudioQRModal.tsx, TrackReviewContext.tsx
- **Tables:** tracks

### delete_track
- **Description:** Supprime un track (soft delete)
- **Params:** `_user_id` (uuid), `_track_id` (uuid)
- **Returns:** void
- **Used in:** TrackContext.tsx
- **Tables:** tracks

### remove_track_from_trakalog
- **Description:** Retire un track sauvegardé depuis un shared link
- **Params:** `_track_id` (uuid), `_user_id` (uuid)
- **Returns:** void
- **Used in:** TrackDetail.tsx
- **Tables:** tracks (ou catalog_shares)

### save_track_to_trakalog
- **Description:** Sauvegarde un track partagé dans le workspace de l'utilisateur
- **Params:** `_track_id` (uuid), `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_user_id` (uuid)
- **Returns:** void
- **Used in:** DashboardContent.tsx, SharedLinkPage.tsx (via REST)
- **Tables:** catalog_shares

---

## Stems

### insert_stem
- **Description:** Ajoute un stem à un track
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_name` (text), `_file_url` (text), `_file_size` (bigint), `_stem_type` (text)
- **Returns:** void
- **Used in:** TrackContext.tsx, StemsTab.tsx
- **Tables:** stems

### delete_stem
- **Description:** Supprime un stem
- **Params:** `_user_id` (uuid), `_stem_id` (uuid)
- **Returns:** void
- **Used in:** TrackContext.tsx, StemsTab.tsx
- **Tables:** stems

### update_stem_type
- **Description:** Change le type/label d'un stem
- **Params:** `_user_id` (uuid), `_stem_id` (uuid), `_stem_type` (text)
- **Returns:** void
- **Used in:** StemsTab.tsx
- **Tables:** stems

---

## Playlists

### create_playlist
- **Description:** Crée une nouvelle playlist
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_name` (text), `_description` (text), `_cover_url` (text)
- **Returns:** uuid (playlist ID)
- **Used in:** PlaylistContext.tsx, SmartAR.tsx
- **Tables:** playlists

### update_playlist
- **Description:** Met à jour les métadonnées d'une playlist
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_name` (text), `_description` (text), `_cover_url` (text)
- **Returns:** void
- **Used in:** PlaylistContext.tsx
- **Tables:** playlists

### delete_playlist
- **Description:** Supprime une playlist
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid)
- **Returns:** void
- **Used in:** PlaylistContext.tsx
- **Tables:** playlists

### add_playlist_tracks
- **Description:** Ajoute des tracks à une playlist (append)
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_track_ids` (uuid[])
- **Returns:** void
- **Used in:** PlaylistContext.tsx, SmartAR.tsx, Radio.tsx
- **Tables:** playlist_tracks

### replace_playlist_tracks
- **Description:** Remplace tous les tracks d'une playlist (reorder/remove)
- **Params:** `_user_id` (uuid), `_playlist_id` (uuid), `_track_ids` (uuid[])
- **Returns:** void
- **Used in:** PlaylistContext.tsx
- **Tables:** playlist_tracks

### clean_revoked_playlist_tracks
- **Description:** Supprime les tracks révoqués des playlists du workspace cible
- **Params:** `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_track_id` (uuid, optional)
- **Returns:** integer (nombre supprimé)
- **Used in:** ShareToWorkspaceModal.tsx
- **Tables:** playlist_tracks

---

## Pitches

### create_pitch
- **Description:** Crée un pitch (envoi de tracks/playlists à un contact)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_recipient_name` (text), `_recipient_email` (text), `_recipient_company` (text), `_subject` (text), `_message` (text), `_track_ids` (uuid[]), `_playlist_ids` (uuid[]), `_link_type` (text), `_status` (text)
- **Returns:** void
- **Used in:** PitchContext.tsx
- **Tables:** pitches

---

## Contacts

### upsert_contact
- **Description:** Crée ou met à jour un contact dans le workspace
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_first_name` (text), `_last_name` (text), `_email` (text), `_role` (text), `_company` (text), `_phone` (text)
- **Returns:** void
- **Used in:** ContactsContext.tsx
- **Tables:** contacts

### add_contact_manual
- **Description:** Ajoute un contact manuellement (formulaire)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_first_name` (text), `_last_name` (text), `_email` (text), `_role` (text), `_company` (text), `_phone` (text)
- **Returns:** void
- **Used in:** AddContactModal.tsx
- **Tables:** contacts

---

## Shared Links

### create_shared_link
- **Description:** Crée un shared link (track, playlist, stems, pack)
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_share_type` (text), `_track_id` (uuid, nullable), `_playlist_id` (uuid, nullable), `_link_name` (text), `_link_slug` (text), `_link_type` (text), `_password_hash` (text, nullable), `_message` (text, nullable), `_allow_download` (boolean), `_allow_save` (boolean), `_download_quality` (text, nullable), `_expires_at` (timestamptz, nullable), `_pack_items` (jsonb, nullable)
- **Returns:** json (link object)
- **Used in:** SharedLinksContext.tsx, PitchContext.tsx
- **Tables:** shared_links

### update_shared_link_status
- **Description:** Active ou désactive un shared link
- **Params:** `_user_id` (uuid), `_link_id` (uuid), `_disabled` (boolean)
- **Returns:** void
- **Used in:** SharedLinksContext.tsx
- **Tables:** shared_links

---

## Catalog Shares

### insert_catalog_share
- **Description:** Partage un track ou un catalog entier vers un autre workspace
- **Params:** `_user_id` (uuid), `_track_id` (uuid, nullable), `_source_workspace_id` (uuid), `_target_workspace_id` (uuid), `_access_level` (text)
- **Returns:** void
- **Used in:** ShareToWorkspaceModal.tsx, UploadTrackModal.tsx
- **Tables:** catalog_shares

### revoke_catalog_share
- **Description:** Révoque un partage de catalog (soft delete: status = 'revoked')
- **Params:** `_user_id` (uuid), `_share_id` (uuid)
- **Returns:** void
- **Used in:** ShareToWorkspaceModal.tsx, WorkspaceSettings.tsx
- **Tables:** catalog_shares

### get_workspace_catalog_shares
- **Description:** Liste les catalog shares actifs entrants pour un workspace
- **Params:** `_workspace_id` (uuid)
- **Returns:** json[] (array of catalog share objects)
- **Used in:** TrackContext.tsx, TrackReviewContext.tsx
- **Tables:** catalog_shares

### get_shared_workspace_tracks
- **Description:** Récupère les tracks d'un workspace source partagés avec un workspace cible
- **Params:** `_source_workspace_id` (uuid), `_target_workspace_id` (uuid)
- **Returns:** json[] (array of track objects)
- **Used in:** TrackContext.tsx, WorkspaceSwitcher.tsx
- **Tables:** tracks, catalog_shares

---

## Comments

### get_track_comments
- **Description:** Récupère les commentaires timecoded d'un track
- **Params:** `_track_id` (uuid)
- **Returns:** json[] (array of comment objects)
- **Used in:** TrackReviewContext.tsx
- **Tables:** track_comments

### add_track_comment
- **Description:** Ajoute un commentaire timecodé à un track
- **Params:** `_track_id` (uuid), `_author_name` (text), `_author_email` (text, nullable), `_author_type` (text), `_timestamp_sec` (numeric), `_content` (text)
- **Returns:** void
- **Used in:** TrackReviewContext.tsx
- **Tables:** track_comments

### delete_track_comment
- **Description:** Supprime un commentaire (soft delete)
- **Params:** `_comment_id` (uuid)
- **Returns:** void
- **Used in:** TrackReviewContext.tsx
- **Tables:** track_comments

---

## Approvals

### insert_approval
- **Description:** Crée une demande d'approbation pour un envoi
- **Params:** `_user_id` (uuid), `_workspace_id` (uuid), `_track_id` (uuid), `_send_type` (text), `_team_id` (uuid, nullable)
- **Returns:** uuid (approval ID)
- **Used in:** ApprovalContext.tsx
- **Tables:** approvals

### update_approval_status
- **Description:** Approuve ou rejette une demande
- **Params:** `_user_id` (uuid), `_approval_id` (uuid), `_status` (text: 'approved' | 'rejected'), `_note` (text, nullable)
- **Returns:** void
- **Used in:** ApprovalContext.tsx
- **Tables:** approvals

---

## Documents

### insert_track_document
- **Description:** Attache un document à un track (contrat, rider, etc.)
- **Params:** `_user_id` (uuid), `_track_id` (uuid), `_name` (text), `_file_url` (text), `_file_size` (bigint), `_doc_type` (text)
- **Returns:** void
- **Used in:** TrackDetail.tsx
- **Tables:** documents

### delete_track_document
- **Description:** Supprime un document attaché
- **Params:** `_user_id` (uuid), `_doc_id` (uuid)
- **Returns:** void
- **Used in:** TrackDetail.tsx
- **Tables:** documents

### update_track_document_status
- **Description:** Met à jour le statut d'un document (draft, final, etc.)
- **Params:** `_user_id` (uuid), `_doc_id` (uuid), `_status` (text)
- **Returns:** void
- **Used in:** TrackDetail.tsx
- **Tables:** documents

---

## Team & Members

### remove_workspace_member
- **Description:** Retire un membre d'un workspace
- **Params:** `_user_id` (uuid), `_member_user_id` (uuid), `_workspace_id` (uuid)
- **Returns:** void
- **Used in:** TeamContext.tsx
- **Tables:** workspace_members

### update_member_role
- **Description:** Met à jour le rôle et le titre professionnel d'un membre
- **Params:** `_user_id` (uuid), `_member_user_id` (uuid), `_workspace_id` (uuid), `_access_level` (text), `_professional_title` (text, nullable)
- **Returns:** void
- **Used in:** TeamContext.tsx
- **Tables:** workspace_members, user_roles

---

## Notifications

### upsert_notification_preferences
- **Description:** Met à jour les préférences de notification email d'un utilisateur
- **Params:** `_user_id` (uuid), `_preferences` (jsonb — clés: link_activity, comments, signatures, new_member_joined, track_uploads)
- **Returns:** void
- **Used in:** SettingsPage.tsx
- **Tables:** notification_preferences

---

## Studio (Submissions & QR)

### update_studio_submission_status
- **Description:** Accepte ou rejette une soumission studio (collaborator submission via QR)
- **Params:** `_user_id` (uuid), `_submission_id` (uuid), `_status` (text: 'accepted' | 'rejected')
- **Returns:** void
- **Used in:** TrackDetail.tsx
- **Tables:** studio_submissions

---

## Security (Edge Functions only)

### check_rate_limit
- **Description:** Vérifie et incrémente un compteur de rate limiting
- **Params:** `_key` (text), `_max_requests` (integer), `_window_seconds` (integer)
- **Returns:** boolean (true = allowed, false = rate limited)
- **Used in:** Edge Functions: get-audio-url, verify-link-password, send-pitch-email, send-invitation-email
- **Tables:** rate_limits

---

## Pattern pour créer une nouvelle RPC

```sql
CREATE OR REPLACE FUNCTION nom_de_la_rpc(_user_id uuid, _autres_params ...)
RETURNS ... AS $$
BEGIN
  -- Vérifier que l'utilisateur a le droit
  -- Exécuter la query
  -- Retourner le résultat
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Règles :
1. Toujours `SECURITY DEFINER` (bypass RLS)
2. Toujours `_user_id uuid` comme premier paramètre
3. Toujours vérifier les permissions dans la fonction elle-même
4. Fournir le SQL à Yannick — JAMAIS exécuter automatiquement
