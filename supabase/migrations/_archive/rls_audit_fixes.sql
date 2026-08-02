-- ═══════════════════════════════════════════════════════════════════════
-- TRAKALOG — RLS AUDIT FIXES — 2026-05-10
-- ═══════════════════════════════════════════════════════════════════════
--
-- Voir le rapport complet : docs/RLS_AUDIT_2026-05-10.md
--
-- ⚠️ AVANT D'EXÉCUTER :
--
--   1. Dump l'état actuel des policies prod :
--        SELECT schemaname, tablename, policyname, cmd, qual, with_check
--        FROM pg_policies WHERE schemaname = 'public'
--        ORDER BY tablename, policyname;
--      Compare avec ce que ce script va modifier.
--
--   2. Dump les RPCs SECURITY DEFINER de prod :
--        SELECT proname, pg_get_functiondef(oid)
--        FROM pg_proc
--        WHERE pronamespace = 'public'::regnamespace AND prosecdef = true;
--
--   3. Lis les sections 0 → 11 ci-dessous pour comprendre l'impact.
--
--   4. Exécute SECTION PAR SECTION dans le SQL Editor Supabase, pas tout
--      d'un coup. Vérifie après chaque section qu'aucune query du
--      frontend n'est cassée (test manuel).
--
--   5. Toutes les commandes utilisent IF EXISTS / OR REPLACE pour être
--      idempotentes — tu peux les rejouer sans crash.
--
-- Sections :
--   0. Helper functions (hiérarchie access_level)
--   1. workspaces
--   2. workspace_members
--   3. user_roles (à figer ou abandonner)
--   4. tracks
--   5. stems
--   6. track_documents 🔴 P0
--   7. Storage policies — bucket documents 🔴 P0
--   8. playlists + playlist_tracks
--   9. contacts
--   10. pitches
--   11. shared_links
--   12. approvals
--   13. notifications 🔴 P0
--   14. track_comments
--   15. RPCs — exemples corrigés (insert_track, update_track, upsert_contact)
--   16. Tables non-versionnées — checklist de vérification manuelle
--
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 0 — Helper functions pour la hiérarchie access_level
-- ═══════════════════════════════════════════════════════════════════════
-- La matrice (RoleContext.tsx:56-133) :
--   viewer  (1) — lecture seule
--   pitcher (2) — + playlists, pitches, shared_links, edit own tracks
--   editor  (3) — + edit all tracks, stems, docs, lyrics
--   admin   (4) — tout (splits, members, branding, delete, settings)
--
-- L'owner du workspace est admin de facto (cf. RoleContext.tsx:161-165),
-- même si aucune entrée workspace_members n'existe pour lui.

CREATE OR REPLACE FUNCTION public.workspace_access_rank(_level text)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _level
    WHEN 'viewer'  THEN 1
    WHEN 'pitcher' THEN 2
    WHEN 'editor'  THEN 3
    WHEN 'admin'   THEN 4
    ELSE 0
  END;
$$;

-- Renvoie TRUE si _user_id a au moins le niveau _min_level dans _workspace_id
-- ou s'il est l'owner du workspace.
CREATE OR REPLACE FUNCTION public.has_workspace_access_level(
  _user_id uuid,
  _workspace_id uuid,
  _min_level text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Owner = admin de facto
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = _workspace_id AND owner_id = _user_id
    )
    OR
    -- Sinon, check workspace_members.access_level
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = _user_id
        AND workspace_id = _workspace_id
        AND public.workspace_access_rank(access_level)
            >= public.workspace_access_rank(_min_level)
    );
$$;

-- Raccourci : admin only (utilisé partout, plus lisible)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(
  _user_id uuid,
  _workspace_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_workspace_access_level(_user_id, _workspace_id, 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.workspace_access_rank(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access_level(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) TO authenticated;

-- Index utile pour les checks RLS (idempotent)
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_ws_level
  ON public.workspace_members (user_id, workspace_id, access_level);


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1 — workspaces
-- ═══════════════════════════════════════════════════════════════════════
-- Avant : "Admins can update workspace" utilisait has_workspace_role.
-- Après : utilise has_workspace_access_level('admin') (qui inclut owner).

DROP POLICY IF EXISTS "Admins can update workspace" ON public.workspaces;

CREATE POLICY "workspaces_update_admin"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), id));

-- Les autres policies (SELECT, INSERT, DELETE) restent inchangées.


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2 — workspace_members
-- ═══════════════════════════════════════════════════════════════════════
-- Migration des INSERT/UPDATE/DELETE vers access_level.
-- SELECT et "Members can leave workspace" inchangées.

DROP POLICY IF EXISTS "Admins can invite members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;

CREATE POLICY "workspace_members_insert_admin"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "workspace_members_update_admin"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "workspace_members_delete_admin"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3 — user_roles (LEGACY — à figer)
-- ═══════════════════════════════════════════════════════════════════════
-- Décision de l'audit : abandonner `user_roles` comme source de vérité.
-- On supprime les policies qui s'appuient dessus (les nouvelles policies
-- des autres tables utilisent désormais access_level uniquement).
--
-- ⚠️ NE PAS DROP la table user_roles tant qu'on n'a pas confirmé qu'aucun
-- code (frontend + Edge Functions + RPCs) ne la lit/écrit. C'est une étape
-- P1 séparée. Ici on se contente de figer les policies pour qu'elle ne
-- bloque rien et qu'elle reste lisible par les admins.

-- Les policies existantes ("Admins can insert roles", etc.) deviennent
-- inutiles mais on les garde pour l'instant. Elles n'auront aucun impact
-- car aucune nouvelle policy/RPC ne touchera user_roles.

-- TODO P1 (à exécuter dans une migration séparée après validation) :
--   DROP TABLE public.user_roles CASCADE;
--   DROP FUNCTION public.has_workspace_role(uuid, uuid, app_role);
--   DROP FUNCTION public.has_any_workspace_role(uuid, uuid, app_role[]);
--   DROP TYPE public.app_role;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4 — tracks
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Creators can upload tracks" ON public.tracks;
DROP POLICY IF EXISTS "Write roles can edit all tracks" ON public.tracks;
DROP POLICY IF EXISTS "Creators can edit own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Admins can delete tracks" ON public.tracks;

-- INSERT : pitcher+ peut uploader (matrice : Pitcher canUploadTracks = true)
CREATE POLICY "tracks_insert_pitcher"
  ON public.tracks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND uploaded_by = auth.uid()
  );

-- UPDATE : editor+ peut tout éditer, pitcher peut éditer ses propres tracks
CREATE POLICY "tracks_update_editor_or_own"
  ON public.tracks FOR UPDATE TO authenticated
  USING (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'editor')
    OR (
      public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
      AND uploaded_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'editor')
    OR (
      public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
      AND uploaded_by = auth.uid()
    )
  );

-- DELETE : admin only
CREATE POLICY "tracks_delete_admin"
  ON public.tracks FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- SELECT et anon SELECT restent inchangées.


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 5 — stems
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Creators can upload stems" ON public.stems;
DROP POLICY IF EXISTS "Write roles can edit stems" ON public.stems;
DROP POLICY IF EXISTS "Creators can edit own stems" ON public.stems;
DROP POLICY IF EXISTS "Admins can delete stems" ON public.stems;

-- INSERT : editor+ (les stems sont du contenu technique, pas une simple
-- upload de pitch — Pitcher ne peut pas ajouter de stems)
CREATE POLICY "stems_insert_editor"
  ON public.stems FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'editor')
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "stems_update_editor"
  ON public.stems FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'));

CREATE POLICY "stems_delete_admin"
  ON public.stems FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- ⚠️ VÉRIFIER : pages publiques (SharedStemAccess.tsx:239) lisent stems
-- avec un client anon. Il faut une policy anon SELECT. Si elle n'existe
-- pas en prod, ajouter :
--
-- CREATE POLICY "anon_read_stems_via_shared_link"
--   ON public.stems FOR SELECT TO anon
--   USING (
--     track_id IN (
--       SELECT track_id FROM public.shared_links
--       WHERE status = 'active' AND share_type IN ('stems', 'pack')
--     )
--   );


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 6 — track_documents 🔴 P0
-- ═══════════════════════════════════════════════════════════════════════
-- Avant : tout member pouvait INSERT/UPDATE.
-- Après : INSERT/UPDATE → editor+. SELECT → tout member. DELETE → uploader OR admin.

DROP POLICY IF EXISTS "Workspace members can view documents" ON public.track_documents;
DROP POLICY IF EXISTS "Workspace members can insert documents" ON public.track_documents;
DROP POLICY IF EXISTS "Workspace members can update documents" ON public.track_documents;
DROP POLICY IF EXISTS "Uploader or admin can delete documents" ON public.track_documents;

CREATE POLICY "track_documents_select_members"
  ON public.track_documents FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "track_documents_insert_editor"
  ON public.track_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'editor')
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "track_documents_update_editor"
  ON public.track_documents FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'));

CREATE POLICY "track_documents_delete_owner_or_admin"
  ON public.track_documents FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 7 — Storage policies — bucket "documents" 🔴 P0
-- ═══════════════════════════════════════════════════════════════════════
-- AVANT : tout authenticated avec bucket_id = 'documents' → cross-workspace leak.
-- APRÈS : path doit commencer par {workspace_id}/, et l'user doit être member.
--
-- ⚠️ Cela suppose que les uploads existants utilisent le pattern
-- "{workspace_id}/{track_id}/{filename}". Vérifier dans le code (track
-- documents upload). Si le pattern actuel est différent, adapter le
-- storage.foldername() check ci-dessous AVANT d'exécuter.

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own documents" ON storage.objects;

-- INSERT : editor+ dans le workspace dont l'UUID est le 1er segment du path
CREATE POLICY "documents_storage_insert_editor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.has_workspace_access_level(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'editor'
    )
  );

-- SELECT : tout member du workspace
CREATE POLICY "documents_storage_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_workspace_member(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

-- DELETE : uploader OR admin (basé sur metadata uploader, sinon admin)
CREATE POLICY "documents_storage_delete_owner_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      owner = auth.uid()
      OR public.is_workspace_admin(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 8 — playlists + playlist_tracks
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Write roles can create playlists" ON public.playlists;
DROP POLICY IF EXISTS "Write roles can edit playlists" ON public.playlists;
DROP POLICY IF EXISTS "Admins can delete playlists" ON public.playlists;

CREATE POLICY "playlists_insert_pitcher"
  ON public.playlists FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND created_by = auth.uid()
  );

CREATE POLICY "playlists_update_pitcher"
  ON public.playlists FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'));

CREATE POLICY "playlists_delete_admin"
  ON public.playlists FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- playlist_tracks
DROP POLICY IF EXISTS "Write roles can add playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Write roles can update playlist tracks" ON public.playlist_tracks;
DROP POLICY IF EXISTS "Admins can delete playlist tracks" ON public.playlist_tracks;

CREATE POLICY "playlist_tracks_insert_pitcher"
  ON public.playlist_tracks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_access_level(auth.uid(), p.workspace_id, 'pitcher')
    )
  );

CREATE POLICY "playlist_tracks_update_pitcher"
  ON public.playlist_tracks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_access_level(auth.uid(), p.workspace_id, 'pitcher')
    )
  );

CREATE POLICY "playlist_tracks_delete_pitcher"
  ON public.playlist_tracks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_access_level(auth.uid(), p.workspace_id, 'pitcher')
    )
  );
-- Note : playlist_tracks DELETE est volontairement étendu à 'pitcher' (et
-- non 'admin' comme avant). Raison : retirer un track d'une playlist fait
-- partie du flow "edit playlist", autorisé pour les Pitchers.
-- L'ancienne policy "Admins can delete playlist tracks" était trop stricte
-- (le frontend appelle replace_playlist_tracks via RPC qui DELETE puis
-- INSERT — il faut donc le DELETE dispo pour pitcher).


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 9 — contacts
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Write roles can create contacts" ON public.contacts;
DROP POLICY IF EXISTS "Write roles can edit contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "contacts_insert_pitcher"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'));

CREATE POLICY "contacts_update_pitcher"
  ON public.contacts FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'));

CREATE POLICY "contacts_delete_admin"
  ON public.contacts FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 10 — pitches
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Write roles can create pitches" ON public.pitches;
DROP POLICY IF EXISTS "Write roles can update pitches" ON public.pitches;
DROP POLICY IF EXISTS "Admins can delete pitches" ON public.pitches;

CREATE POLICY "pitches_insert_pitcher"
  ON public.pitches FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND sent_by = auth.uid()
  );

CREATE POLICY "pitches_update_pitcher"
  ON public.pitches FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'));

CREATE POLICY "pitches_delete_admin"
  ON public.pitches FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 11 — shared_links
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Write roles can create shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Write roles can update shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Admins can delete shared links" ON public.shared_links;
DROP POLICY IF EXISTS "Creators can delete own shared links" ON public.shared_links;

CREATE POLICY "shared_links_insert_pitcher"
  ON public.shared_links FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND created_by = auth.uid()
  );

CREATE POLICY "shared_links_update_pitcher"
  ON public.shared_links FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher'));

CREATE POLICY "shared_links_delete_admin"
  ON public.shared_links FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- L'ancienne policy "Creators can delete own shared links" est retirée :
-- pour annuler un lien, le frontend utilise update_shared_link_status
-- (UPDATE disabled = true), pas DELETE.


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 12 — approvals
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Members can request approvals" ON public.approvals;
DROP POLICY IF EXISTS "Admins can update approvals" ON public.approvals;
DROP POLICY IF EXISTS "Admins can delete approvals" ON public.approvals;

-- INSERT : pitcher+ (seuls eux envoient des pitches → eux seuls demandent approbation)
CREATE POLICY "approvals_insert_pitcher"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND requested_by = auth.uid()
  );

-- UPDATE : admin only (approve/reject)
CREATE POLICY "approvals_update_admin"
  ON public.approvals FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "approvals_delete_admin"
  ON public.approvals FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 13 — notifications 🔴 P0
-- ═══════════════════════════════════════════════════════════════════════
-- AVANT : tout member pouvait insert pour n'importe quel user_id.
-- APRÈS : INSERT impossible directement via la table — passer par une RPC
-- SECURITY DEFINER qui valide l'acteur. Pour la transition, on autorise
-- INSERT seulement si auth.uid() = user_id (notification créée pour
-- soi-même), ce qui couvre la plupart des cas frontend (un user qui
-- s'auto-marque "track lu", etc.). Toute notification cross-user devra
-- passer par une RPC create_notification à créer en P1.

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "notifications_insert_self_only"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_workspace_member(auth.uid(), workspace_id)
  );

-- ⚠️ ACTION P1 : créer une RPC create_notification(_actor_id, _target_user_id,
-- _workspace_id, _kind, _payload) SECURITY DEFINER qui :
--   1. Vérifie que _actor_id est member de _workspace_id
--   2. Vérifie que _target_user_id est member de _workspace_id
--   3. Vérifie que _kind est dans une whitelist
--   4. INSERT
-- Et migrer tous les usages frontend qui créent des notifs cross-user.


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 14 — track_comments
-- ═══════════════════════════════════════════════════════════════════════
-- Le repo n'a pas de CREATE TABLE pour track_comments → vérifier en prod.
-- Les policies anon existent mais aucune policy authenticated.
-- À ajouter (compatible avec les RPCs get_track_comments, add_track_comment,
-- delete_track_comment qui sont SECURITY DEFINER et bypassent RLS, mais on
-- veut quand même un fallback safe).

-- ⚠️ Décommenter et exécuter SEULEMENT après vérification que track_comments
-- existe en prod et que ses colonnes correspondent (track_id, shared_link_id,
-- author_type, content, etc.)

-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'track_comments') THEN
--     EXECUTE 'DROP POLICY IF EXISTS "Members can view track comments" ON public.track_comments';
--     EXECUTE 'CREATE POLICY "track_comments_select_members"
--       ON public.track_comments FOR SELECT TO authenticated
--       USING (
--         EXISTS (
--           SELECT 1 FROM public.tracks t
--           WHERE t.id = track_comments.track_id
--             AND public.is_workspace_member(auth.uid(), t.workspace_id)
--         )
--       )';
--   END IF;
-- END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 15 — RPCs corrigées (3 exemples)
-- ═══════════════════════════════════════════════════════════════════════
-- Template à utiliser pour les 41 autres RPCs documentées dans RPCS.md.

-- ─── 15.1 insert_track ──────────────────────────────────────────────
-- AVANT : vérifie seulement membership. APRÈS : vérifie access_level >= pitcher.

CREATE OR REPLACE FUNCTION public.insert_track(
  _user_id uuid,
  _workspace_id uuid,
  _title text,
  _artist text DEFAULT NULL,
  _featuring text DEFAULT NULL,
  _type text DEFAULT 'single',
  _status text DEFAULT 'draft',
  _bpm numeric DEFAULT NULL,
  _key text DEFAULT NULL,
  _genre text[] DEFAULT NULL,
  _mood text[] DEFAULT NULL,
  _isrc text DEFAULT NULL,
  _cover_url text DEFAULT NULL,
  _waveform_data jsonb DEFAULT NULL,
  _chapters jsonb DEFAULT NULL,
  _audio_preview_url text DEFAULT NULL,
  _qr_token text DEFAULT NULL
)
RETURNS json AS $func$
DECLARE
  new_track public.tracks%ROWTYPE;
BEGIN
  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, 'pitcher') THEN
    RAISE EXCEPTION 'Insufficient permissions: pitcher or higher required to upload tracks';
  END IF;

  INSERT INTO public.tracks (
    workspace_id, title, artist, featuring, type, status,
    bpm, key, genre, mood, isrc, cover_url,
    waveform_data, chapters, audio_preview_url, qr_token,
    uploaded_by
  ) VALUES (
    _workspace_id, _title, _artist, _featuring, _type, _status,
    _bpm, _key, _genre, _mood, _isrc, _cover_url,
    _waveform_data, _chapters, _audio_preview_url, _qr_token,
    _user_id
  )
  RETURNING * INTO new_track;

  RETURN row_to_json(new_track);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.insert_track(uuid, uuid, text, text, text, text, text, numeric, text, text[], text[], text, text, jsonb, jsonb, text, text) TO authenticated;


-- ─── 15.2 update_track ─────────────────────────────────────────────
-- AVANT : vérifie seulement membership. APRÈS : editor+ OU pitcher+ pour son own track.

CREATE OR REPLACE FUNCTION public.update_track(
  _user_id uuid,
  _track_id uuid,
  _updates jsonb
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_uploaded_by uuid;
  v_can_edit boolean;
BEGIN
  SELECT workspace_id, uploaded_by
    INTO v_workspace_id, v_uploaded_by
  FROM public.tracks
  WHERE id = _track_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  -- editor+ peut tout, pitcher+ peut son own
  v_can_edit :=
    public.has_workspace_access_level(_user_id, v_workspace_id, 'editor')
    OR (
      public.has_workspace_access_level(_user_id, v_workspace_id, 'pitcher')
      AND v_uploaded_by = _user_id
    );

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'Insufficient permissions to edit this track';
  END IF;

  -- Mise à jour partielle via jsonb (mêmes champs que l'ancienne RPC)
  UPDATE public.tracks SET
    title              = COALESCE(_updates->>'title', title),
    artist             = COALESCE(_updates->>'artist', artist),
    featuring          = COALESCE(_updates->>'featuring', featuring),
    type               = COALESCE(_updates->>'type', type),
    status             = COALESCE(_updates->>'status', status),
    bpm                = COALESCE((_updates->>'bpm')::numeric, bpm),
    key                = COALESCE(_updates->>'key', key),
    genre              = COALESCE(
                           CASE WHEN _updates ? 'genre'
                                THEN ARRAY(SELECT jsonb_array_elements_text(_updates->'genre'))
                                ELSE NULL END,
                           genre
                         ),
    mood               = COALESCE(
                           CASE WHEN _updates ? 'mood'
                                THEN ARRAY(SELECT jsonb_array_elements_text(_updates->'mood'))
                                ELSE NULL END,
                           mood
                         ),
    isrc               = COALESCE(_updates->>'isrc', isrc),
    cover_url          = COALESCE(_updates->>'cover_url', cover_url),
    lyrics             = COALESCE(_updates->>'lyrics', lyrics),
    sonic_dna          = COALESCE(_updates->'sonic_dna', sonic_dna),
    waveform_data      = COALESCE(_updates->'waveform_data', waveform_data),
    chapters           = COALESCE(_updates->'chapters', chapters),
    splits             = COALESCE(_updates->'splits', splits),
    audio_preview_url  = COALESCE(_updates->>'audio_preview_url', audio_preview_url),
    qr_token           = COALESCE(_updates->>'qr_token', qr_token),
    updated_at         = now()
  WHERE id = _track_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_track(uuid, uuid, jsonb) TO authenticated;

-- ⚠️ Note importante : l'édition de splits doit être réservée aux admins
-- selon la matrice (canManageSplits: admin only). La RPC ci-dessus
-- autorise editor à modifier splits via _updates->'splits' — ce n'est PAS
-- conforme à la matrice.
--
-- Recommandation : extraire splits en RPC séparée update_track_splits
-- qui exige access_level = 'admin', et bloquer le champ splits dans
-- update_track. Voir docs/RLS_AUDIT_2026-05-10.md section P0 pour le détail.
--
-- Fix proposé (à activer si voulu, casse aucun appel actuel car le
-- frontend envoie déjà splits via update_track) :
--
--   IF _updates ? 'splits' AND NOT public.is_workspace_admin(_user_id, v_workspace_id) THEN
--     RAISE EXCEPTION 'Only admins can edit splits';
--   END IF;


-- ─── 15.3 upsert_contact ──────────────────────────────────────────
-- AVANT : vérifie seulement membership. APRÈS : pitcher+ (matrice contacts).

CREATE OR REPLACE FUNCTION public.upsert_contact(
  _user_id uuid,
  _workspace_id uuid,
  _first_name text,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _role text DEFAULT NULL,
  _stage_name text DEFAULT NULL,
  _company text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _pro text[] DEFAULT NULL,
  _ipi text DEFAULT NULL,
  _publisher text DEFAULT NULL
)
RETURNS uuid AS $func$
DECLARE
  v_existing_id uuid;
  v_norm_email text := NULLIF(btrim(lower(_email)), '');
  v_norm_first text := NULLIF(btrim(lower(_first_name)), '');
  v_norm_last  text := NULLIF(btrim(lower(_last_name)), '');
BEGIN
  -- Permission check : pitcher+ requis pour créer/éditer contacts
  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, 'pitcher') THEN
    RAISE EXCEPTION 'Insufficient permissions: pitcher or higher required to manage contacts';
  END IF;

  IF v_norm_first IS NULL AND v_norm_email IS NULL THEN
    RAISE EXCEPTION 'Either first_name or email is required';
  END IF;

  -- Dedupe par email si fourni, sinon par (first_name, last_name)
  IF v_norm_email IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.contacts
    WHERE workspace_id = _workspace_id
      AND lower(email) = v_norm_email
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_id
    FROM public.contacts
    WHERE workspace_id = _workspace_id
      AND lower(first_name) = v_norm_first
      AND lower(coalesce(last_name, '')) = coalesce(v_norm_last, '')
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE — n'écrase jamais avec NULL/empty
    UPDATE public.contacts SET
      first_name = COALESCE(NULLIF(btrim(_first_name), ''), first_name),
      last_name  = COALESCE(NULLIF(btrim(_last_name), ''), last_name),
      email      = COALESCE(NULLIF(btrim(_email), ''), email),
      role       = COALESCE(NULLIF(btrim(_role), ''), role),
      stage_name = COALESCE(NULLIF(btrim(_stage_name), ''), stage_name),
      company    = COALESCE(NULLIF(btrim(_company), ''), company),
      phone      = COALESCE(NULLIF(btrim(_phone), ''), phone),
      pro        = COALESCE(_pro, pro),
      ipi        = COALESCE(NULLIF(btrim(_ipi), ''), ipi),
      publisher  = COALESCE(NULLIF(btrim(_publisher), ''), publisher),
      updated_at = now()
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    -- INSERT
    INSERT INTO public.contacts (
      workspace_id, first_name, last_name, email, role,
      stage_name, company, phone, pro, ipi, publisher
    ) VALUES (
      _workspace_id,
      NULLIF(btrim(_first_name), ''),
      NULLIF(btrim(_last_name), ''),
      NULLIF(btrim(_email), ''),
      NULLIF(btrim(_role), ''),
      NULLIF(btrim(_stage_name), ''),
      NULLIF(btrim(_company), ''),
      NULLIF(btrim(_phone), ''),
      _pro,
      NULLIF(btrim(_ipi), ''),
      NULLIF(btrim(_publisher), '')
    )
    RETURNING id INTO v_existing_id;

    RETURN v_existing_id;
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text[], text, text) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 16 — Tables non-versionnées (checklist manuelle)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Pour CHACUNE de ces tables, exécute dans le SQL Editor :
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies WHERE tablename = '<table>' AND schemaname = 'public';
--
-- Et vérifie qu'elle correspond à la matrice access_level.
--
-- Tables à auditer manuellement (non versionnées) :
--   ☐ catalog_shares       — SELECT scopé par source OR target workspace
--                            INSERT/UPDATE → admin only (le partage est sensible)
--   ☐ invitations          — SELECT anon par token, INSERT admin only
--   ☐ audit_logs           — SELECT scopé par workspace_id (admin), INSERT via RPC only
--   ☐ link_events          — SELECT scopé par link.workspace_id, INSERT anon
--                            (déclenché par log-link-event Edge Function)
--   ☐ notification_preferences — SELECT/UPDATE self only (user_id = auth.uid())
--   ☐ signature_requests   — SELECT anon par token uniquement, UPDATE anon
--                            scopée à status/signed_at/signature_data + token
--   ☐ studio_submissions   — INSERT anon scopé à track.qr_token, SELECT
--                            workspace member, UPDATE admin only
--   ☐ profiles             — SELECT public mais limité aux colonnes display
--                            (first_name, last_name, avatar_url) — PAS email/phone
--   ☐ track_versions       — si existe : mêmes policies que tracks
--
-- Tables à versionner dans une migration séparée (P1) :
-- copier le pg_dump --schema-only de la prod et le committer.

-- ═══════════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════════
