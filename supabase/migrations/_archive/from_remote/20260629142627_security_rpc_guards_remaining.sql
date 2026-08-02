
-- Drops préventifs
DROP FUNCTION IF EXISTS public.upsert_contact(uuid,uuid,text,text,text,text,text,text,text,text,text,text[],text,text);
DROP FUNCTION IF EXISTS public.update_user_profile(uuid,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.mark_onboarding_complete(uuid);
DROP FUNCTION IF EXISTS public.upsert_notification_preferences(uuid,jsonb);
DROP FUNCTION IF EXISTS public.upsert_track_rating(uuid,uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.log_audit_event(uuid,text,text,uuid,jsonb);
DROP FUNCTION IF EXISTS public.write_audit_log(uuid,uuid,text,text,uuid,text);
DROP FUNCTION IF EXISTS public.get_artist_aliases(uuid);
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);
DROP FUNCTION IF EXISTS public.get_workspace_catalog_shares(uuid);
DROP FUNCTION IF EXISTS public.clean_revoked_playlist_tracks(uuid,uuid,uuid);

-- upsert_contact → pitcher+
CREATE OR REPLACE FUNCTION public.upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text DEFAULT NULL, _stage_name text DEFAULT NULL, _role text DEFAULT NULL, _company text DEFAULT NULL, _phone text DEFAULT NULL, _city text DEFAULT NULL, _country text DEFAULT NULL, _pro text[] DEFAULT NULL, _ipi text DEFAULT NULL, _publisher text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  IF _email IS NOT NULL AND _email != '' THEN
    SELECT id INTO v_id FROM contacts WHERE workspace_id = _workspace_id AND lower(email) = lower(_email) LIMIT 1;
    IF v_id IS NOT NULL THEN
      DELETE FROM contacts WHERE workspace_id = _workspace_id AND id != v_id AND email IS NULL
        AND lower(first_name) = lower(_first_name) AND lower(coalesce(last_name,'')) = lower(coalesce(_last_name,''));
    END IF;
  END IF;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM contacts WHERE workspace_id = _workspace_id
      AND lower(first_name) = lower(_first_name) AND lower(coalesce(last_name,'')) = lower(coalesce(_last_name,'')) LIMIT 1;
  END IF;
  IF v_id IS NOT NULL THEN
    UPDATE contacts SET
      email = CASE WHEN _email IS NOT NULL AND _email != '' THEN _email ELSE email END,
      stage_name = CASE WHEN _stage_name IS NOT NULL AND _stage_name != '' THEN _stage_name ELSE stage_name END,
      role = CASE WHEN _role IS NOT NULL AND _role != '' THEN _role ELSE role END,
      company = CASE WHEN _company IS NOT NULL AND _company != '' THEN _company ELSE company END,
      phone = CASE WHEN _phone IS NOT NULL AND _phone != '' THEN _phone ELSE phone END,
      city = CASE WHEN _city IS NOT NULL AND _city != '' THEN _city ELSE city END,
      country = CASE WHEN _country IS NOT NULL AND _country != '' THEN _country ELSE country END,
      pro = CASE WHEN _pro IS NOT NULL THEN _pro ELSE pro END,
      ipi = CASE WHEN _ipi IS NOT NULL AND _ipi != '' THEN _ipi ELSE ipi END,
      publisher = CASE WHEN _publisher IS NOT NULL AND _publisher != '' THEN _publisher ELSE publisher END
    WHERE id = v_id;
  ELSE
    INSERT INTO contacts (workspace_id, added_by, first_name, last_name, email, stage_name, role, company, phone, city, country, pro, ipi, publisher)
    VALUES (_workspace_id, _user_id, _first_name, _last_name, _email, _stage_name, _role, _company, _phone, _city, _country, _pro, _ipi, _publisher)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$func$;

-- update_user_profile → propre profil seulement
CREATE OR REPLACE FUNCTION public.update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data ||
    jsonb_build_object('first_name', _first_name, 'last_name', _last_name, 'phone', _phone, 'bio', _bio, 'avatar_url', _avatar_url)
  WHERE id = _user_id;
END;
$function$;

-- mark_onboarding_complete → propre compte seulement
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"onboarding_complete": true}'::jsonb
  WHERE id = _user_id;
END;
$function$;

-- upsert_notification_preferences → propre compte seulement
CREATE OR REPLACE FUNCTION public.upsert_notification_preferences(_user_id uuid, _preferences jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('notification_preferences', _preferences)
  WHERE id = _user_id;
END;
$function$;

-- upsert_track_rating → viewer+
CREATE OR REPLACE FUNCTION public.upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'viewer');
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'Rating must be between 1 and 5'; END IF;
  INSERT INTO track_ratings (track_id, workspace_id, user_id, rating)
  VALUES (_track_id, _workspace_id, _user_id, _rating)
  ON CONFLICT (track_id, user_id) DO UPDATE SET rating = _rating, updated_at = now();
END;
$function$;

-- log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (_user_id, _action, _resource_type, _resource_id, _metadata);
END;
$function$;

-- write_audit_log
CREATE OR REPLACE FUNCTION public.write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  INSERT INTO audit_logs (user_id, workspace_id, action, resource_type, resource_id, metadata)
  VALUES (_user_id, _workspace_id, _action, _entity_type, _entity_id, _metadata::jsonb);
END;
$function$;

-- get_artist_aliases → membre du workspace
CREATE OR REPLACE FUNCTION public.get_artist_aliases(_workspace_id uuid)
RETURNS TABLE (id uuid, workspace_id uuid, alias_name text, contact_ids uuid[], created_by uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT aa.id, aa.workspace_id, aa.alias_name, aa.contact_ids, aa.created_by, aa.created_at, aa.updated_at
  FROM artist_aliases aa WHERE aa.workspace_id = _workspace_id;
END;
$function$;

-- get_user_workspaces → propre compte
CREATE OR REPLACE FUNCTION public.get_user_workspaces(_user_id uuid)
RETURNS TABLE (id uuid, name text, is_personal boolean, owner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);
  RETURN QUERY SELECT w.id, w.name, w.is_personal, w.owner_id
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id;
END;
$function$;

-- get_workspace_catalog_shares → membre
CREATE OR REPLACE FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid)
RETURNS TABLE (id uuid, track_id uuid, source_workspace_id uuid, target_workspace_id uuid, access_level text, status text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT cs.id, cs.track_id, cs.source_workspace_id, cs.target_workspace_id, cs.access_level, cs.status, cs.created_at
  FROM catalog_shares cs WHERE cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id;
END;
$function$;

-- clean_revoked_playlist_tracks → editor+
CREATE OR REPLACE FUNCTION public.clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_workspace_access_level(auth.uid(), _source_workspace_id, 'editor') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _track_id IS NOT NULL THEN
    DELETE FROM playlist_tracks pt
    WHERE pt.track_id = _track_id
      AND EXISTS (SELECT 1 FROM playlists p WHERE p.id = pt.playlist_id AND p.workspace_id = _target_workspace_id);
  ELSE
    DELETE FROM playlist_tracks pt
    WHERE EXISTS (
      SELECT 1 FROM playlists p WHERE p.id = pt.playlist_id AND p.workspace_id = _target_workspace_id
    ) AND NOT EXISTS (
      SELECT 1 FROM catalog_shares cs WHERE cs.track_id = pt.track_id
        AND cs.source_workspace_id = _source_workspace_id
        AND cs.target_workspace_id = _target_workspace_id
        AND cs.status = 'active'
    );
  END IF;
END;
$function$;
;
