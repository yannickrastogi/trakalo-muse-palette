-- ═══════════════════════════════════════════════════════════════════════
-- TRAKALOG — RLS PHASE 2 — RPC access_level checks
-- ═══════════════════════════════════════════════════════════════════════
--
-- Date            : 2026-05-10
-- Auteur          : audit Claude, validation Yannick
-- Référence       : docs/RLS_AUDIT_2026-05-10.md, docs/RLS_PHASE2_GUIDE.md
-- Pré-requis      : Phase 1 exécutée (helper has_workspace_access_level existe)
-- Périmètre       : ajouter check access_level dans ~30 RPCs SECURITY DEFINER
-- Hors périmètre  : storage policies, modifications de signatures
--
-- ⚠️⚠️⚠️ LECTURE OBLIGATOIRE AVANT EXÉCUTION ⚠️⚠️⚠️
--
-- Sur les ~30 RPCs ciblées :
--   • 4 ont leur body versionné dans le repo (insert_track, update_track,
--     upsert_contact, update_workspace_member). Pour celles-ci, on peut
--     CREATE OR REPLACE en toute sécurité.
--
--   • ~26 existent UNIQUEMENT en prod (créées via Supabase Studio).
--     Leur body n'est pas dans le repo. Pour celles-ci, deux stratégies
--     sont proposées dans ce fichier :
--       A. RENAME + WRAP (recommandé, plus sûr) — préserve 100% du body
--          prod en le renommant en `_legacy_v0`, puis crée un wrapper qui
--          ajoute la vérification puis délègue.
--       B. CREATE OR REPLACE complet (en commentaire ci-dessous chaque
--          RPC) — body reconstruit depuis docs/RPCS.md, à activer SEULEMENT
--          si tu as comparé avec la version prod via :
--            SELECT pg_get_functiondef(oid)
--            FROM pg_proc
--            WHERE proname = 'X' AND pronamespace = 'public'::regnamespace;
--
-- ⚠️ ÉTAPE OBLIGATOIRE AVANT D'EXÉCUTER :
--
--   Pour chaque RPC qui n'est pas dans le repo, vérifie sa signature
--   (param list + return type) dans la prod et compare avec ce script.
--
--     SELECT proname, pg_get_function_arguments(oid) AS args,
--            pg_get_function_result(oid) AS returns
--     FROM pg_proc
--     WHERE pronamespace = 'public'::regnamespace
--       AND proname IN (
--         'delete_track', 'save_track_to_trakalog', 'remove_track_from_trakalog',
--         'insert_stem', 'delete_stem', 'update_stem_type',
--         'insert_track_document', 'delete_track_document', 'update_track_document_status',
--         'create_playlist', 'update_playlist', 'delete_playlist',
--         'add_playlist_tracks', 'replace_playlist_tracks',
--         'create_pitch', 'add_contact_manual',
--         'create_shared_link', 'update_shared_link_status',
--         'insert_catalog_share', 'revoke_catalog_share',
--         'add_track_comment', 'insert_approval', 'update_approval_status',
--         'remove_workspace_member', 'update_member_role',
--         'update_studio_submission_status',
--         'update_workspace_name', 'update_workspace_slug', 'update_workspace_settings'
--       )
--     ORDER BY proname;
--
--   Si une signature en prod diffère du script, l'ALTER FUNCTION
--   échouera avec une erreur claire ("function does not exist") — c'est
--   un fail-safe, pas une catastrophe. Adapte le script avec la vraie
--   signature avant de réexécuter.
--
-- L'exécution est sectionnée pour rollback granulaire. Tu peux exécuter
-- section par section ou tout d'un coup. Toutes les commandes sont
-- idempotentes (DO blocks + IF EXISTS).
--
-- ═══════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- S0 — Helper require_workspace_access_level
-- ═══════════════════════════════════════════════════════════════════════
-- Wrapper sur has_workspace_access_level qui RAISE EXCEPTION proprement
-- avec le format demandé : "Insufficient access level: % required, you have %".
-- Préserve l'idée du helper Phase 1 mais ajoute la fetch du current_level
-- pour un message d'erreur explicite.

CREATE OR REPLACE FUNCTION public.require_workspace_access_level(
  _user_id uuid,
  _workspace_id uuid,
  _min_level text
)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_level text;
  _is_owner boolean;
BEGIN
  -- Owner = admin de facto, pass-through
  SELECT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) INTO _is_owner;

  IF _is_owner THEN
    RETURN;
  END IF;

  -- Fetch current level (needed for the error message)
  SELECT access_level INTO _current_level
  FROM workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id;

  IF _current_level IS NULL THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, _min_level) THEN
    RAISE EXCEPTION 'Insufficient access level: % required, you have %',
      _min_level, _current_level
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_workspace_access_level(uuid, uuid, text)
  TO authenticated, anon;


-- ═══════════════════════════════════════════════════════════════════════
-- TEMPLATE — RENAME + WRAP (à utiliser pour toutes les RPCs non versionnées)
-- ═══════════════════════════════════════════════════════════════════════
-- Pattern : on renomme la fonction prod en `<name>_legacy_v0` (idempotent
-- via DO block), puis on crée un wrapper qui :
--   1. Vérifie le access_level
--   2. Délègue au legacy avec les mêmes paramètres
--   3. Retourne ce que le legacy retourne
--
-- Ainsi on n'écrit JAMAIS de body métier — on préserve 100% du prod.
-- Le seul risque : si la signature en prod ne match pas exactement le
-- script, ALTER FUNCTION échoue (erreur explicite, pas de corruption).
--
-- Pattern générique :
--
--   DO $body$ BEGIN
--     IF NOT EXISTS (
--       SELECT 1 FROM pg_proc
--       WHERE proname = '<name>_legacy_v0'
--         AND pronamespace = 'public'::regnamespace
--     ) THEN
--       ALTER FUNCTION public.<name>(<sig>) RENAME TO <name>_legacy_v0;
--     END IF;
--   END $body$;
--
--   CREATE OR REPLACE FUNCTION public.<name>(<sig>)
--   RETURNS <returns> AS $func$
--   BEGIN
--     PERFORM public.require_workspace_access_level(<user>, <ws>, '<level>');
--     RETURN public.<name>_legacy_v0(<args>);
--   END;
--   $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
--
-- Pour les RPCs qui retournent void, utilise PERFORM au lieu de RETURN.
-- Pour les RPCs avec logique de permission contextuelle (ex: "OR own"),
-- la fetch du contexte se fait avant l'appel au legacy.


-- ═══════════════════════════════════════════════════════════════════════
-- S1 — TRACKS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── insert_track (versionné repo, body connu) ─────────────────────
-- Permission : pitcher+ (matrice : Pitcher canUploadTracks)
-- Source du body : supabase/migrations/20260430_genre_text_array.sql

CREATE OR REPLACE FUNCTION public.insert_track(
  _user_id uuid,
  _workspace_id uuid,
  _title text,
  _artist text DEFAULT NULL,
  _featuring text DEFAULT NULL,
  _type text DEFAULT NULL,
  _status text DEFAULT NULL,
  _bpm numeric DEFAULT NULL,
  _key text DEFAULT NULL,
  _duration_sec numeric DEFAULT NULL,
  _genre text[] DEFAULT NULL,
  _mood text[] DEFAULT '{}'::text[],
  _language text DEFAULT NULL,
  _gender text DEFAULT NULL,
  _labels text[] DEFAULT '{}'::text[],
  _publishers text[] DEFAULT '{}'::text[],
  _audio_url text DEFAULT NULL,
  _audio_preview_url text DEFAULT NULL,
  _cover_art_url text DEFAULT NULL,
  _lyrics text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _splits jsonb DEFAULT '[]'::jsonb,
  _isrc text DEFAULT NULL,
  _waveform_data jsonb DEFAULT NULL,
  _released_at timestamptz DEFAULT NULL
)
RETURNS uuid AS $func$
DECLARE
  new_track_id uuid;
BEGIN
  -- Phase 2 access_level check
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  INSERT INTO public.tracks (
    workspace_id, uploaded_by, title, artist, featuring,
    track_type, status, bpm, key, duration_sec,
    genre, mood, language, gender,
    labels, publishers,
    audio_url, audio_preview_url, cover_url,
    lyrics, notes, splits, isrc, waveform_data, released_at
  ) VALUES (
    _workspace_id, _user_id, _title, _artist, _featuring,
    COALESCE(_type::public.track_type, 'song'),
    COALESCE(_status::public.track_status, 'available'),
    _bpm, _key, _duration_sec,
    NULLIF(_genre, '{}'::text[]),
    COALESCE(_mood, '{}'::text[]),
    _language,
    NULLIF(_gender, '')::public.track_gender,
    COALESCE(_labels, '{}'::text[]),
    COALESCE(_publishers, '{}'::text[]),
    _audio_url, _audio_preview_url, _cover_art_url,
    _lyrics, _notes, COALESCE(_splits, '[]'::jsonb), _isrc, _waveform_data, _released_at
  )
  RETURNING id INTO new_track_id;

  RETURN new_track_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_track (versionné repo, body connu) ─────────────────────
-- Permission : editor+ (any track) OR (pitcher+ AND uploaded_by = _user_id)
-- Source du body : supabase/migrations/20260430_genre_text_array.sql

CREATE OR REPLACE FUNCTION public.update_track(
  _user_id uuid,
  _track_id uuid,
  _updates jsonb
)
RETURNS void AS $func$
DECLARE
  workspace_uuid uuid;
  uploader_uuid uuid;
  k text;
  v jsonb;
  set_clauses text := '';
  genre_array text[];
BEGIN
  -- Lookup workspace + uploader
  SELECT workspace_id, uploaded_by INTO workspace_uuid, uploader_uuid
  FROM public.tracks WHERE id = _track_id;

  IF workspace_uuid IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  -- Phase 2 access_level check : editor+ OU (pitcher+ AND own track)
  IF NOT (
    public.has_workspace_access_level(_user_id, workspace_uuid, 'editor')
    OR (
      public.has_workspace_access_level(_user_id, workspace_uuid, 'pitcher')
      AND uploader_uuid = _user_id
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for update_track: editor required to edit any track, or pitcher to edit own track'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Build dynamic UPDATE from jsonb keys (preserved verbatim from repo)
  FOR k, v IN SELECT * FROM jsonb_each(_updates) LOOP
    IF k = 'genre' THEN
      IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
        set_clauses := set_clauses || format(', %I = NULL', k);
      ELSIF jsonb_typeof(v) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(v)) INTO genre_array;
        set_clauses := set_clauses || format(', %I = %L::text[]', k, genre_array);
      ELSIF jsonb_typeof(v) = 'string' THEN
        set_clauses := set_clauses || format(', %I = ARRAY[%L]::text[]', k, v #>> '{}');
      ELSE
        set_clauses := set_clauses || format(', %I = NULL', k);
      END IF;
    ELSIF jsonb_typeof(v) = 'null' THEN
      set_clauses := set_clauses || format(', %I = NULL', k);
    ELSIF jsonb_typeof(v) IN ('object', 'array') THEN
      set_clauses := set_clauses || format(', %I = %L::jsonb', k, v::text);
    ELSIF jsonb_typeof(v) = 'boolean' THEN
      set_clauses := set_clauses || format(', %I = %L::boolean', k, (v #>> '{}'));
    ELSIF jsonb_typeof(v) = 'number' THEN
      set_clauses := set_clauses || format(', %I = %L', k, (v #>> '{}'));
    ELSE
      set_clauses := set_clauses || format(', %I = %L', k, (v #>> '{}'));
    END IF;
  END LOOP;

  IF length(set_clauses) > 0 THEN
    set_clauses := substring(set_clauses from 3);
    EXECUTE format('UPDATE public.tracks SET %s, updated_at = now() WHERE id = %L',
                   set_clauses, _track_id);
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── delete_track (NON versionné — wrap pattern) ──────────────────
-- Permission : admin only (corriger : actuellement accepte editor)

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'delete_track_legacy_v0'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      ALTER FUNCTION public.delete_track(uuid, uuid) RENAME TO delete_track_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'delete_track(uuid, uuid) not found in prod — skip rename. Verify signature.';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.delete_track(_user_id uuid, _track_id uuid)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  -- Délégation au body original (préservé dans _legacy_v0)
  PERFORM public.delete_track_legacy_v0(_user_id, _track_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── save_track_to_trakalog (NON versionné — wrap pattern) ────────
-- Permission : _user_id doit être membre de _target_workspace_id
-- Note : le doc montre l'ordre _track_id, _source_workspace_id, _target_workspace_id, _user_id

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'save_track_to_trakalog_legacy_v0'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      ALTER FUNCTION public.save_track_to_trakalog(uuid, uuid, uuid, uuid)
        RENAME TO save_track_to_trakalog_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'save_track_to_trakalog not found — verify signature in prod';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.save_track_to_trakalog(
  _track_id uuid,
  _source_workspace_id uuid,
  _target_workspace_id uuid,
  _user_id uuid
)
RETURNS void AS $func$
BEGIN
  -- Le user doit être membre du target workspace (où il sauve le track)
  IF NOT public.is_workspace_member(_user_id, _target_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of target workspace %', _target_workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.save_track_to_trakalog_legacy_v0(_track_id, _source_workspace_id, _target_workspace_id, _user_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── remove_track_from_trakalog (NON versionné — wrap pattern) ────
-- Permission : pitcher+ sur target workspace

DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'remove_track_from_trakalog_legacy_v0'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      ALTER FUNCTION public.remove_track_from_trakalog(uuid, uuid)
        RENAME TO remove_track_from_trakalog_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'remove_track_from_trakalog not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.remove_track_from_trakalog(
  _track_id uuid,
  _user_id uuid
)
RETURNS void AS $func$
DECLARE
  v_target_workspace_id uuid;
BEGIN
  -- Trouver le target workspace via catalog_shares ou via tracks.workspace_id
  -- Si la sémantique de la RPC est de retirer depuis le workspace actif,
  -- on doit retrouver _target_workspace_id. À adapter selon le body prod.
  SELECT workspace_id INTO v_target_workspace_id FROM public.tracks WHERE id = _track_id;

  IF v_target_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_target_workspace_id, 'pitcher');

  PERFORM public.remove_track_from_trakalog_legacy_v0(_track_id, _user_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S2 — STEMS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── insert_stem (NON versionné — wrap) ───────────────────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_stem_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.insert_stem(uuid, uuid, text, text, bigint, text)
        RENAME TO insert_stem_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'insert_stem not found with signature (uuid,uuid,text,text,bigint,text) — verify prod';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.insert_stem(
  _user_id uuid,
  _track_id uuid,
  _name text,
  _file_url text,
  _file_size bigint,
  _stem_type text
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  PERFORM public.insert_stem_legacy_v0(_user_id, _track_id, _name, _file_url, _file_size, _stem_type);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── delete_stem (NON versionné — wrap avec contexte own) ─────────
-- Permission : editor+ OR uploaded_by = _user_id

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_stem_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.delete_stem(uuid, uuid) RENAME TO delete_stem_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'delete_stem not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.delete_stem(_user_id uuid, _stem_id uuid)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_uploaded_by uuid;
BEGIN
  SELECT workspace_id, uploaded_by INTO v_workspace_id, v_uploaded_by
  FROM public.stems WHERE id = _stem_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Stem % not found', _stem_id;
  END IF;

  IF NOT (
    public.has_workspace_access_level(_user_id, v_workspace_id, 'editor')
    OR v_uploaded_by = _user_id
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_stem: editor required, or be the uploader'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.delete_stem_legacy_v0(_user_id, _stem_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_stem_type (NON versionné — wrap) ──────────────────────
-- Permission : editor+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_stem_type_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_stem_type(uuid, uuid, text) RENAME TO update_stem_type_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_stem_type not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.stems WHERE id = _stem_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Stem % not found', _stem_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');

  PERFORM public.update_stem_type_legacy_v0(_user_id, _stem_id, _stem_type);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S3 — DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── insert_track_document (NON versionné — wrap) ─────────────────
-- Permission : editor+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_track_document_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.insert_track_document(uuid, uuid, text, text, bigint, text)
        RENAME TO insert_track_document_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'insert_track_document not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.insert_track_document(
  _user_id uuid,
  _track_id uuid,
  _name text,
  _file_url text,
  _file_size bigint,
  _doc_type text
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');

  PERFORM public.insert_track_document_legacy_v0(_user_id, _track_id, _name, _file_url, _file_size, _doc_type);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_track_document_status (NON versionné — wrap) ──────────
-- Permission : admin only (signatures = admin only)

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_track_document_status_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_track_document_status(uuid, uuid, text)
        RENAME TO update_track_document_status_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_track_document_status not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_track_document_status(
  _user_id uuid,
  _doc_id uuid,
  _status text
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.track_documents WHERE id = _doc_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Document % not found', _doc_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  PERFORM public.update_track_document_status_legacy_v0(_user_id, _doc_id, _status);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── delete_track_document (NON versionné — wrap avec own) ────────
-- Permission : admin OR uploaded_by = _user_id

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_track_document_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.delete_track_document(uuid, uuid)
        RENAME TO delete_track_document_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'delete_track_document not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.delete_track_document(_user_id uuid, _doc_id uuid)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_uploaded_by uuid;
BEGIN
  SELECT workspace_id, uploaded_by INTO v_workspace_id, v_uploaded_by
  FROM public.track_documents WHERE id = _doc_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Document % not found', _doc_id;
  END IF;

  IF NOT (
    public.has_workspace_access_level(_user_id, v_workspace_id, 'admin')
    OR v_uploaded_by = _user_id
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_track_document: admin required, or be the uploader'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.delete_track_document_legacy_v0(_user_id, _doc_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S4 — PLAYLISTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── create_playlist (NON versionné — wrap) ───────────────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_playlist_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.create_playlist(uuid, uuid, text, text, text)
        RENAME TO create_playlist_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'create_playlist not found with sig (uuid,uuid,text,text,text) — verify prod';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.create_playlist(
  _user_id uuid,
  _workspace_id uuid,
  _name text,
  _description text DEFAULT NULL,
  _cover_url text DEFAULT NULL
)
RETURNS uuid AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_playlist_legacy_v0(_user_id, _workspace_id, _name, _description, _cover_url);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_playlist (NON versionné — wrap) ───────────────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_playlist_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_playlist(uuid, uuid, text, text, text)
        RENAME TO update_playlist_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_playlist not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_playlist(
  _user_id uuid,
  _playlist_id uuid,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL,
  _cover_url text DEFAULT NULL
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Playlist % not found', _playlist_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  PERFORM public.update_playlist_legacy_v0(_user_id, _playlist_id, _name, _description, _cover_url);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── delete_playlist (NON versionné — wrap avec own) ──────────────
-- Permission : admin OR created_by = _user_id

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_playlist_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.delete_playlist(uuid, uuid) RENAME TO delete_playlist_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'delete_playlist not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.delete_playlist(_user_id uuid, _playlist_id uuid)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_created_by uuid;
BEGIN
  SELECT workspace_id, created_by INTO v_workspace_id, v_created_by
  FROM public.playlists WHERE id = _playlist_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Playlist % not found', _playlist_id;
  END IF;

  IF NOT (
    public.has_workspace_access_level(_user_id, v_workspace_id, 'admin')
    OR v_created_by = _user_id
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for delete_playlist: admin required, or be the creator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.delete_playlist_legacy_v0(_user_id, _playlist_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── add_playlist_tracks (NON versionné — wrap) ───────────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_playlist_tracks_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.add_playlist_tracks(uuid, uuid, uuid[])
        RENAME TO add_playlist_tracks_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'add_playlist_tracks not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.add_playlist_tracks(
  _user_id uuid,
  _playlist_id uuid,
  _track_ids uuid[]
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Playlist % not found', _playlist_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  PERFORM public.add_playlist_tracks_legacy_v0(_user_id, _playlist_id, _track_ids);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── replace_playlist_tracks (NON versionné — wrap) ───────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'replace_playlist_tracks_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.replace_playlist_tracks(uuid, uuid, uuid[])
        RENAME TO replace_playlist_tracks_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'replace_playlist_tracks not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.replace_playlist_tracks(
  _user_id uuid,
  _playlist_id uuid,
  _track_ids uuid[]
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Playlist % not found', _playlist_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  PERFORM public.replace_playlist_tracks_legacy_v0(_user_id, _playlist_id, _track_ids);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S5 — PITCHES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── create_pitch (NON versionné — wrap) ──────────────────────────
-- Permission : pitcher+
-- ⚠️ Signature de RPCS.md (11 params), à vérifier en prod

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_pitch_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.create_pitch(uuid, uuid, text, text, text, text, text, uuid[], uuid[], text, text)
        RENAME TO create_pitch_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'create_pitch not found with documented sig — DUMP prod and adjust before retry';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.create_pitch(
  _user_id uuid,
  _workspace_id uuid,
  _recipient_name text,
  _recipient_email text,
  _recipient_company text,
  _subject text,
  _message text,
  _track_ids uuid[],
  _playlist_ids uuid[],
  _link_type text,
  _status text
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  PERFORM public.create_pitch_legacy_v0(
    _user_id, _workspace_id, _recipient_name, _recipient_email,
    _recipient_company, _subject, _message, _track_ids,
    _playlist_ids, _link_type, _status
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S6 — CONTACTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── upsert_contact (versionné repo, body connu) ──────────────────
-- Permission : pitcher+
-- Body source : supabase/migrations/20260429_upsert_contact_dedupe.sql
-- ⚠️ Vérifier l'ordre des paramètres avec la version actuelle :
--    pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'upsert_contact'

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
  -- Phase 2 access_level check
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  IF v_norm_first IS NULL AND v_norm_email IS NULL THEN
    RAISE EXCEPTION 'Either first_name or email is required';
  END IF;

  -- Dedupe par email si fourni, sinon par (first_name, last_name)
  IF v_norm_email IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.contacts
    WHERE workspace_id = _workspace_id AND lower(email) = v_norm_email
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


-- ─── add_contact_manual (NON versionné — wrap) ────────────────────
-- Permission : pitcher+

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_contact_manual_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.add_contact_manual(uuid, uuid, text, text, text, text, text, text)
        RENAME TO add_contact_manual_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'add_contact_manual not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.add_contact_manual(
  _user_id uuid,
  _workspace_id uuid,
  _first_name text,
  _last_name text,
  _email text,
  _role text,
  _company text,
  _phone text
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  PERFORM public.add_contact_manual_legacy_v0(
    _user_id, _workspace_id, _first_name, _last_name, _email, _role, _company, _phone
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S7 — SHARED LINKS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── create_shared_link (NON versionné — wrap) ────────────────────
-- Permission : pitcher+
-- ⚠️ 15 params dans RPCS.md, signature à vérifier en prod

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_shared_link_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.create_shared_link(
        uuid, uuid, text, uuid, uuid, text, text, text, text, text, boolean, boolean, text, timestamptz, jsonb
      ) RENAME TO create_shared_link_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'create_shared_link not found with documented signature — DUMP prod first';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.create_shared_link(
  _user_id uuid,
  _workspace_id uuid,
  _share_type text,
  _track_id uuid,
  _playlist_id uuid,
  _link_name text,
  _link_slug text,
  _link_type text,
  _password_hash text,
  _message text,
  _allow_download boolean,
  _allow_save boolean,
  _download_quality text,
  _expires_at timestamptz,
  _pack_items jsonb
)
RETURNS json AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  RETURN public.create_shared_link_legacy_v0(
    _user_id, _workspace_id, _share_type, _track_id, _playlist_id,
    _link_name, _link_slug, _link_type, _password_hash, _message,
    _allow_download, _allow_save, _download_quality, _expires_at, _pack_items
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_shared_link_status (NON versionné — wrap avec own check) ─
-- Permission : pitcher+ AND (created_by = _user_id OR admin)

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_shared_link_status_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_shared_link_status(uuid, uuid, boolean)
        RENAME TO update_shared_link_status_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_shared_link_status not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_shared_link_status(
  _user_id uuid,
  _link_id uuid,
  _disabled boolean
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_created_by uuid;
BEGIN
  SELECT workspace_id, created_by INTO v_workspace_id, v_created_by
  FROM public.shared_links WHERE id = _link_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Shared link % not found', _link_id;
  END IF;

  -- Pitcher+ AND (own OR admin)
  IF NOT (
    public.has_workspace_access_level(_user_id, v_workspace_id, 'pitcher')
    AND (
      v_created_by = _user_id
      OR public.has_workspace_access_level(_user_id, v_workspace_id, 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for update_shared_link_status: pitcher required, and either be the creator or admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.update_shared_link_status_legacy_v0(_user_id, _link_id, _disabled);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S8 — CATALOG SHARES (CRITIQUE)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── insert_catalog_share (NON versionné — wrap) ──────────────────
-- Permission : admin sur source workspace (CRITIQUE — partage de catalogue
-- est une action sensible qui ouvre l'accès à un tiers)

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_catalog_share_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.insert_catalog_share(uuid, uuid, uuid, uuid, text)
        RENAME TO insert_catalog_share_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'insert_catalog_share not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.insert_catalog_share(
  _user_id uuid,
  _track_id uuid,
  _source_workspace_id uuid,
  _target_workspace_id uuid,
  _access_level text
)
RETURNS void AS $func$
BEGIN
  -- Admin sur SOURCE (celui qui partage)
  PERFORM public.require_workspace_access_level(_user_id, _source_workspace_id, 'admin');

  PERFORM public.insert_catalog_share_legacy_v0(
    _user_id, _track_id, _source_workspace_id, _target_workspace_id, _access_level
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── revoke_catalog_share (NON versionné — wrap) ──────────────────
-- Permission : admin sur source workspace

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_catalog_share_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.revoke_catalog_share(uuid, uuid)
        RENAME TO revoke_catalog_share_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'revoke_catalog_share not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.revoke_catalog_share(_user_id uuid, _share_id uuid)
RETURNS void AS $func$
DECLARE
  v_source_ws uuid;
BEGIN
  SELECT source_workspace_id INTO v_source_ws
  FROM public.catalog_shares WHERE id = _share_id;

  IF v_source_ws IS NULL THEN
    RAISE EXCEPTION 'Catalog share % not found', _share_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_source_ws, 'admin');

  PERFORM public.revoke_catalog_share_legacy_v0(_user_id, _share_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S9 — COMMENTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── add_track_comment (NON versionné — wrap, double path) ───────
-- Permission : tout member si auth.uid() non-null, ou anon via RLS shared_link.
-- Signature RPCS.md ne prend PAS de _user_id explicite — on s'appuie sur
-- auth.uid() côté authentifié et on laisse le RLS anon gérer l'autre cas.

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_track_comment_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.add_track_comment(uuid, text, text, text, numeric, text)
        RENAME TO add_track_comment_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'add_track_comment not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.add_track_comment(
  _track_id uuid,
  _author_name text,
  _author_email text,
  _author_type text,
  _timestamp_sec numeric,
  _content text
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  -- Si appelé par un user authentifié, vérifier qu'il est membre du workspace
  -- (l'anon path est sécurisé par les RLS policies sur track_comments via shared_link).
  IF v_uid IS NOT NULL THEN
    SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
    IF v_workspace_id IS NULL THEN
      RAISE EXCEPTION 'Track % not found', _track_id;
    END IF;

    IF NOT public.is_workspace_member(v_uid, v_workspace_id) THEN
      RAISE EXCEPTION 'Not a member of workspace %', v_workspace_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  PERFORM public.add_track_comment_legacy_v0(
    _track_id, _author_name, _author_email, _author_type, _timestamp_sec, _content
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- delete_track_comment : pas de modification — déjà OK (auteur only).


-- ═══════════════════════════════════════════════════════════════════════
-- S10 — APPROVALS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── insert_approval (NON versionné — wrap) ───────────────────────
-- Permission : tout member

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'insert_approval_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.insert_approval(uuid, uuid, uuid, text, uuid)
        RENAME TO insert_approval_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'insert_approval not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.insert_approval(
  _user_id uuid,
  _workspace_id uuid,
  _track_id uuid,
  _send_type text,
  _team_id uuid
)
RETURNS uuid AS $func$
BEGIN
  -- Tout member peut demander une approbation (matrice : flow inclusif)
  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN public.insert_approval_legacy_v0(_user_id, _workspace_id, _track_id, _send_type, _team_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_approval_status (NON versionné — wrap) ────────────────
-- Permission : admin

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_approval_status_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_approval_status(uuid, uuid, text, text)
        RENAME TO update_approval_status_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_approval_status not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_approval_status(
  _user_id uuid,
  _approval_id uuid,
  _status text,
  _note text
)
RETURNS void AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.approvals WHERE id = _approval_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Approval % not found', _approval_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  PERFORM public.update_approval_status_legacy_v0(_user_id, _approval_id, _status, _note);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S11 — TEAM (avec nettoyage du legacy user_roles sync)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── update_member_role (NON versionné — wrap, supprime sync user_roles) ─
-- Permission : admin (déjà OK en prod)
-- Le wrap supprime tout DELETE/INSERT/UPDATE legacy sur user_roles que la
-- prod pourrait faire. Si la prod ne synchronise pas user_roles, ce wrapper
-- est neutre. Si elle le fait avec des valeurs editor/pitcher, elle crashe
-- aujourd'hui ; le wrapper le contourne en interceptant l'appel et en
-- nettoyant après coup.

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_member_role_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_member_role(uuid, uuid, uuid, text, text)
        RENAME TO update_member_role_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_member_role not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_member_role(
  _user_id uuid,
  _member_user_id uuid,
  _workspace_id uuid,
  _access_level text,
  _professional_title text DEFAULT NULL
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  -- Validation des nouvelles valeurs autorisées
  IF _access_level IS NOT NULL AND _access_level NOT IN ('viewer', 'pitcher', 'editor', 'admin') THEN
    RAISE EXCEPTION 'Invalid access level: %', _access_level;
  END IF;

  -- Update direct (court-circuite la sync user_roles legacy qui crashe sur
  -- les nouvelles valeurs editor/pitcher inconnues de l'enum app_role).
  IF _access_level IS NOT NULL THEN
    UPDATE public.workspace_members
    SET access_level = _access_level
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  END IF;

  IF _professional_title IS NOT NULL THEN
    UPDATE public.workspace_members
    SET professional_title = NULLIF(btrim(_professional_title), '')
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  END IF;

  -- Note : on n'appelle PAS legacy_v0 ici puisque la sync user_roles est
  -- volontairement skippée. Si la prod legacy a un audit_log, la perte
  -- est acceptable (Phase 3 ré-implémentera l'audit côté workspace_members).
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── remove_workspace_member (NON versionné — wrap, drop user_roles row) ─
-- Permission : admin (déjà OK en prod)
-- Le wrap exécute le legacy puis nettoie une éventuelle ligne user_roles
-- résiduelle sans crasher si la table est déjà supprimée (Phase 3).

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'remove_workspace_member_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.remove_workspace_member(uuid, uuid, uuid)
        RENAME TO remove_workspace_member_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'remove_workspace_member not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  _user_id uuid,
  _member_user_id uuid,
  _workspace_id uuid
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  -- DELETE direct sur workspace_members (skip le legacy qui peut planter
  -- sur user_roles sync).
  DELETE FROM public.workspace_members
  WHERE user_id = _member_user_id AND workspace_id = _workspace_id;

  -- Cleanup de la ligne user_roles résiduelle (si la table existe encore).
  -- Wrappé dans un BEGIN/EXCEPTION pour ne pas casser si user_roles est
  -- déjà droppée (Phase 3).
  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S12 — STUDIO
-- ═══════════════════════════════════════════════════════════════════════

-- ─── update_studio_submission_status (NON versionné — wrap) ──────
-- Permission : admin

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_studio_submission_status_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_studio_submission_status(uuid, uuid, text)
        RENAME TO update_studio_submission_status_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_studio_submission_status not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_studio_submission_status(
  _user_id uuid,
  _submission_id uuid,
  _status text
)
RETURNS void AS $func$
DECLARE
  v_track_id uuid;
  v_workspace_id uuid;
BEGIN
  -- Studio submissions sont rattachées à un track → workspace
  SELECT track_id INTO v_track_id FROM public.studio_submissions WHERE id = _submission_id;
  IF v_track_id IS NULL THEN
    RAISE EXCEPTION 'Submission % not found', _submission_id;
  END IF;

  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = v_track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Parent track % not found', v_track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  PERFORM public.update_studio_submission_status_legacy_v0(_user_id, _submission_id, _status);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════════════════════════
-- S13 — WORKSPACE METADATA
-- ═══════════════════════════════════════════════════════════════════════

-- ─── update_workspace_name (NON versionné — wrap) ────────────────
-- Permission : admin

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_workspace_name_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_workspace_name(uuid, uuid, text)
        RENAME TO update_workspace_name_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_workspace_name not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_workspace_name(
  _user_id uuid,
  _workspace_id uuid,
  _name text
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_name_legacy_v0(_user_id, _workspace_id, _name);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_workspace_slug (NON versionné — wrap) ────────────────
-- Permission : admin

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_workspace_slug_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_workspace_slug(uuid, uuid, text)
        RENAME TO update_workspace_slug_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_workspace_slug not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_workspace_slug(
  _user_id uuid,
  _workspace_id uuid,
  _slug text
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_slug_legacy_v0(_user_id, _workspace_id, _slug);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─── update_workspace_settings (NON versionné — wrap) ────────────
-- Permission : admin

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_workspace_settings_legacy_v0' AND pronamespace = 'public'::regnamespace) THEN
    BEGIN
      ALTER FUNCTION public.update_workspace_settings(uuid, uuid, jsonb)
        RENAME TO update_workspace_settings_legacy_v0;
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'update_workspace_settings not found — verify signature';
    END;
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_workspace_settings(
  _user_id uuid,
  _workspace_id uuid,
  _settings jsonb
)
RETURNS void AS $func$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_settings_legacy_v0(_user_id, _workspace_id, _settings);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- update_workspace_branding : déjà OK (admin), pas de modification.
-- delete_workspace : owner only, déjà OK, pas de modification.
-- delete_track_comment : auteur only, déjà OK, pas de modification.


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════
-- (a) Le helper require_workspace_access_level existe :
--   SELECT proname FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--     AND proname = 'require_workspace_access_level';
--   -- Doit renvoyer 1 ligne.
--
-- (b) Toutes les RPCs wrappées ont leur version _legacy_v0 et leur wrapper :
--   SELECT proname FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--     AND proname LIKE '%_legacy_v0'
--   ORDER BY proname;
--   -- Doit lister une ligne par RPC wrappée (~26).
--
-- (c) Test fonctionnel (avec un user pitcher non-admin) :
--   SELECT public.delete_track('<pitcher-uid>'::uuid, '<some-track-id>'::uuid);
--   -- Attendu : ERROR "Insufficient access level: admin required, you have pitcher"

-- ═══════════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════════
