-- ═══════════════════════════════════════════════════════════════════════
-- TRAKALOG — RLS PHASE 1 — DRIFT FIX (user_roles → access_level)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Date            : 2026-05-10
-- Auteur          : audit Claude, validation Yannick
-- Référence       : docs/RLS_AUDIT_2026-05-10.md, docs/RLS_PHASE1_GUIDE.md
-- Périmètre       : 11 tables avec drift legacy → nouveau système access_level
--                   + hardening track_documents (P0) + notifications (P0)
-- Hors périmètre  : storage policies, tables non-versionnées (P2),
--                   triggers handle_new_user / create_workspace_with_member (P2)
--
-- ⚠️ AVANT D'EXÉCUTER :
--
--   1. Lis docs/RLS_PHASE1_GUIDE.md (ordre d'exécution + tests).
--   2. Dump l'état actuel pour comparer après :
--        SELECT tablename, policyname, cmd
--        FROM pg_policies
--        WHERE schemaname = 'public'
--        ORDER BY tablename, policyname;
--   3. Exécute SECTION PAR SECTION dans le SQL Editor Supabase.
--   4. Toutes les commandes sont idempotentes (DROP IF EXISTS / OR REPLACE).
--   5. Aucune table n'est supprimée. user_roles reste en place (legacy figé).
--
-- Notation des sections :
--   S0  → helper function
--   S1  → workspaces
--   S2  → workspace_members
--   S3  → tracks
--   S4  → stems
--   S5  → contacts
--   S6  → pitches
--   S7  → playlists
--   S8  → playlist_tracks
--   S9  → shared_links
--   S10 → approvals
--   S11 → track_documents (P0)
--   S12 → notifications hardening + RPC create_notification (P0)
--   S13 → user_roles legacy notice
--
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- S0 — Helper has_workspace_access_level
-- ═══════════════════════════════════════════════════════════════════════
-- Hiérarchie : viewer (1) < pitcher (2) < editor (3) < admin (4).
-- Le owner du workspace est admin de facto (cf. RoleContext.tsx:161-165).
-- STABLE = même résultat dans une transaction → optimisable par Postgres.
-- SECURITY DEFINER = bypass RLS pour lire workspace_members sans récursion.

CREATE OR REPLACE FUNCTION public.has_workspace_access_level(
  _user_id uuid,
  _workspace_id uuid,
  _min_level text
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _level text;
  _hierarchy int;
  _required int;
BEGIN
  -- Owner du workspace = admin de facto
  IF EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Sinon, lire access_level depuis workspace_members
  SELECT access_level INTO _level
  FROM workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id;

  IF _level IS NULL THEN
    RETURN false;
  END IF;

  _hierarchy := CASE _level
    WHEN 'viewer'  THEN 1
    WHEN 'pitcher' THEN 2
    WHEN 'editor'  THEN 3
    WHEN 'admin'   THEN 4
    ELSE 0
  END;

  _required := CASE _min_level
    WHEN 'viewer'  THEN 1
    WHEN 'pitcher' THEN 2
    WHEN 'editor'  THEN 3
    WHEN 'admin'   THEN 4
    ELSE 0
  END;

  RETURN _hierarchy >= _required;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_workspace_access_level(uuid, uuid, text)
  TO authenticated, anon;

-- Index pour accélérer le lookup workspace_members (idempotent)
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_ws_level
  ON public.workspace_members (user_id, workspace_id, access_level);

-- Test rapide (à exécuter manuellement avec un uid de test) :
--   SELECT public.has_workspace_access_level(
--     '<your-user-uid>'::uuid,
--     '<your-workspace-uid>'::uuid,
--     'admin'
--   );


-- ═══════════════════════════════════════════════════════════════════════
-- S1 — workspaces
-- ═══════════════════════════════════════════════════════════════════════
-- Avant : "Admins can update workspace" → has_workspace_role(..., 'admin')
-- Après : has_workspace_access_level(..., 'admin')
-- SELECT, INSERT, DELETE inchangés.

DROP POLICY IF EXISTS "Admins can update workspace" ON public.workspaces;

CREATE POLICY "workspaces_update_admin"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S2 — workspace_members
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT/UPDATE/DELETE → admin (matrice : seul admin gère l'équipe)
-- SELECT et "Members can leave workspace" inchangés.

DROP POLICY IF EXISTS "Admins can invite members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;

CREATE POLICY "workspace_members_insert_admin"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "workspace_members_update_admin"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "workspace_members_delete_admin"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S3 — tracks
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT  → pitcher+ (uploaded_by = auth.uid())
-- UPDATE  → editor+ (any track) OR pitcher+ (own track)
-- DELETE  → admin only
-- SELECT et anon SELECT inchangés.

DROP POLICY IF EXISTS "Creators can upload tracks" ON public.tracks;
DROP POLICY IF EXISTS "Write roles can edit all tracks" ON public.tracks;
DROP POLICY IF EXISTS "Creators can edit own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Admins can delete tracks" ON public.tracks;

CREATE POLICY "tracks_insert_pitcher"
  ON public.tracks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "tracks_update_editor_all"
  ON public.tracks FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'));

CREATE POLICY "tracks_update_pitcher_own"
  ON public.tracks FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
  );

CREATE POLICY "tracks_delete_admin"
  ON public.tracks FOR DELETE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S4 — stems
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT → pitcher+ (uploaded_by = auth.uid())
-- UPDATE → editor+
-- DELETE → editor+
-- SELECT inchangé.

DROP POLICY IF EXISTS "Creators can upload stems" ON public.stems;
DROP POLICY IF EXISTS "Write roles can edit stems" ON public.stems;
DROP POLICY IF EXISTS "Creators can edit own stems" ON public.stems;
DROP POLICY IF EXISTS "Admins can delete stems" ON public.stems;

CREATE POLICY "stems_insert_pitcher"
  ON public.stems FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "stems_update_editor"
  ON public.stems FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'));

CREATE POLICY "stems_delete_editor"
  ON public.stems FOR DELETE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'editor'));


-- ═══════════════════════════════════════════════════════════════════════
-- S5 — contacts
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT/UPDATE → pitcher+ (matrice : Pitcher gère son carnet de contacts)
-- DELETE → admin

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
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S6 — pitches
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT → pitcher+ (sent_by = auth.uid())
-- UPDATE → pitcher+
-- DELETE → admin

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
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S7 — playlists
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT → pitcher+ (created_by = auth.uid())
-- UPDATE → pitcher+
-- DELETE → admin

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
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S8 — playlist_tracks
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT/UPDATE → pitcher+ (via la playlist parent)
-- DELETE → admin

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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_access_level(auth.uid(), p.workspace_id, 'pitcher')
    )
  );

CREATE POLICY "playlist_tracks_delete_admin"
  ON public.playlist_tracks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND public.has_workspace_access_level(auth.uid(), p.workspace_id, 'admin')
    )
  );

-- ⚠️ Note connue : la RPC replace_playlist_tracks fait DELETE puis INSERT.
-- Si elle est SECURITY DEFINER (à vérifier en prod), elle bypasse RLS et
-- DELETE → admin n'aura aucun impact. Si elle ne l'est pas, un Pitcher
-- qui réordonne sa playlist sera bloqué. À tester (cf. RLS_PHASE1_GUIDE).


-- ═══════════════════════════════════════════════════════════════════════
-- S9 — shared_links
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT → pitcher+ (created_by = auth.uid())
-- UPDATE → pitcher+
-- DELETE → admin (any link) OR creator (own link, pitcher+)

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
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));

-- Conservée et migrée vers access_level : un Pitcher peut delete son propre lien.
CREATE POLICY "shared_links_delete_pitcher_own"
  ON public.shared_links FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_workspace_access_level(auth.uid(), workspace_id, 'pitcher')
  );


-- ═══════════════════════════════════════════════════════════════════════
-- S10 — approvals
-- ═══════════════════════════════════════════════════════════════════════
-- INSERT → tout member (un Viewer peut demander une approbation pour un
--          track avant pitch → matrice ne le couvre pas explicitement,
--          on garde permissif)
-- UPDATE → admin only (approve / reject)
-- DELETE → admin

DROP POLICY IF EXISTS "Members can request approvals" ON public.approvals;
DROP POLICY IF EXISTS "Admins can update approvals" ON public.approvals;
DROP POLICY IF EXISTS "Admins can delete approvals" ON public.approvals;

CREATE POLICY "approvals_insert_member"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND requested_by = auth.uid()
  );

CREATE POLICY "approvals_update_admin"
  ON public.approvals FOR UPDATE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'))
  WITH CHECK (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));

CREATE POLICY "approvals_delete_admin"
  ON public.approvals FOR DELETE TO authenticated
  USING (public.has_workspace_access_level(auth.uid(), workspace_id, 'admin'));


-- ═══════════════════════════════════════════════════════════════════════
-- S11 — track_documents (P0 hardening)
-- ═══════════════════════════════════════════════════════════════════════
-- AVANT : tout member pouvait INSERT/UPDATE → un Viewer pouvait remplacer
--         un contrat. Critique pour les splits/agreements de Mosimann.
-- APRÈS :
--   SELECT → tout member
--   INSERT → editor+ (uploaded_by = auth.uid())
--   UPDATE → editor+
--   DELETE → uploader OR admin

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

CREATE POLICY "track_documents_delete_uploader_or_admin"
  ON public.track_documents FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_workspace_access_level(auth.uid(), workspace_id, 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════
-- S12 — notifications hardening + RPC create_notification (P0)
-- ═══════════════════════════════════════════════════════════════════════
-- AVANT : "System can create notifications" laissait n'importe quel member
--         INSERT pour n'importe quel user_id du workspace → spam / phishing.
-- APRÈS : aucune policy publique d'INSERT. Toute création passe par la RPC
--         create_notification (SECURITY DEFINER) qui valide acteur + cible.
--
-- L'audit confirme qu'aucun INSERT direct n'existe dans src/ — la migration
-- n'impacte donc pas l'UI. Les Edge Functions qui créent des notifs
-- utilisent la service_role key (bypasse RLS) ou pourront passer par la RPC.

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Les autres policies (SELECT/UPDATE/DELETE self-only) restent en place
-- et sont conformes à la matrice.

-- RPC create_notification : seul point d'entrée pour créer une notification.
-- Schéma prod confirmé après review :
--   notifications (id, workspace_id, user_id, type::notification_type,
--                  title NOT NULL, message, is_read, track_id, pitch_id,
--                  link_id, approval_id, created_at)
-- Title et type sont obligatoires.
CREATE OR REPLACE FUNCTION public.create_notification(
  _actor_user_id uuid,
  _target_user_id uuid,
  _workspace_id uuid,
  _type text,
  _title text,
  _message text DEFAULT NULL,
  _track_id uuid DEFAULT NULL,
  _pitch_id uuid DEFAULT NULL,
  _link_id uuid DEFAULT NULL,
  _approval_id uuid DEFAULT NULL
)
RETURNS uuid AS $func$
DECLARE
  v_notification_id uuid;
BEGIN
  -- 1. Valider l'acteur (qui crée la notif)
  IF _actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Actor user_id is required';
  END IF;

  IF NOT public.is_workspace_member(_actor_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Actor % is not a member of workspace %',
      _actor_user_id, _workspace_id;
  END IF;

  -- 2. Valider la cible (user qui reçoit la notif)
  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id is required';
  END IF;

  IF NOT public.is_workspace_member(_target_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Target % is not a member of workspace %',
      _target_user_id, _workspace_id;
  END IF;

  -- 3. Valider type (cast vers l'enum notification_type côté INSERT)
  IF _type IS NULL OR length(btrim(_type)) = 0 THEN
    RAISE EXCEPTION 'Notification type is required';
  END IF;

  -- 4. Valider title (NOT NULL en base)
  IF _title IS NULL OR length(btrim(_title)) = 0 THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;

  -- 5. INSERT (bypass RLS via SECURITY DEFINER)
  INSERT INTO public.notifications (
    workspace_id, user_id, type, title, message, is_read,
    track_id, pitch_id, link_id, approval_id, created_at
  ) VALUES (
    _workspace_id, _target_user_id, _type::public.notification_type, _title,
    _message, false,
    _track_id, _pitch_id, _link_id, _approval_id, now()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, uuid, uuid, text, text, text, uuid, uuid, uuid, uuid
) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- S13 — user_roles : notice legacy
-- ═══════════════════════════════════════════════════════════════════════
-- À partir de Phase 1, la table `user_roles` et les helpers
-- `has_workspace_role` / `has_any_workspace_role` ne sont PLUS utilisés
-- par aucune RLS policy de Trakalog. Ils restent en place uniquement pour :
--
--   1. Backward compat de TeamContext.tsx:104-115 qui lit la table pour
--      afficher l'ancien rôle (display only).
--   2. Triggers handle_new_user et create_workspace_with_member qui
--      insèrent encore dans user_roles à la création de workspace.
--
-- Plan de dépréciation (Phase 2, à exécuter dans une migration séparée
-- après ~2 semaines de stabilité en prod) :
--
--   1. Migrer handle_new_user et create_workspace_with_member pour qu'ils
--      insèrent dans workspace_members (access_level = 'admin') uniquement.
--   2. Retirer le SELECT user_roles dans TeamContext.tsx.
--   3. DROP les policies legacy sur user_roles (devenues inutiles).
--   4. DROP TABLE public.user_roles CASCADE.
--   5. DROP FUNCTION has_workspace_role / has_any_workspace_role.
--   6. DROP TYPE public.app_role.
--
-- Cette section ne fait rien — elle documente uniquement.

COMMENT ON TABLE public.user_roles IS
  'LEGACY (depuis 2026-05-10) — Table conservée pour backward compat. '
  'Aucune RLS policy ne s''appuie plus dessus. Source de vérité : '
  'workspace_members.access_level. À supprimer en Phase 2.';

COMMENT ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) IS
  'LEGACY (depuis 2026-05-10) — Plus utilisée par aucune RLS policy. '
  'Remplacée par has_workspace_access_level. À supprimer en Phase 2.';

COMMENT ON FUNCTION public.has_any_workspace_role(uuid, uuid, app_role[]) IS
  'LEGACY (depuis 2026-05-10) — Plus utilisée par aucune RLS policy. '
  'Remplacée par has_workspace_access_level. À supprimer en Phase 2.';


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════
-- Après exécution complète, ces requêtes doivent renvoyer 0 ligne :
--
-- (a) Aucune policy active ne doit encore référencer has_workspace_role :
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND (qual ILIKE '%has_workspace_role%'
--          OR qual ILIKE '%has_any_workspace_role%'
--          OR with_check ILIKE '%has_workspace_role%'
--          OR with_check ILIKE '%has_any_workspace_role%');
--
-- (b) Toutes les nouvelles policies doivent exister :
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname IN (
--       'workspaces_update_admin',
--       'workspace_members_insert_admin',
--       'workspace_members_update_admin',
--       'workspace_members_delete_admin',
--       'tracks_insert_pitcher',
--       'tracks_update_editor_all',
--       'tracks_update_pitcher_own',
--       'tracks_delete_admin',
--       'stems_insert_pitcher',
--       'stems_update_editor',
--       'stems_delete_editor',
--       'contacts_insert_pitcher',
--       'contacts_update_pitcher',
--       'contacts_delete_admin',
--       'pitches_insert_pitcher',
--       'pitches_update_pitcher',
--       'pitches_delete_admin',
--       'playlists_insert_pitcher',
--       'playlists_update_pitcher',
--       'playlists_delete_admin',
--       'playlist_tracks_insert_pitcher',
--       'playlist_tracks_update_pitcher',
--       'playlist_tracks_delete_admin',
--       'shared_links_insert_pitcher',
--       'shared_links_update_pitcher',
--       'shared_links_delete_admin',
--       'shared_links_delete_pitcher_own',
--       'approvals_insert_member',
--       'approvals_update_admin',
--       'approvals_delete_admin',
--       'track_documents_select_members',
--       'track_documents_insert_editor',
--       'track_documents_update_editor',
--       'track_documents_delete_uploader_or_admin'
--     )
--   ORDER BY tablename, policyname;
--   -- Doit renvoyer 34 lignes.
--
-- (c) Helper function existe :
--   SELECT proname FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--     AND proname = 'has_workspace_access_level';
--   -- Doit renvoyer 1 ligne.

-- ═══════════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════════
