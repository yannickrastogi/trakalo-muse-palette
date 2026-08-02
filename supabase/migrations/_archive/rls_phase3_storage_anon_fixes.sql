-- ═══════════════════════════════════════════════════════════════════════
-- TRAKALOG — RLS PHASE 3 — Storage scoping + anon policy hardening
-- ═══════════════════════════════════════════════════════════════════════
--
-- Date            : 2026-05-10
-- Auteur          : audit Claude, validation Yannick
-- Référence       : docs/RLS_AUDIT_2026-05-10.md (P0 #3 + #5)
--                   docs/RLS_PHASE3_GUIDE.md
-- Pré-requis      : Phase 1 + Phase 2 exécutées
-- Périmètre       : 5 vulnérabilités P0 restantes
--                     ① Storage bucket `documents` cross-workspace leak
--                     ② track_comments anon INSERT non scopé
--                     ③ track_comments anon UPDATE/DELETE sans ownership
--                     ④ signature_requests anon UPDATE pas restreint en colonnes
--                     ⑤ studio_submissions anon INSERT sans qr_token check
--
-- ⚠️ AVANT D'EXÉCUTER :
--
--   1. Vérifier le path convention des uploads de la prod :
--      Le script suppose `documents` = `{workspace_id}/{track_id}/{uuid}.{ext}`
--      (vérifié dans src/pages/TrackDetail.tsx:3159).
--      Pour les fichiers existants en prod qui utilisent un autre format,
--      ils deviendront inaccessibles → faire un dry-run :
--
--        SELECT name, owner FROM storage.objects
--        WHERE bucket_id = 'documents'
--          AND (storage.foldername(name))[1] !~ '^[0-9a-f-]{36}$'
--        LIMIT 100;
--
--      Si > 0 lignes : ces objets ont un path non-UUID en premier segment
--      et seront verrouillés par les nouvelles policies. Les migrer ou les
--      lister dans un allow-list AVANT d'exécuter S1.
--
--   2. Vérifier que les tables suivantes existent en prod :
--      track_comments, signature_requests, studio_submissions, tracks (avec qr_token).
--      Le script utilise `IF EXISTS` pour ne pas crasher si une table manque,
--      mais une absence non détectée laissera la vulnérabilité ouverte.
--
--   3. Snapshot des policies actuelles :
--      SELECT schemaname, tablename, policyname, cmd
--      FROM pg_policies
--      WHERE schemaname IN ('public', 'storage')
--        AND tablename IN ('objects', 'track_comments', 'signature_requests', 'studio_submissions');
--
-- Sections :
--   S0  → helpers (storage path extraction, safe casts)
--   S1  → storage bucket `documents` scoping
--   S2  → track_comments anon hardening (INSERT/UPDATE + immutability trigger)
--   S3  → signature_requests anon hardening (UPDATE + immutability trigger)
--   S4  → studio_submissions anon hardening (INSERT + qr_token check)
--   S5  → vérifications post-exécution
--
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- S0 — Helpers
-- ═══════════════════════════════════════════════════════════════════════

-- Extrait le workspace_id (premier segment) d'un path storage de manière
-- safe : si le segment n'est pas un UUID valide, retourne NULL au lieu
-- de crasher. NULL → la policy refusera l'accès (fail-closed).
CREATE OR REPLACE FUNCTION public.storage_path_workspace_id(_path text)
RETURNS uuid
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, storage
AS $$
DECLARE
  _segments text[];
  _first text;
  _result uuid;
BEGIN
  IF _path IS NULL THEN RETURN NULL; END IF;

  _segments := storage.foldername(_path);
  IF array_length(_segments, 1) IS NULL OR array_length(_segments, 1) < 1 THEN
    RETURN NULL;
  END IF;

  _first := _segments[1];

  BEGIN
    _result := _first::uuid;
    RETURN _result;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_path_workspace_id(text)
  TO authenticated, anon, service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- S1 — Storage bucket `documents` — path scoping (P0 #3)
-- ═══════════════════════════════════════════════════════════════════════
-- AVANT : `bucket_id = 'documents'` sans aucun check workspace
--         → cross-workspace leak (un user authentifié pouvait lister/lire/
--         supprimer les documents de TOUS les workspaces)
-- APRÈS : path = {workspace_id}/{track_id}/{uuid}.{ext}
--         → policies vérifient que le premier segment est un workspace
--         dont l'utilisateur est membre, avec le niveau requis pour l'op.
--
-- Permission par opération :
--   INSERT → editor+ (matrice : seuls Editor/Admin uploadent des docs)
--   SELECT → tout member (lecture pour collaborer)
--   UPDATE → editor+ (rare en pratique mais cohérent)
--   DELETE → uploader (storage.objects.owner = auth.uid()) OR admin
--
-- Vérifie les noms de policies actuels avant exécution :
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   ORDER BY policyname;

-- Noms réels prod (review human, 2026-05-10)
DROP POLICY IF EXISTS "Allow authenticated uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from documents" ON storage.objects;
-- Anciens noms (au cas où) — défensif
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own documents" ON storage.objects;

CREATE POLICY "documents_storage_insert_editor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  );

CREATE POLICY "documents_storage_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.is_workspace_member(
      auth.uid(),
      public.storage_path_workspace_id(name)
    )
  );

CREATE POLICY "documents_storage_update_editor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  );

CREATE POLICY "documents_storage_delete_uploader_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND (
      owner = auth.uid()
      OR public.has_workspace_access_level(
        auth.uid(),
        public.storage_path_workspace_id(name),
        'admin'
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- S1.B — Storage bucket `tracks` (audio masters)
-- ═══════════════════════════════════════════════════════════════════════
-- Path convention : {workspace_id}/{uuid}.{ext} (UploadTrackModal.tsx:653)
-- INSERT → pitcher+ (un Pitcher peut uploader un track)
-- SELECT → tout member
-- UPDATE → editor+
-- DELETE → editor+ OR uploader

DROP POLICY IF EXISTS "Allow authenticated uploads to tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to tracks" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from tracks" ON storage.objects;
-- Défensif : anciens noms éventuels
DROP POLICY IF EXISTS "Authenticated users can upload tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read tracks" ON storage.objects;

CREATE POLICY "tracks_storage_insert_pitcher"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tracks'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'pitcher'
    )
  );

CREATE POLICY "tracks_storage_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tracks'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.is_workspace_member(
      auth.uid(),
      public.storage_path_workspace_id(name)
    )
  );

CREATE POLICY "tracks_storage_update_editor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tracks'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  )
  WITH CHECK (
    bucket_id = 'tracks'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  );

CREATE POLICY "tracks_storage_delete_editor_or_uploader"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tracks'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND (
      owner = auth.uid()
      OR public.has_workspace_access_level(
        auth.uid(),
        public.storage_path_workspace_id(name),
        'editor'
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- S1.C — Storage bucket `stems`
-- ═══════════════════════════════════════════════════════════════════════
-- Path convention : {workspace_id}/{track_id}/{stem_id}/{file_name}
-- (Stems.tsx:161, StemsTab.tsx:198) — premier segment = workspace_id
-- INSERT → pitcher+ (Pitcher peut uploader des stems pour ses tracks)
-- SELECT → tout member
-- UPDATE → editor+
-- DELETE → editor+ OR uploader

DROP POLICY IF EXISTS "Allow authenticated uploads to stems" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from stems" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from stems" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload stems" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read stems" ON storage.objects;

CREATE POLICY "stems_storage_insert_pitcher"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'stems'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'pitcher'
    )
  );

CREATE POLICY "stems_storage_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stems'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.is_workspace_member(
      auth.uid(),
      public.storage_path_workspace_id(name)
    )
  );

CREATE POLICY "stems_storage_update_editor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'stems'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  )
  WITH CHECK (
    bucket_id = 'stems'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  );

CREATE POLICY "stems_storage_delete_editor_or_uploader"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'stems'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND (
      owner = auth.uid()
      OR public.has_workspace_access_level(
        auth.uid(),
        public.storage_path_workspace_id(name),
        'editor'
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- S1.D — Storage bucket `covers` (cover art tracks + playlists)
-- ═══════════════════════════════════════════════════════════════════════
-- Path convention : {workspace_id}/{track_id}.jpg (UploadTrackModal.tsx:742,
-- TrackDetail.tsx:515)
-- INSERT → pitcher+
-- SELECT → tout member ✅ + anon (pour shared links publics : la cover
--          d'un track partagé doit s'afficher sur SharedLinkPage)
-- UPDATE → editor+
-- DELETE → editor+ OR uploader
--
-- ⚠️ Spécificité anon : on NE PEUT PAS facilement scoper la lecture anon
-- au workspace (l'anon ne sait pas à quel WS appartient le track depuis
-- le storage path seul). Stratégie pragmatique : anon SELECT autorisé
-- sur tout le bucket `covers` car ces images sont publiques par design
-- (cover art = public sur Spotify/Apple Music). Aucune donnée sensible.

DROP POLICY IF EXISTS "Allow authenticated uploads to covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read covers" ON storage.objects;
DROP POLICY IF EXISTS "Public can read covers" ON storage.objects;

CREATE POLICY "covers_storage_insert_pitcher"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'pitcher'
    )
  );

-- Authenticated members + anon (cover art = public par design)
CREATE POLICY "covers_storage_select_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'covers'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.is_workspace_member(
      auth.uid(),
      public.storage_path_workspace_id(name)
    )
  );

CREATE POLICY "covers_storage_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'covers');

CREATE POLICY "covers_storage_update_editor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'covers'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND public.has_workspace_access_level(
      auth.uid(),
      public.storage_path_workspace_id(name),
      'editor'
    )
  );

CREATE POLICY "covers_storage_delete_editor_or_uploader"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'covers'
    AND public.storage_path_workspace_id(name) IS NOT NULL
    AND (
      owner = auth.uid()
      OR public.has_workspace_access_level(
        auth.uid(),
        public.storage_path_workspace_id(name),
        'editor'
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- 📝 NOTE — Buckets non traités dans Phase 3
-- ═══════════════════════════════════════════════════════════════════════
-- `branding` (workspace branding : hero, logo) — path {workspace_id}/...
--   À durcir si nécessaire avec le même pattern que `tracks`. Risque bas
--   car les assets de branding sont publics par design.
-- `avatars` — path {user_id}/avatar.{ext}, pattern différent (scopé user
--   pas workspace). Risque très bas (les avatars sont publics).


-- ═══════════════════════════════════════════════════════════════════════
-- S2 — track_comments anon hardening (P0 ② + ③)
-- ═══════════════════════════════════════════════════════════════════════
-- Audit : SharedStemAccess.tsx fait .insert/.update sur track_comments
-- depuis un client anon. Risques :
--   ② INSERT : aucun check que track_id appartient au shared_link → un anon
--      peut commenter sur un track qu'il n'a pas le droit de voir.
--   ③ UPDATE/DELETE : filtré par .eq("id", commentId) sans check d'auteur
--      → un anon peut modifier/supprimer les commentaires des autres
--      visiteurs.
--
-- Hardening :
--   • INSERT : valider que shared_link actif + track_id correspond au lien
--     (track direct OU via playlist).
--   • UPDATE : limiter aux colonnes content/updated_at/deleted_at via
--     trigger d'immutabilité. RLS vérifie que la row est rattachée à un
--     shared_link toujours actif.
--   • Note : la vraie sécurité d'ownership (un anon ne modifie que ses
--     propres commentaires) requiert un token de session anon — à traiter
--     en Phase 4 via une RPC dédiée. Phase 3 limite la surface d'attaque.

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'track_comments'
  ) THEN
    RAISE NOTICE 'Table track_comments not found — skip S2';
    RETURN;
  END IF;

  -- Policies anon : drop puis recreate avec scoping renforcé
  EXECUTE 'DROP POLICY IF EXISTS "anon_read_comments_via_shared_link" ON public.track_comments';
  EXECUTE 'DROP POLICY IF EXISTS "anon_insert_comments_via_shared_link" ON public.track_comments';
  EXECUTE 'DROP POLICY IF EXISTS "anon_update_comments_via_shared_link" ON public.track_comments';

  -- SELECT (anon) : commentaires d'un track partagé via un shared_link actif
  EXECUTE $sql$
    CREATE POLICY "track_comments_anon_select"
      ON public.track_comments FOR SELECT TO anon
      USING (
        shared_link_id IS NOT NULL
        AND shared_link_id IN (
          SELECT id FROM public.shared_links WHERE status = 'active'
        )
      )
  $sql$;

  -- INSERT (anon) : track_id doit être visible via un shared_link actif
  -- (soit en direct, soit via la playlist du lien)
  EXECUTE $sql$
    CREATE POLICY "track_comments_anon_insert"
      ON public.track_comments FOR INSERT TO anon
      WITH CHECK (
        shared_link_id IS NOT NULL
        AND author_type = 'recipient'
        AND EXISTS (
          SELECT 1 FROM public.shared_links sl
          WHERE sl.id = track_comments.shared_link_id
            AND sl.status = 'active'
            AND (
              sl.track_id = track_comments.track_id
              OR EXISTS (
                SELECT 1 FROM public.playlist_tracks pt
                WHERE pt.playlist_id = sl.playlist_id
                  AND pt.track_id = track_comments.track_id
              )
            )
        )
      )
  $sql$;

  -- UPDATE (anon) : seulement sur shared_link actif. La trigger plus bas
  -- bloque la mutation des colonnes critiques (track_id, author_*, etc.).
  EXECUTE $sql$
    CREATE POLICY "track_comments_anon_update"
      ON public.track_comments FOR UPDATE TO anon
      USING (
        shared_link_id IS NOT NULL
        AND shared_link_id IN (
          SELECT id FROM public.shared_links WHERE status = 'active'
        )
      )
      WITH CHECK (
        shared_link_id IS NOT NULL
        AND shared_link_id IN (
          SELECT id FROM public.shared_links WHERE status = 'active'
        )
      )
  $sql$;
END $body$;

-- Trigger d'immutabilité — bloque la modif des colonnes critiques
-- (track_id, shared_link_id, author_name, author_email, author_type,
-- timestamp_sec) sur les UPDATE anon. Seuls content/updated_at/deleted_at
-- restent mutables.
CREATE OR REPLACE FUNCTION public.track_comments_anon_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- N'applique le check qu'aux UPDATE anon (auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.track_id IS DISTINCT FROM OLD.track_id THEN
    RAISE EXCEPTION 'track_id is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.shared_link_id IS DISTINCT FROM OLD.shared_link_id THEN
    RAISE EXCEPTION 'shared_link_id is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.author_name IS DISTINCT FROM OLD.author_name THEN
    RAISE EXCEPTION 'author_name is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.author_email IS DISTINCT FROM OLD.author_email THEN
    RAISE EXCEPTION 'author_email is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.author_type IS DISTINCT FROM OLD.author_type THEN
    RAISE EXCEPTION 'author_type is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.timestamp_sec IS DISTINCT FROM OLD.timestamp_sec THEN
    RAISE EXCEPTION 'timestamp_sec is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'track_comments') THEN
    DROP TRIGGER IF EXISTS track_comments_anon_immutability ON public.track_comments;
    CREATE TRIGGER track_comments_anon_immutability
      BEFORE UPDATE ON public.track_comments
      FOR EACH ROW
      EXECUTE FUNCTION public.track_comments_anon_immutable_cols();
  END IF;
END $body$;


-- ═══════════════════════════════════════════════════════════════════════
-- S3 — signature_requests anon hardening (P0 ④)
-- ═══════════════════════════════════════════════════════════════════════
-- Audit : SignAgreement.tsx fait .update sur signature_requests via anon
-- pour passer status='pending' → 'signed' + écrire signature_data + signed_at.
-- Le token est validé client-side (SELECT préalable .eq("token", token))
-- mais aucune RLS n'empêche un anon d'UPDATE n'importe quelle row par id.
--
-- Hardening :
--   • UPDATE anon : autorisé seulement si status='pending' AND token IS NOT NULL.
--   • Trigger d'immutabilité : seules status, signature_data, signed_at,
--     signer_name peuvent changer ; track_id, token, collaborator_*, role,
--     split_share, pro, ipi, publisher restent immuables.
--   • La sécurité ultime reste l'unguessability du token (crypto random).
--   • Hors scope Phase 3 : ré-implémenter via RPC SECURITY DEFINER qui prend
--     le token en param et fait la validation côté serveur.

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'signature_requests'
  ) THEN
    RAISE NOTICE 'Table signature_requests not found — skip S3';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "anon_select_signature_requests" ON public.signature_requests';
  EXECUTE 'DROP POLICY IF EXISTS "anon_update_signature_requests" ON public.signature_requests';

  -- SELECT (anon) : seulement si la row a un token (le frontend ne sait
  -- pas qu'une row existe sans son token, mais ceinture+bretelles).
  EXECUTE $sql$
    CREATE POLICY "signature_requests_anon_select"
      ON public.signature_requests FOR SELECT TO anon
      USING (token IS NOT NULL)
  $sql$;

  -- UPDATE (anon) : seulement si status='pending' (transition unique
  -- pending → signed). Trigger ci-dessous bloque les colonnes immuables.
  EXECUTE $sql$
    CREATE POLICY "signature_requests_anon_update_signing"
      ON public.signature_requests FOR UPDATE TO anon
      USING (
        token IS NOT NULL
        AND status = 'pending'
      )
      WITH CHECK (
        token IS NOT NULL
        AND status IN ('signed', 'pending')
      )
  $sql$;
END $body$;

CREATE OR REPLACE FUNCTION public.signature_requests_anon_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Apply only to anon UPDATEs
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.token IS DISTINCT FROM OLD.token THEN
    RAISE EXCEPTION 'token is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.track_id IS DISTINCT FROM OLD.track_id THEN
    RAISE EXCEPTION 'track_id is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.collaborator_name IS DISTINCT FROM OLD.collaborator_name THEN
    RAISE EXCEPTION 'collaborator_name is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.collaborator_email IS DISTINCT FROM OLD.collaborator_email THEN
    RAISE EXCEPTION 'collaborator_email is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.split_share IS DISTINCT FROM OLD.split_share THEN
    RAISE EXCEPTION 'split_share is immutable for anon updates'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Note : pro, ipi, publisher peuvent être présents ou non selon le schéma.
  -- Si la prod a ces colonnes et le frontend les écrit lors du sign, ajouter
  -- des checks ici. Voir docs/RLS_PHASE3_GUIDE.md.

  RETURN NEW;
END;
$$;

DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'signature_requests') THEN
    DROP TRIGGER IF EXISTS signature_requests_anon_immutability ON public.signature_requests;
    CREATE TRIGGER signature_requests_anon_immutability
      BEFORE UPDATE ON public.signature_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.signature_requests_anon_immutable_cols();
  END IF;
END $body$;


-- ═══════════════════════════════════════════════════════════════════════
-- S4 — studio_submissions anon hardening (P0 ⑤)
-- ═══════════════════════════════════════════════════════════════════════
-- Audit : StudioSession.tsx fait .insert sur studio_submissions via anon
-- avec un track_id chargé via .eq("qr_token", token). Aucune RLS n'empêche
-- un anon d'insérer pour un track_id arbitraire (sans qr_token actif).
--
-- Hardening :
--   • INSERT anon : track_id doit avoir un qr_token non-NULL en base
--     (le track est bien en mode "QR studio actif").
--   • SELECT anon : autoriser uniquement les rows liées à un track avec
--     qr_token actif (peu utilisé mais cohérent).
--   • La sécurité d'usage reste l'unguessability du qr_token côté URL.
--   • Recommendation : ajouter UNIQUE(track_id, email) si pas déjà présent
--     pour éviter le spam. Voir guide.

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'studio_submissions'
  ) THEN
    RAISE NOTICE 'Table studio_submissions not found — skip S4';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "anon_select_studio_submissions" ON public.studio_submissions';
  EXECUTE 'DROP POLICY IF EXISTS "anon_insert_studio_submissions" ON public.studio_submissions';

  EXECUTE $sql$
    CREATE POLICY "studio_submissions_anon_select"
      ON public.studio_submissions FOR SELECT TO anon
      USING (
        track_id IN (
          SELECT id FROM public.tracks WHERE qr_token IS NOT NULL
        )
      )
  $sql$;

  EXECUTE $sql$
    CREATE POLICY "studio_submissions_anon_insert"
      ON public.studio_submissions FOR INSERT TO anon
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tracks
          WHERE id = studio_submissions.track_id
            AND qr_token IS NOT NULL
        )
        AND email IS NOT NULL
        AND length(btrim(email)) > 0
        AND full_name IS NOT NULL
        AND length(btrim(full_name)) > 0
      )
  $sql$;
END $body$;


-- ═══════════════════════════════════════════════════════════════════════
-- S5 — Vérifications post-exécution
-- ═══════════════════════════════════════════════════════════════════════
-- (a) Toutes les nouvelles policies storage :
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'storage'
--     AND tablename = 'objects'
--     AND (policyname LIKE 'documents_storage_%'
--          OR policyname LIKE 'tracks_storage_%'
--          OR policyname LIKE 'stems_storage_%'
--          OR policyname LIKE 'covers_storage_%')
--   ORDER BY policyname;
--   -- Attendu : 17 lignes
--   --   documents : 4 (insert/select/update/delete)
--   --   tracks    : 4 (insert/select/update/delete)
--   --   stems     : 4 (insert/select/update/delete)
--   --   covers    : 5 (insert/select_members/select_anon/update/delete)
--
-- (b) Anciennes policies storage absentes :
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage'
--     AND tablename = 'objects'
--     AND (policyname LIKE 'Allow authenticated %'
--          OR policyname LIKE 'Authenticated users can %');
--   -- Attendu : 0 ligne (sauf si d'autres buckets non traités existent)
--
-- (c) Helper safe-cast fonctionne :
--   SELECT public.storage_path_workspace_id('not-a-uuid/file.pdf') IS NULL; -- true
--   SELECT public.storage_path_workspace_id('11111111-1111-1111-1111-111111111111/file.pdf'); -- uuid
--   SELECT public.storage_path_workspace_id(NULL) IS NULL; -- true
--
-- (d) Triggers d'immutabilité installés :
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE tgname IN ('track_comments_anon_immutability', 'signature_requests_anon_immutability');
--   -- Attendu : 2 lignes
--
-- (e) Test fonctionnel anon (en SQL Editor avec role anon) :
--   SET LOCAL ROLE anon;
--   -- Doit échouer sur un track sans qr_token :
--   INSERT INTO public.studio_submissions (track_id, email, full_name)
--   VALUES ('<track-without-qr>'::uuid, 'attacker@evil.com', 'Mallory');
--   -- Attendu : new row violates row-level security policy
--   RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════════
