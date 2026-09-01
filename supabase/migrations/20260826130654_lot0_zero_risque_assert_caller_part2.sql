-- LOT 0 (2/3) : assert_caller (suite) + diagnostic update_track — audit 24 août 2026
CREATE OR REPLACE FUNCTION public.create_notification(_actor_user_id uuid, _target_user_id uuid, _workspace_id uuid, _type text, _title text, _message text DEFAULT NULL::text, _track_id uuid DEFAULT NULL::uuid, _pitch_id uuid DEFAULT NULL::uuid, _link_id uuid DEFAULT NULL::uuid, _approval_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_notification_id uuid;
BEGIN
  IF _actor_user_id IS NULL THEN RAISE EXCEPTION 'Actor user_id is required'; END IF;
  PERFORM public.assert_caller(_actor_user_id);
  IF NOT public.is_workspace_member(_actor_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Actor % is not a member of workspace %', _actor_user_id, _workspace_id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _target_user_id IS NULL THEN RAISE EXCEPTION 'Target user_id is required'; END IF;
  IF NOT public.is_workspace_member(_target_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Target % is not a member of workspace %', _target_user_id, _workspace_id;
  END IF;
  IF _title IS NULL OR length(btrim(_title)) = 0 THEN RAISE EXCEPTION 'Notification title is required'; END IF;
  IF _type IS NULL OR length(btrim(_type)) = 0 THEN RAISE EXCEPTION 'Notification type is required'; END IF;
  INSERT INTO public.notifications (user_id, workspace_id, type, title, message, track_id, pitch_id, link_id, approval_id, is_read, created_at)
  VALUES (_target_user_id, _workspace_id, _type::notification_type, _title, _message, _track_id, _pitch_id, _link_id, _approval_id, false, now())
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.save_track_to_trakalog(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_workspace_member(_user_id, _target_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of target workspace %', _target_workspace_id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.save_track_to_trakalog_legacy_v0(_track_id, _source_workspace_id, _target_workspace_id, _user_id);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_approval_status(_user_id uuid, _approval_id uuid, _status text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.approvals WHERE id = _approval_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Approval % not found', _approval_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');
  PERFORM public.update_approval_status_legacy_v0(_user_id, _approval_id, _status, _note);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_contact(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text DEFAULT NULL::text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.update_contact_legacy_v0(_user_id, _workspace_id, _contact_id, _first_name, _last_name, _email, _role, _company, _phone, _pro, _ipi, _publisher, _stage_name, _city, _country);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_playlist(_user_id uuid, _playlist_id uuid, _name text DEFAULT NULL::text, _description text DEFAULT NULL::text, _cover_url text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.playlists WHERE id = _playlist_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Playlist % not found', _playlist_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');
  PERFORM public.update_playlist_legacy_v0(_user_id, _playlist_id, _name, _description, _cover_url);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_shared_link_status(_user_id uuid, _link_id uuid, _disabled boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid; v_created_by uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id, created_by INTO v_workspace_id, v_created_by FROM public.shared_links WHERE id = _link_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Shared link % not found', _link_id; END IF;
  IF NOT (public.has_workspace_access_level(_user_id, v_workspace_id, 'pitcher')
    AND (v_created_by = _user_id OR public.has_workspace_access_level(_user_id, v_workspace_id, 'admin'))) THEN
    RAISE EXCEPTION 'Insufficient access level for update_shared_link_status: pitcher required, and either be the creator or admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM public.update_shared_link_status_legacy_v0(_user_id, _link_id, _disabled);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.stems WHERE id = _stem_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Stem % not found', _stem_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');
  PERFORM public.update_stem_type_legacy_v0(_user_id, _stem_id, _stem_type);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_studio_submission_status(_user_id uuid, _submission_id uuid, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_track_id uuid; v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT track_id INTO v_track_id FROM public.studio_submissions WHERE id = _submission_id;
  IF v_track_id IS NULL THEN RAISE EXCEPTION 'Submission % not found', _submission_id; END IF;
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = v_track_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Parent track % not found', v_track_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');
  PERFORM public.update_studio_submission_status_legacy_v0(_user_id, _submission_id, _status);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_track_document_status(_user_id uuid, _doc_id uuid, _status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.track_documents WHERE id = _doc_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Document % not found', _doc_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');
  PERFORM public.update_track_document_status_legacy_v0(_user_id, _doc_id, _status);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_workspace_name(_user_id uuid, _workspace_id uuid, _name text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_name_legacy_v0(_user_id, _workspace_id, _name);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_workspace_settings(_user_id uuid, _workspace_id uuid, _settings jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_settings_legacy_v0(_user_id, _workspace_id, _settings);
END;
$func$;

CREATE OR REPLACE FUNCTION public.update_workspace_slug(_user_id uuid, _workspace_id uuid, _slug text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_slug_legacy_v0(_user_id, _workspace_id, _slug);
END;
$func$;

-- Diagnostic uniquement : le comportement ne change pas, les clés hors
-- whitelist sont toujours ignorées, mais elles sont désormais loguées.
CREATE OR REPLACE FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
DECLARE
  workspace_uuid uuid;
  uploader_uuid uuid;
  k text;
  v jsonb;
  set_clauses text := '';
  text_arr text[];
  v_ignored text[] := ARRAY[]::text[];
  v_allowed_columns text[] := ARRAY[
    'title', 'artist', 'featuring', 'track_type', 'status',
    'bpm', 'key', 'genre', 'mood', 'language', 'gender',
    'notes', 'lyrics', 'lyrics_segments',
    'audio_url', 'audio_preview_url', 'cover_url',
    'duration_sec', 'waveform_data', 'sonic_dna', 'chapters',
    'album', 'upc', 'isrc', 'iswc',
    'released_at', 'copyright', 'explicit',
    'labels', 'publishers', 'credits', 'tags', 'splits',
    'qr_token', 'production_stage'
  ];
  v_text_array_columns text[] := ARRAY['genre', 'mood', 'labels', 'publishers'];
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id, uploaded_by INTO workspace_uuid, uploader_uuid
  FROM public.tracks WHERE id = _track_id;

  IF workspace_uuid IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  IF NOT (
    public.has_workspace_access_level(_user_id, workspace_uuid, 'editor')
    OR (public.has_workspace_access_level(_user_id, workspace_uuid, 'pitcher') AND uploader_uuid = _user_id)
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for update_track: editor required to edit any track, or pitcher to edit own track'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each(_updates) LOOP
    IF NOT (k = ANY(v_allowed_columns)) THEN
      v_ignored := array_append(v_ignored, k);
      CONTINUE;
    END IF;

    IF k = ANY(v_text_array_columns) THEN
      IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
        set_clauses := set_clauses || format(', %I = NULL', k);
      ELSIF jsonb_typeof(v) = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(v)) INTO text_arr;
        set_clauses := set_clauses || format(', %I = %L::text[]', k, text_arr);
      ELSIF jsonb_typeof(v) = 'string' THEN
        set_clauses := set_clauses || format(', %I = ARRAY[%L]::text[]', k, v #>> '{}');
      ELSE
        set_clauses := set_clauses || format(', %I = NULL', k);
      END IF;
    ELSIF k = 'released_at' AND (jsonb_typeof(v) = 'null' OR (v #>> '{}') = '') THEN
      set_clauses := set_clauses || format(', %I = NULL', k);
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

  IF array_length(v_ignored, 1) > 0 THEN
    RAISE WARNING 'update_track: cle ignoree (track=%): %', _track_id, array_to_string(v_ignored, ', ');
  END IF;

  IF length(set_clauses) > 0 THEN
    set_clauses := substring(set_clauses from 3);
    EXECUTE format('UPDATE public.tracks SET %s, updated_at = now() WHERE id = %L', set_clauses, _track_id);
  END IF;
END;
$func$;
