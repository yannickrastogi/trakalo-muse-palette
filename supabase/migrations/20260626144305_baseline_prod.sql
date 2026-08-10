--
-- PostgreSQL database dump
--

-- \restrict 9gZAMj7CfPwiaUMV2WwD0dQRPkiLnHpLmeqzLPrno7KnzzqpQEYkLnJcAh1zCE1

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public; -- Schema already exists by default in PostgreSQL


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'a_r',
    'assistant',
    'producer',
    'songwriter',
    'musician',
    'mix_engineer',
    'mastering_engineer',
    'publisher',
    'viewer'
);


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_status AS ENUM (
    'draft',
    'pending',
    'signed'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed',
    'cancelled'
);


--
-- Name: link_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.link_status AS ENUM (
    'active',
    'expired',
    'disabled'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'pitch_opened',
    'pitch_accepted',
    'pitch_declined',
    'track_uploaded',
    'track_status_changed',
    'link_opened',
    'link_downloaded',
    'approval_requested',
    'approval_resolved',
    'member_invited',
    'member_joined',
    'comment_added',
    'access_requested',
    'access_granted',
    'access_declined'
);


--
-- Name: pitch_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pitch_status AS ENUM (
    'draft',
    'sent',
    'opened',
    'declined',
    'accepted'
);


--
-- Name: share_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.share_type AS ENUM (
    'stems',
    'track',
    'playlist',
    'pack'
);


--
-- Name: stem_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stem_type AS ENUM (
    'kick',
    'snare',
    'bass',
    'guitar',
    'vocal',
    'synth',
    'drums',
    'background_vocal',
    'fx',
    'other'
);


--
-- Name: track_gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.track_gender AS ENUM (
    'male',
    'female',
    'duet',
    'n_a'
);


--
-- Name: track_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.track_status AS ENUM (
    'available',
    'on_hold',
    'released'
);


--
-- Name: track_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.track_type AS ENUM (
    'instrumental',
    'sample',
    'acapella',
    'song'
);


--
-- Name: add_contact_manual(uuid, uuid, text, text, text, text, text, text, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_contact_manual(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  RETURN public.add_contact_manual_legacy_v0(
    _user_id, _workspace_id, _first_name, _last_name, _email, _role,
    _company, _phone, _pro, _ipi, _publisher,
    _city, _country, _stage_name
  );
END;
$$;


--
-- Name: add_contact_manual_legacy_v0(uuid, uuid, text, text, text, text, text, text, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_contact_manual_legacy_v0(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  INSERT INTO contacts (
    workspace_id, created_by,
    first_name, last_name, email, role, company, phone,
    pro, ipi, publisher,
    city, country,
    stage_name
  )
  VALUES (
    _workspace_id, _user_id,
    _first_name, _last_name, _email, _role, _company, _phone,
    _pro, _ipi, _publisher,
    _city, _country,
    _stage_name
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;


--
-- Name: add_playlist_tracks(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: add_playlist_tracks_legacy_v0(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _ws_id uuid;
  _i int;
  _max_pos int;
BEGIN
  SELECT workspace_id INTO _ws_id FROM playlists WHERE id = _playlist_id;
  IF _ws_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _ws_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _ws_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(MAX(position), -1) INTO _max_pos FROM playlist_tracks WHERE playlist_id = _playlist_id;

  FOR _i IN 1..array_length(_track_ids, 1) LOOP
    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
    VALUES (_playlist_id, _track_ids[_i], _max_pos + _i, _user_id)
    ON CONFLICT (playlist_id, track_id) DO NOTHING;
  END LOOP;
END;
$$;


--
-- Name: add_to_whitelist(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_to_whitelist(_user_id uuid, _email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id)
  THEN RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege'; END IF;
  INSERT INTO public.whitelisted_emails (email) VALUES (lower(_email)) ON CONFLICT (email) DO NOTHING;
END;
$$;


--
-- Name: add_track_comment(uuid, text, text, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_track_comment(_track_id uuid, _author_name text, _author_email text, _author_type text, _timestamp_sec numeric, _content text, _workspace_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_home   uuid;
  v_target uuid;
  v_new_id uuid;
BEGIN
  SELECT workspace_id INTO v_home FROM public.tracks WHERE id = _track_id;
  IF v_home IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  v_target := COALESCE(_workspace_id, v_home);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_workspace_member(v_uid, v_target) THEN
    RAISE EXCEPTION 'Not a member of workspace %', v_target USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- the viewing workspace must actually have access to this track (home OR an active catalog share)
  IF v_target <> v_home
     AND NOT EXISTS (
       SELECT 1 FROM public.catalog_shares cs
       WHERE cs.target_workspace_id = v_target
         AND cs.status = 'active'
         AND (cs.track_id = _track_id
              OR (cs.track_id IS NULL AND cs.source_workspace_id = v_home))
     ) THEN
    RAISE EXCEPTION 'Workspace % has no access to track %', v_target, _track_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.track_comments
    (track_id, shared_link_id, author_name, author_email, author_type, timestamp_sec, content, workspace_id)
  VALUES
    (_track_id, NULL, _author_name, _author_email, COALESCE(_author_type, 'owner'),
     COALESCE(_timestamp_sec, 0), _content, v_target)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


--
-- Name: add_track_comment_legacy_v0(uuid, uuid, text, numeric, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_track_comment_legacy_v0(_track_id uuid, _user_id uuid, _content text, _timecode numeric DEFAULT NULL::numeric, _visitor_name text DEFAULT NULL::text, _visitor_email text DEFAULT NULL::text, _shared_link_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO track_comments (id, track_id, user_id, content, timecode, visitor_name, visitor_email, shared_link_id)
  VALUES (gen_random_uuid(), _track_id, _user_id, _content, _timecode, _visitor_name, _visitor_email, _shared_link_id)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;


--
-- Name: add_track_version(uuid, uuid, uuid, text, text, text, jsonb, jsonb, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_track_version(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text, _audio_url text, _audio_preview_url text, _waveform_data jsonb, _sonic_dna jsonb, _duration_sec numeric, _notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  INSERT INTO track_versions (track_id, version_name, audio_url, audio_preview_url, waveform_data, sonic_dna, duration_sec, notes, created_by)
  VALUES (_track_id, _version_name, _audio_url, _audio_preview_url, _waveform_data, _sonic_dna, _duration_sec, _notes, _user_id)
  RETURNING id INTO v_id;
  UPDATE tracks SET version_count = COALESCE(version_count, 0) + 1 WHERE id = _track_id;
  RETURN v_id;
END;
$$;


--
-- Name: assert_caller(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_caller(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Edge Functions appellent en service_role : pas d'identité user à vérifier ici.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: caller identity mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;


--
-- Name: assert_shared_link_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_shared_link_access(_link_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token text;
begin
  if _link_id is null then
    return;
  end if;

  -- Appel serveur de confiance
  if auth.role() = 'service_role' then
    return;
  end if;

  -- Lien sans mot de passe : rien a verifier
  if not public.shared_link_is_secured(_link_id) then
    return;
  end if;

  begin
    v_token := current_setting('request.headers', true)::json ->> 'x-shared-link-session';
  exception when others then
    v_token := null;
  end;

  if not public.verify_shared_link_session(_link_id, v_token) then
    raise exception 'password required for this link'
      using errcode = 'insufficient_privilege';
  end if;
end
$$;


--
-- Name: assert_shared_link_access_by_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_shared_link_access_by_slug(_slug text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  select sl.id into v_id from shared_links sl where sl.link_slug = _slug limit 1;
  perform public.assert_shared_link_access(v_id);
end
$$;


--
-- Name: auto_create_alias_from_stage_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_alias_from_stage_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.stage_name IS NOT NULL AND NEW.stage_name != ''
     AND lower(NEW.stage_name) != lower(concat_ws(' ', NEW.first_name, NEW.last_name)) THEN
    BEGIN
      INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
      VALUES (NEW.workspace_id, NEW.stage_name, ARRAY[NEW.id]::uuid[], NEW.created_by)
      ON CONFLICT (workspace_id, alias_name) DO UPDATE
        SET contact_ids = (SELECT array_agg(DISTINCT c)
          FROM unnest(artist_aliases.contact_ids || ARRAY[NEW.id]::uuid[]) AS c);
    EXCEPTION WHEN OTHERS THEN
      -- Ne jamais bloquer la sauvegarde du contact si l'alias échoue
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: bulk_update_tracks(uuid, uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tid uuid;
  v_count integer := 0;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF _track_ids IS NULL OR array_length(_track_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'Updates payload must be a JSON object';
  END IF;

  FOREACH v_tid IN ARRAY _track_ids LOOP
    -- delegates whitelist + access-level enforcement to update_track (per track)
    PERFORM public.update_track(_user_id, v_tid, _updates);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: check_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(_key text, _max_requests integer, _window_seconds integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _current record;
BEGIN
  -- Chercher l'entrée existante
  SELECT * INTO _current FROM rate_limits WHERE key = _key;
  
  IF _current IS NULL THEN
    -- Première requête : créer l'entrée
    INSERT INTO rate_limits (key, window_start, request_count)
    VALUES (_key, now(), 1)
    ON CONFLICT (key) DO UPDATE SET request_count = rate_limits.request_count + 1;
    RETURN true;
  END IF;
  
  -- Si le window est expiré, reset
  IF _current.window_start + (_window_seconds || ' seconds')::interval < now() THEN
    UPDATE rate_limits SET window_start = now(), request_count = 1 WHERE key = _key;
    RETURN true;
  END IF;
  
  -- Vérifier la limite
  IF _current.request_count >= _max_requests THEN
    RETURN false;
  END IF;
  
  -- Incrémenter
  UPDATE rate_limits SET request_count = request_count + 1 WHERE key = _key;
  RETURN true;
END;
$$;


--
-- Name: check_smart_ar_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_smart_ar_quota(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_plan text; v_used int; v_permonth int; v_lifetime int; v_limit int; v_allowed boolean;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.reset_monthly_usage_if_due(_user_id);

  SELECT s.plan, s.smart_ar_queries_this_month, pl.smart_ar_per_month, pl.smart_ar_lifetime
    INTO v_plan, v_used, v_permonth, v_lifetime
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = _user_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription');
  END IF;

  v_limit := CASE WHEN v_plan = 'free' THEN coalesce(v_lifetime,0) ELSE v_permonth END;
  v_allowed := (v_limit = -1) OR (coalesce(v_used,0) < v_limit);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'plan', v_plan,
    'used', coalesce(v_used,0),
    'limit', v_limit,
    'scope', CASE WHEN v_plan='free' THEN 'lifetime' ELSE 'monthly' END
  );
END;
$$;


--
-- Name: check_upload_allowed(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_upload_allowed(_file_size_bytes bigint) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub record;
  v_tracks_max integer;
  v_storage_max bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;
  
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = v_user_id;
  
  IF v_sub IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_subscription');
  END IF;
  
  -- Determine limits based on plan (matches PLAN_LIMITS in src/lib/plans.ts)
  CASE v_sub.plan
    WHEN 'free' THEN
      v_tracks_max := 10;
      v_storage_max := 1610612736; -- 1.5 GB
    WHEN 'starter' THEN
      v_tracks_max := 100;
      v_storage_max := 42949672960; -- 40 GB
    WHEN 'pro' THEN
      v_tracks_max := 1000;
      v_storage_max := 429496729600; -- 400 GB
    WHEN 'business' THEN
      v_tracks_max := -1; -- unlimited tracks
      v_storage_max := 2199023255552; -- 2 TB
    ELSE
      v_tracks_max := 10;
      v_storage_max := 1610612736;
  END CASE;
  
  -- Check tracks count
  IF v_tracks_max != -1 AND v_sub.tracks_uploaded_count >= v_tracks_max THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'tracks_limit_reached',
      'current', v_sub.tracks_uploaded_count,
      'max', v_tracks_max,
      'plan', v_sub.plan
    );
  END IF;
  
  -- Check storage
  IF (v_sub.storage_bytes_used + _file_size_bytes) > v_storage_max THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'storage_limit_reached',
      'current_bytes', v_sub.storage_bytes_used,
      'requested_bytes', _file_size_bytes,
      'max_bytes', v_storage_max,
      'plan', v_sub.plan
    );
  END IF;
  
  RETURN json_build_object(
    'allowed', true,
    'tracks_remaining', CASE WHEN v_tracks_max = -1 THEN -1 ELSE v_tracks_max - v_sub.tracks_uploaded_count END,
    'storage_remaining_bytes', v_storage_max - v_sub.storage_bytes_used,
    'plan', v_sub.plan
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    workspace_id uuid,
    created_by uuid,
    dedupe_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    locked_by text,
    locked_at timestamp with time zone,
    run_after timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone
);


--
-- Name: TABLE jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.jobs IS 'File d''attente asynchrone. Le worker Railway reclame les jobs via claim_jobs().';


--
-- Name: claim_jobs(text, text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_jobs(_worker_id text, _job_types text[] DEFAULT NULL::text[], _limit integer DEFAULT 1) RETURNS SETOF public.jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  with picked as (
    select j.id
    from jobs j
    where j.status = 'pending'
      and j.run_after <= now()
      and (_job_types is null or j.job_type = any(_job_types))
    order by j.priority asc, j.created_at asc
    limit greatest(1, least(20, coalesce(_limit, 1)))
    for update skip locked
  )
  update jobs u
     set status     = 'processing',
         locked_by  = left(coalesce(_worker_id, 'unknown'), 100),
         locked_at  = now(),
         started_at = coalesce(u.started_at, now()),
         attempts   = u.attempts + 1
   where u.id in (select id from picked)
  returning u.*;
end
$$;


--
-- Name: clean_revoked_playlist_tracks(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: cleanup_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_rate_limits() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  DELETE FROM rate_limits WHERE window_start < now() - interval '24 hours';
$$;


--
-- Name: complete_job(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_job(_job_id uuid, _result jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update jobs
     set status = 'done', result = _result,
         error = null, finished_at = now(), locked_by = null, locked_at = null
   where id = _job_id;
end
$$;


--
-- Name: create_notification(uuid, uuid, uuid, text, text, text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(_actor_user_id uuid, _target_user_id uuid, _workspace_id uuid, _type text, _title text, _message text DEFAULT NULL::text, _track_id uuid DEFAULT NULL::uuid, _pitch_id uuid DEFAULT NULL::uuid, _link_id uuid DEFAULT NULL::uuid, _approval_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  IF _actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Actor user_id is required';
  END IF;
  IF NOT public.is_workspace_member(_actor_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Actor % is not a member of workspace %',
      _actor_user_id, _workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id is required';
  END IF;
  IF NOT public.is_workspace_member(_target_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Target % is not a member of workspace %',
      _target_user_id, _workspace_id;
  END IF;

  IF _title IS NULL OR length(btrim(_title)) = 0 THEN
    RAISE EXCEPTION 'Notification title is required';
  END IF;
  IF _type IS NULL OR length(btrim(_type)) = 0 THEN
    RAISE EXCEPTION 'Notification type is required';
  END IF;

  INSERT INTO public.notifications (
    user_id, workspace_id, type, title, message,
    track_id, pitch_id, link_id, approval_id,
    is_read, created_at
  ) VALUES (
    _target_user_id, _workspace_id, _type::notification_type,
    _title, _message,
    _track_id, _pitch_id, _link_id, _approval_id,
    false, now()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;


--
-- Name: create_pitch(uuid, uuid, text, text, text, text, text, uuid[], text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pitch(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text DEFAULT NULL::text, _recipient_company text DEFAULT ''::text, _subject text DEFAULT ''::text, _message text DEFAULT NULL::text, _track_ids uuid[] DEFAULT '{}'::uuid[], _status text DEFAULT 'draft'::text, _sent_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_pitch_legacy_v0(
    _user_id, _workspace_id, _recipient_name, _recipient_email,
    _recipient_company, _subject, _message, _track_ids, _status, _sent_at
  );
END;
$$;


--
-- Name: create_pitch_legacy_v0(uuid, uuid, text, text, text, text, text, uuid[], text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pitch_legacy_v0(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text DEFAULT NULL::text, _recipient_company text DEFAULT ''::text, _subject text DEFAULT ''::text, _message text DEFAULT NULL::text, _track_ids uuid[] DEFAULT '{}'::uuid[], _status text DEFAULT 'draft'::text, _sent_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _pitch_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO pitches (
    workspace_id, sent_by, recipient_name, recipient_email,
    recipient_company, subject, message, track_ids, status, sent_at
  )
  VALUES (
    _workspace_id, _user_id, _recipient_name, _recipient_email,
    _recipient_company, _subject, _message, _track_ids, _status::pitch_status, _sent_at
  )
  RETURNING id INTO _pitch_id;

  RETURN _pitch_id;
END;
$$;


--
-- Name: create_playlist(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_playlist(_user_id uuid, _workspace_id uuid, _name text, _description text DEFAULT NULL::text, _cover_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_playlist_legacy_v0(_user_id, _workspace_id, _name, _description, _cover_url);
END;
$$;


--
-- Name: create_playlist_legacy_v0(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_playlist_legacy_v0(_user_id uuid, _workspace_id uuid, _name text, _description text DEFAULT ''::text, _cover_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _playlist_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO playlists (workspace_id, created_by, name, description, cover_url)
  VALUES (_workspace_id, _user_id, _name, _description, _cover_url)
  RETURNING id INTO _playlist_id;

  RETURN _playlist_id;
END;
$$;


--
-- Name: create_shared_link(uuid, uuid, text, uuid, uuid, text, text, text, text, text, boolean, boolean, text, timestamp with time zone, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_shared_link(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid DEFAULT NULL::uuid, _playlist_id uuid DEFAULT NULL::uuid, _link_name text DEFAULT ''::text, _link_slug text DEFAULT ''::text, _link_type text DEFAULT 'public'::text, _password_hash text DEFAULT NULL::text, _message text DEFAULT NULL::text, _allow_download boolean DEFAULT false, _allow_save boolean DEFAULT true, _download_quality text DEFAULT NULL::text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _pack_items text DEFAULT NULL::text, _watermarking_enabled boolean DEFAULT true, _gate_screen_enabled boolean DEFAULT true) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_shared_link_legacy_v0(
    _user_id, _workspace_id, _share_type, _track_id, _playlist_id,
    _link_name, _link_slug, _link_type, _password_hash, _message,
    _allow_download, _allow_save, _download_quality, _expires_at, _pack_items,
    _watermarking_enabled, _gate_screen_enabled
  );
END;
$$;


--
-- Name: create_shared_link_legacy_v0(uuid, uuid, text, uuid, uuid, text, text, text, text, text, boolean, boolean, text, timestamp with time zone, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_shared_link_legacy_v0(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid DEFAULT NULL::uuid, _playlist_id uuid DEFAULT NULL::uuid, _link_name text DEFAULT ''::text, _link_slug text DEFAULT ''::text, _link_type text DEFAULT 'public'::text, _password_hash text DEFAULT NULL::text, _message text DEFAULT NULL::text, _allow_download boolean DEFAULT false, _allow_save boolean DEFAULT true, _download_quality text DEFAULT NULL::text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _pack_items text DEFAULT NULL::text, _watermarking_enabled boolean DEFAULT true, _gate_screen_enabled boolean DEFAULT true) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _result json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO shared_links (
    workspace_id, created_by, share_type, track_id, playlist_id,
    link_name, link_slug, link_type, password_hash, message,
    allow_download, allow_save, download_quality, expires_at, status, pack_items,
    watermarking_enabled, gate_screen_enabled
  )
  VALUES (
    _workspace_id, _user_id, _share_type::share_type, _track_id, _playlist_id,
    _link_name, _link_slug, _link_type, _password_hash, _message,
    _allow_download, _allow_save, _download_quality, _expires_at, 'active'::link_status,
    CASE WHEN _pack_items IS NOT NULL THEN _pack_items::jsonb ELSE NULL END,
    _watermarking_enabled, _gate_screen_enabled
  )
  RETURNING row_to_json(shared_links.*) INTO _result;

  RETURN _result;
END;
$$;


--
-- Name: create_shared_link_session(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_shared_link_session(_link_id uuid, _ttl_hours integer DEFAULT 12) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_token text;
  v_ok    boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  -- Le lien doit exister, etre actif et non expire.
  select true into v_ok
  from shared_links sl
  where sl.id = _link_id
    and sl.status = 'active'::link_status
    and (sl.expires_at is null or sl.expires_at > now())
  limit 1;

  if not coalesce(v_ok, false) then
    raise exception 'invalid link' using errcode = 'insufficient_privilege';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into shared_link_sessions (link_id, token_hash, expires_at)
  values (_link_id,
          encode(sha256(v_token::bytea), 'hex'),
          now() + make_interval(hours => greatest(1, least(72, coalesce(_ttl_hours, 12)))));

  -- Menage opportuniste des sessions expirees de ce lien.
  delete from shared_link_sessions
  where link_id = _link_id and expires_at < now() - interval '1 day';

  return v_token;
end
$$;


--
-- Name: create_workspace_with_member(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_workspace_with_member(_name text, _description text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_workspace_id uuid;
  resolved_user_id uuid;
  workspace_slug text;
BEGIN
  IF _user_id IS NOT NULL THEN
    PERFORM public.assert_caller(_user_id);
  END IF;

  resolved_user_id := COALESCE(_user_id, auth.uid());

  IF resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID available';
  END IF;

  workspace_slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  workspace_slug := workspace_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO workspaces (id, name, slug, owner_id)
  VALUES (gen_random_uuid(), _name, workspace_slug, resolved_user_id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, access_level, professional_title)
  VALUES (new_workspace_id, resolved_user_id, 'admin', 'Producer');

  RETURN new_workspace_id;
END;
$$;


--
-- Name: delete_artist_alias(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_artist_alias(_user_id uuid, _workspace_id uuid, _alias_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  DELETE FROM artist_aliases WHERE id = _alias_id AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: delete_contact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_contact(_user_id uuid, _contact_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM contacts WHERE id = _contact_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Contact not found'; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');
  DELETE FROM contacts WHERE id = _contact_id;
END;
$$;


--
-- Name: delete_contacts(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_contacts(_user_id uuid, _workspace_id uuid, _ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND access_level IN ('editor','admin')
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM contacts WHERE id = ANY(_ids) AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: delete_leak_trace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_leak_trace(_trace_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _wid uuid;
  _deleted integer;
begin
  perform public.assert_caller(_user_id);

  select workspace_id into _wid from public.leak_traces where id = _trace_id;
  if _wid is null then
    raise exception 'Leak trace not found or access denied';
  end if;

  perform public.require_workspace_access_level(_user_id, _wid, 'admin');

  delete from public.leak_traces where id = _trace_id;
  get diagnostics _deleted = row_count;
  if _deleted = 0 then
    raise exception 'Leak trace not found or access denied';
  end if;

  return true;
end;
$$;


--
-- Name: delete_playlist(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_playlist(_user_id uuid, _playlist_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: delete_playlist_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_playlist_legacy_v0(_user_id uuid, _playlist_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _ws_id uuid;
BEGIN
  SELECT workspace_id INTO _ws_id FROM playlists WHERE id = _playlist_id;
  IF _ws_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _ws_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _ws_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM playlist_tracks WHERE playlist_id = _playlist_id;
  DELETE FROM playlists WHERE id = _playlist_id;
END;
$$;


--
-- Name: delete_stem(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_stem(_user_id uuid, _stem_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: delete_stem_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_stem_legacy_v0(_user_id uuid, _stem_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT t.workspace_id INTO _workspace_id 
  FROM stems s JOIN tracks t ON t.id = s.track_id 
  WHERE s.id = _stem_id;
  
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  DELETE FROM stems WHERE id = _stem_id;
END;
$$;


--
-- Name: delete_track(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track(_user_id uuid, _track_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Track % not found', _track_id; END IF;
  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');
  PERFORM public.delete_track_legacy_v0(_user_id, _track_id);
END;
$$;


--
-- Name: delete_track_comment(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_comment(_comment_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  DELETE FROM track_comments tc
  WHERE tc.id = _comment_id
    AND EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = tc.track_id
        AND public.has_workspace_access_level(_user_id, t.workspace_id, 'editor')
    );
END;
$$;


--
-- Name: delete_track_comment_via_token(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_comment_via_token(_comment_id uuid, _shared_link_token text, _author_secret text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  if coalesce(_author_secret, '') = '' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  delete from track_comments tc
   where tc.id = _comment_id
     and tc.author_secret_hash is not null
     and tc.author_secret_hash = encode(sha256(_author_secret::bytea), 'hex')
     and exists (
       select 1 from shared_links sl
       where sl.link_slug = _shared_link_token
         and sl.status = 'active'::link_status
         and (sl.expires_at is null or sl.expires_at > now())
         and tc.shared_link_id = sl.id
     );

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  return true;
end
$$;


--
-- Name: delete_track_document(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_document(_user_id uuid, _doc_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: delete_track_document_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_document_legacy_v0(_user_id uuid, _doc_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT t.workspace_id INTO _workspace_id 
  FROM track_documents d JOIN tracks t ON t.id = d.track_id 
  WHERE d.id = _doc_id;
  
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  DELETE FROM track_documents WHERE id = _doc_id;
END;
$$;


--
-- Name: delete_track_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_legacy_v0(_user_id uuid, _track_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM tracks WHERE id = _track_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level IN ('admin', 'editor')
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete tracks';
  END IF;

  DELETE FROM tracks WHERE id = _track_id;
END;
$$;


--
-- Name: delete_track_version(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_version(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE _count integer;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  IF NOT EXISTS (SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id)
  THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT COUNT(*) INTO _count FROM track_versions WHERE track_id = _track_id;
  IF _count <= 1 THEN RAISE EXCEPTION 'cannot_delete_last_version'; END IF;
  IF EXISTS (SELECT 1 FROM track_versions WHERE id = _version_id AND is_active = true)
  THEN RAISE EXCEPTION 'cannot_delete_active_version'; END IF;
  DELETE FROM track_versions WHERE id = _version_id AND track_id = _track_id;
  UPDATE tracks SET version_count = _count - 1 WHERE id = _track_id;
END;
$$;


--
-- Name: delete_track_video(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE tracks SET video_url = NULL, video_filename = NULL WHERE id = _track_id AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: delete_workspace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_workspace(_user_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = _workspace_id AND owner_id = _user_id)
  THEN RAISE EXCEPTION 'Not the owner of this workspace'; END IF;
  IF EXISTS (SELECT 1 FROM workspaces WHERE id = _workspace_id AND is_personal = true)
  THEN RAISE EXCEPTION 'Cannot delete personal workspace'; END IF;
  DELETE FROM workspace_members WHERE workspace_id = _workspace_id;
  DELETE FROM user_roles WHERE workspace_id = _workspace_id;
  DELETE FROM workspaces WHERE id = _workspace_id;
END;
$$;


--
-- Name: edit_track_comment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_track_comment(_comment_id uuid, _user_id uuid, _new_content text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE track_comments tc
  SET content = _new_content, updated_at = now(), is_edited = true
  WHERE tc.id = _comment_id
    AND EXISTS (
      SELECT 1 FROM tracks t
      WHERE t.id = tc.track_id
        AND public.has_workspace_access_level(_user_id, t.workspace_id, 'editor')
    );
END;
$$;


--
-- Name: enforce_pitch_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_pitch_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_max int; v_used int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.sent_by IS NULL THEN RETURN NEW; END IF;

  PERFORM public.reset_monthly_usage_if_due(NEW.sent_by);

  SELECT pl.pitches_per_month, s.pitches_sent_this_month
    INTO v_max, v_used
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.sent_by;

  IF v_max IS NOT NULL AND v_max <> -1 AND coalesce(v_used,0) >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: pitches (%/% this month).', v_used, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_seat_limit_invitation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_seat_limit_invitation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.access_level = 'viewer' THEN RETURN NEW; END IF;

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'can_invite_active')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/% used, % pending).',
      v->>'seats_used', v->>'seats_included', v->>'seats_pending'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_seat_limit_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_seat_limit_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v jsonb;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.access_level = 'viewer' THEN RETURN NEW; END IF;               -- viewers illimités
  IF TG_OP = 'UPDATE' AND OLD.access_level <> 'viewer' THEN RETURN NEW; END IF; -- déjà un siège

  v := public.get_workspace_seats(NEW.workspace_id);
  IF (v->>'seats_used')::int >= (v->>'seats_included')::int THEN
    RAISE EXCEPTION 'plan_limit_reached: seats (%/%).',
      v->>'seats_used', v->>'seats_included' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_track_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_track_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_max int; v_used int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.uploaded_by IS NULL THEN RETURN NEW; END IF;

  SELECT pl.tracks_max, s.tracks_uploaded_count
    INTO v_max, v_used
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.uploaded_by;

  IF v_max IS NOT NULL AND v_max <> -1 AND coalesce(v_used,0) >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: tracks (%/%).', v_used, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_workspace_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_workspace_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;

  SELECT pl.workspaces_max INTO v_max
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.owner_id;

  IF v_max IS NULL OR v_max = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.workspaces WHERE owner_id = NEW.owner_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: workspaces (%/%).', v_count, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enqueue_job(text, jsonb, uuid, uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_job(_job_type text, _payload jsonb DEFAULT '{}'::jsonb, _workspace_id uuid DEFAULT NULL::uuid, _created_by uuid DEFAULT NULL::uuid, _dedupe_key text DEFAULT NULL::text, _priority integer DEFAULT 100, _max_attempts integer DEFAULT 3) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id  uuid;
  v_key text := nullif(left(coalesce(_dedupe_key, ''), 200), '');
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(_job_type, '') = '' then
    raise exception 'job_type is required' using errcode = 'check_violation';
  end if;

  -- Un job identique deja EN COURS : on renvoie celui-la, inutile de doubler le travail.
  if v_key is not null then
    select id into v_id
    from jobs
    where dedupe_key = v_key
      and status in ('pending','processing')
    limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into jobs (job_type, payload, workspace_id, created_by,
                    dedupe_key, priority, max_attempts)
  values (left(_job_type, 60), coalesce(_payload, '{}'::jsonb), _workspace_id, _created_by,
          v_key,
          greatest(1, least(1000, coalesce(_priority, 100))),
          greatest(1, least(10,   coalesce(_max_attempts, 3))))
  on conflict (dedupe_key) where (dedupe_key is not null and status in ('pending','processing'))
    do nothing
  returning id into v_id;

  -- Course entre deux appels simultanes : on recupere le gagnant.
  if v_id is null and v_key is not null then
    select id into v_id
    from jobs
    where dedupe_key = v_key
      and status in ('pending','processing')
    limit 1;
  end if;

  return v_id;
end
$$;


--
-- Name: fail_job(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_job(_job_id uuid, _error text, _retry boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_job jobs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  select * into v_job from jobs where id = _job_id;
  if v_job.id is null then
    return;
  end if;

  if _retry and v_job.attempts < v_job.max_attempts then
    update jobs
       set status    = 'pending',
           error     = left(coalesce(_error, ''), 2000),
           locked_by = null,
           locked_at = null,
           -- backoff : 1 min, 4 min, 9 min...
           run_after = now() + (power(v_job.attempts, 2) * interval '1 minute')
     where id = _job_id;
  else
    update jobs
       set status = 'failed',
           error  = left(coalesce(_error, ''), 2000),
           finished_at = now(), locked_by = null, locked_at = null
     where id = _job_id;
  end if;
end
$$;


--
-- Name: get_admin_overview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_overview(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE _result json;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id)
  THEN RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT json_build_object(
    'waitlist', json_build_object(
      'total', (SELECT COUNT(*) FROM public.waitlist),
      'last_7d', (SELECT COUNT(*) FROM public.waitlist WHERE created_at > now() - interval '7 days'),
      'last_24h', (SELECT COUNT(*) FROM public.waitlist WHERE created_at > now() - interval '24 hours'),
      'invited', (SELECT COUNT(*) FROM public.waitlist WHERE invited_at IS NOT NULL),
      'pending', (SELECT COUNT(*) FROM public.waitlist WHERE invited_at IS NULL)
    ),
    'users', json_build_object('total', (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL)),
    'workspaces', json_build_object('total', (SELECT COUNT(*) FROM public.workspaces)),
    'tracks', json_build_object('total', (SELECT COUNT(*) FROM public.tracks)),
    'contacts', json_build_object('total', (SELECT COUNT(*) FROM public.contacts)),
    'plays', json_build_object(
      'total', (SELECT COUNT(*) FROM public.link_events WHERE event_type = 'play'),
      'last_7d', (SELECT COUNT(*) FROM public.link_events WHERE event_type = 'play' AND created_at > now() - interval '7 days')
    )
  ) INTO _result;
  RETURN _result;
END;
$$;


--
-- Name: get_artist_aliases(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_artist_aliases(_workspace_id uuid) RETURNS TABLE(id uuid, workspace_id uuid, alias_name text, contact_ids uuid[], created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT aa.id, aa.workspace_id, aa.alias_name, aa.contact_ids, aa.created_by, aa.created_at, aa.updated_at
  FROM artist_aliases aa WHERE aa.workspace_id = _workspace_id;
END;
$$;


--
-- Name: get_contacts_engagement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_contacts_engagement(_workspace_id uuid) RETURNS TABLE(contact_id uuid, email text, tracks_engaged bigint, total_plays bigint, total_downloads bigint, last_interaction timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  WITH ws_tracks AS (
    SELECT id FROM public.tracks WHERE workspace_id = _workspace_id
  ),
  ws_links AS (
    SELECT id FROM public.shared_links WHERE workspace_id = _workspace_id
  ),
  ev AS (
    SELECT lower(visitor_email) AS email, track_id, event_type, created_at
    FROM public.link_events
    WHERE track_id IN (SELECT id FROM ws_tracks)
      AND COALESCE(visitor_email, '') <> ''
  ),
  dl AS (
    SELECT lower(downloader_email) AS email, downloaded_at
    FROM public.link_downloads
    WHERE link_id IN (SELECT id FROM ws_links)
      AND COALESCE(downloader_email, '') <> ''
  )
  SELECT
    c.id AS contact_id,
    c.email,
    (SELECT COUNT(DISTINCT e.track_id) FROM ev e WHERE e.email = lower(c.email)) AS tracks_engaged,
    (SELECT COUNT(*) FROM ev e WHERE e.email = lower(c.email) AND e.event_type = 'play') AS total_plays,
    (SELECT COUNT(*) FROM dl d WHERE d.email = lower(c.email)) AS total_downloads,
    GREATEST(
      (SELECT MAX(created_at) FROM ev e WHERE e.email = lower(c.email)),
      (SELECT MAX(downloaded_at) FROM dl d WHERE d.email = lower(c.email))
    ) AS last_interaction
  FROM public.contacts c
  WHERE c.workspace_id = _workspace_id;
$$;


--
-- Name: get_my_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_subscription() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT json_build_object(
    'id', id,
    'plan', plan,
    'billing_cycle', billing_cycle,
    'subscription_status', subscription_status,
    'current_period_start', current_period_start,
    'current_period_end', current_period_end,
    'cancel_at_period_end', cancel_at_period_end,
    'ai_credits_purchased', ai_credits_purchased,
    'ai_credits_monthly_used', ai_credits_monthly_used,
    'ai_credits_reset_at', ai_credits_reset_at,
    'tracks_uploaded_count', tracks_uploaded_count,
    'storage_bytes_used', storage_bytes_used,
    'pitches_sent_this_month', pitches_sent_this_month,
    'smart_ar_queries_this_month', smart_ar_queries_this_month,
    'beta_pass_id', beta_pass_id
  )
  INTO v_result
  FROM public.subscriptions
  WHERE user_id = v_user_id;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_playlist_meta_for_shared_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_playlist_meta_for_shared_link(_slug text) RETURNS TABLE(name text, description text, cover_url text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.name, p.description, p.cover_url
  FROM public.shared_links sl
  JOIN public.playlists p ON p.id = sl.playlist_id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$$;


--
-- Name: get_playlist_tracks_for_shared_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_playlist_tracks_for_shared_link(_slug text) RETURNS TABLE(id uuid, title text, artist text, featuring text, bpm smallint, key text, genre text[], mood text[], cover_url text, duration_sec integer, audio_url text, waveform_data jsonb, lyrics text, lyrics_segments jsonb, "position" integer, chapters jsonb, video_url text, video_visible_on_share boolean, credits jsonb, splits jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_shared_link_access_by_slug(_slug);
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.lyrics, t.lyrics_segments,
    pt.position::integer,
    t.chapters,
    t.video_url, t.video_visible_on_share,
    t.credits,
    -- sanitized splits: strip everything except name / stage_name / role / roles
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'name',       s->>'name',
        'stage_name', s->>'stage_name',
        'role',       s->>'role',
        'roles',      s->'roles'
      )))
      FROM jsonb_array_elements(t.splits) s
    ) ELSE NULL END AS splits
  FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  JOIN public.shared_links sl ON sl.playlist_id = pt.playlist_id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now())
  ORDER BY pt.position ASC;
END;
$$;


--
-- Name: get_shared_link_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_link_by_id(_link_id uuid) RETURNS TABLE(id uuid, workspace_id uuid, track_id uuid, playlist_id uuid, share_type text, status text, message text, allow_download boolean, allow_save boolean, download_quality text, expires_at timestamp with time zone, watermarking_enabled boolean, gate_screen_enabled boolean, has_password boolean, link_name text, link_slug text, link_type text, pack_items jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT sl.id, sl.workspace_id, sl.track_id, sl.playlist_id,
    sl.share_type::text, sl.status::text, sl.message, sl.allow_download,
    sl.allow_save, sl.download_quality,
    sl.expires_at, sl.watermarking_enabled, sl.gate_screen_enabled,
    (sl.password_hash IS NOT NULL) AS has_password,
    sl.link_name, sl.link_slug, sl.link_type::text,
    sl.pack_items, sl.created_at
  FROM public.shared_links sl
  WHERE sl.id = _link_id AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$$;


--
-- Name: get_shared_link_by_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_link_by_slug(_slug text) RETURNS TABLE(id uuid, workspace_id uuid, track_id uuid, playlist_id uuid, share_type text, status text, message text, allow_download boolean, allow_save boolean, download_quality text, expires_at timestamp with time zone, watermarking_enabled boolean, gate_screen_enabled boolean, has_password boolean, link_name text, link_slug text, link_type text, pack_items jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT sl.id, sl.workspace_id, sl.track_id, sl.playlist_id,
    sl.share_type::text, sl.status::text, sl.message, sl.allow_download,
    sl.allow_save, sl.download_quality,
    sl.expires_at, sl.watermarking_enabled, sl.gate_screen_enabled,
    (sl.password_hash IS NOT NULL) AS has_password,
    sl.link_name, sl.link_slug, sl.link_type::text,
    sl.pack_items, sl.created_at
  FROM public.shared_links sl
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$$;


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    uploaded_by uuid,
    title text NOT NULL,
    artist text NOT NULL,
    featuring text,
    track_type public.track_type DEFAULT 'song'::public.track_type NOT NULL,
    status public.track_status DEFAULT 'available'::public.track_status NOT NULL,
    bpm smallint,
    key text,
    duration_sec integer,
    genre text[],
    mood text[] DEFAULT '{}'::text[],
    language text DEFAULT 'Instrumental'::text,
    gender public.track_gender,
    labels text[] DEFAULT '{}'::text[],
    publishers text[] DEFAULT '{}'::text[],
    audio_url text,
    cover_url text,
    waveform_data jsonb,
    lyrics text,
    notes text,
    splits jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    isrc text,
    iswc text,
    audio_preview_url text,
    lyrics_segments jsonb,
    qr_token text,
    chapters jsonb,
    sonic_dna jsonb,
    credits jsonb DEFAULT '{}'::jsonb,
    album text,
    upc text,
    copyright text,
    explicit boolean DEFAULT false,
    tags jsonb DEFAULT '{}'::jsonb,
    file_size_bytes bigint DEFAULT 0,
    video_url text,
    video_filename text,
    video_visible_on_share boolean DEFAULT false,
    has_versions boolean DEFAULT false,
    version_count integer DEFAULT 1,
    production_stage text DEFAULT 'work_in_progress'::text,
    is_marketplace_public boolean DEFAULT false NOT NULL,
    marketplace_published_at timestamp with time zone,
    CONSTRAINT tracks_bpm_check CHECK (((bpm > 0) AND (bpm < 999))),
    CONSTRAINT tracks_duration_sec_check CHECK ((duration_sec > 0)),
    CONSTRAINT tracks_production_stage_check CHECK ((production_stage = ANY (ARRAY['work_in_progress'::text, 'finished'::text])))
);


--
-- Name: get_shared_playlist_tracks(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid) RETURNS SETOF public.tracks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _target_workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_shares cs
    WHERE cs.playlist_id = _playlist_id AND cs.target_workspace_id = _target_workspace_id AND cs.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Playlist % is not shared with workspace %', _playlist_id, _target_workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT t.* FROM public.tracks t
  JOIN public.playlist_tracks pt ON pt.track_id = t.id
  WHERE pt.playlist_id = _playlist_id
  ORDER BY pt.position ASC;
END;
$$;


--
-- Name: get_shared_workspace_playlists(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_workspace_playlists(_workspace_id uuid) RETURNS TABLE(share_id uuid, playlist_id uuid, playlist_name text, source_workspace_id uuid, source_workspace_name text, target_workspace_id uuid, target_workspace_name text, access_level text, status text, created_at timestamp with time zone, direction text, track_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.playlist_id, p.name,
         cs.source_workspace_id, sw.name,
         cs.target_workspace_id, tw.name,
         cs.access_level, cs.status, cs.created_at,
         CASE WHEN cs.source_workspace_id = _workspace_id THEN 'outgoing' ELSE 'incoming' END,
         (SELECT count(*)::integer FROM public.playlist_tracks pt WHERE pt.playlist_id = cs.playlist_id)
  FROM public.catalog_shares cs
  JOIN public.playlists p ON p.id = cs.playlist_id
  LEFT JOIN public.workspaces sw ON sw.id = cs.source_workspace_id
  LEFT JOIN public.workspaces tw ON tw.id = cs.target_workspace_id
  WHERE cs.playlist_id IS NOT NULL
    AND cs.status = 'active'
    AND (cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id);
END;
$$;


--
-- Name: get_shared_workspace_tracks(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid) RETURNS SETOF public.tracks
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- L'appelant doit être membre du workspace cible (celui qui reçoit les tracks)
  IF NOT public.is_workspace_member(auth.uid(), _target_workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Vérifier qu'un catalog_share actif existe entre les deux workspaces
  IF NOT EXISTS (
    SELECT 1 FROM catalog_shares
    WHERE source_workspace_id = _source_workspace_id
      AND target_workspace_id = _target_workspace_id
      AND status = 'active'
      AND track_id IS NULL
  ) THEN
    RAISE EXCEPTION 'no_active_catalog_share' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT * FROM tracks WHERE workspace_id = _source_workspace_id;
END;
$$;


--
-- Name: get_signature_agreement_by_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_signature_agreement_by_token(_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _req public.signature_requests%ROWTYPE;
  _splits jsonb;
BEGIN
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _req
  FROM public.signature_requests
  WHERE token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(row_obj ORDER BY share DESC) INTO _splits
  FROM (
    SELECT
      s.split_share AS share,
      jsonb_build_object(
        'collaborator_name', s.collaborator_name,
        'role', s.role,
        'split_share', s.split_share,
        'pro',       CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.pro ELSE '' END,
        'ipi',       CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.ipi ELSE '' END,
        'publisher', CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.publisher ELSE '' END,
        'collaborator_email', CASE WHEN s.collaborator_email = _req.collaborator_email THEN s.collaborator_email ELSE '' END
      ) AS row_obj
    FROM public.signature_requests s
    WHERE s.track_id = _req.track_id
  ) sub;

  RETURN jsonb_build_object(
    'request', jsonb_build_object(
      'id', _req.id,
      'track_id', _req.track_id,
      'collaborator_name', _req.collaborator_name,
      'collaborator_email', _req.collaborator_email,
      'role', _req.role,
      'split_share', _req.split_share,
      'pro', _req.pro,
      'ipi', _req.ipi,
      'publisher', _req.publisher,
      'status', _req.status,
      'signature_data', _req.signature_data,
      'signed_at', _req.signed_at
    ),
    'splits', COALESCE(_splits, '[]'::jsonb)
  );
END;
$$;


--
-- Name: get_track_by_qr_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_track_by_qr_token(_qr_token text) RETURNS TABLE(id uuid, title text, artist text, cover_url text, workspace_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.id, t.title, t.artist, t.cover_url, t.workspace_id
  FROM public.tracks t
  WHERE _qr_token IS NOT NULL
    AND _qr_token <> ''
    AND t.qr_token = _qr_token
  LIMIT 1;
$$;


--
-- Name: track_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    shared_link_id uuid,
    author_name text NOT NULL,
    author_email text,
    author_type text DEFAULT 'guest_recipient'::text NOT NULL,
    timestamp_sec numeric DEFAULT 0 NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    is_edited boolean DEFAULT false NOT NULL,
    workspace_id uuid,
    author_secret_hash text,
    CONSTRAINT track_comments_author_type_check CHECK ((author_type = ANY (ARRAY['owner'::text, 'team_member'::text, 'recipient'::text, 'guest_recipient'::text])))
);


--
-- Name: get_track_comments(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_track_comments(_track_id uuid, _workspace_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.track_comments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row track_comments%rowtype;
begin
  if auth.role() <> 'service_role' then
    if v_uid is null
       or _workspace_id is null
       or not public.is_workspace_member(v_uid, _workspace_id) then
      return;
    end if;
  end if;

  for v_row in
    select tc.* from track_comments tc
    where tc.track_id = _track_id
      and (
        (tc.shared_link_id is null and (_workspace_id is null or tc.workspace_id = _workspace_id))
        or (tc.shared_link_id is not null and (
              _workspace_id is null
              or exists (select 1 from shared_links sl
                         where sl.id = tc.shared_link_id
                           and sl.workspace_id = _workspace_id)))
      )
    order by tc.created_at desc
  loop
    v_row.author_secret_hash := null;
    return next v_row;
  end loop;
end
$$;


--
-- Name: get_track_for_shared_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_track_for_shared_link(_slug text) RETURNS TABLE(id uuid, title text, artist text, featuring text, bpm smallint, key text, genre text[], mood text[], cover_url text, duration_sec integer, audio_url text, waveform_data jsonb, sonic_dna jsonb, credits jsonb, lyrics text, lyrics_segments jsonb, splits jsonb, isrc text, album text, labels text[], publishers text[], language text, gender text, released_at timestamp with time zone, copyright text, explicit boolean, chapters jsonb, video_url text, video_visible_on_share boolean, total_shares numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
BEGIN
  PERFORM public.assert_shared_link_access_by_slug(_slug);
  RETURN QUERY
  SELECT t.id, t.title, t.artist, t.featuring,
    t.bpm, t.key, t.genre, t.mood,
    t.cover_url, t.duration_sec, t.audio_url,
    t.waveform_data, t.sonic_dna, t.credits,
    t.lyrics, t.lyrics_segments,
    -- SANITIZED splits: names/roles only, no share %, IPI, PRO, email, publisher
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'name',       s->>'name',
        'stage_name', s->>'stage_name',
        'role',       s->>'role',
        'roles',      s->'roles'
      )))
      FROM jsonb_array_elements(t.splits) s
    ) ELSE NULL END AS splits,
    t.isrc, t.album, t.labels, t.publishers,
    t.language, t.gender::text,
    t.released_at, t.copyright, t.explicit,
    t.chapters,
    t.video_url, t.video_visible_on_share,
    -- pre-computed total (single aggregate, not the per-person breakdown)
    CASE WHEN jsonb_typeof(t.splits) = 'array' THEN (
      SELECT COALESCE(sum((s->>'share')::numeric), 0)
      FROM jsonb_array_elements(t.splits) s
      WHERE (s->>'share') ~ '^[0-9]+(\.[0-9]+)?$'
    ) ELSE 0 END AS total_shares
  FROM public.tracks t
  JOIN public.shared_links sl ON sl.track_id = t.id
  WHERE sl.link_slug = _slug AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$_$;


--
-- Name: get_track_rating_stats(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_track_rating_stats(_track_id uuid, _workspace_id uuid, _user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _avg numeric;
  _count integer;
  _my_rating integer;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO _avg, _count
  FROM track_ratings
  WHERE track_id = _track_id AND workspace_id = _workspace_id;

  SELECT rating INTO _my_rating
  FROM track_ratings
  WHERE track_id = _track_id AND workspace_id = _workspace_id AND user_id = _user_id;

  RETURN json_build_object(
    'average', COALESCE(_avg, 0),
    'count', COALESCE(_count, 0),
    'my_rating', _my_rating
  );
END;
$$;


--
-- Name: get_tracks_for_shared_link(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tracks_for_shared_link(_link_id uuid) RETURNS SETOF public.tracks
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_status text; v_expires timestamptz; v_playlist uuid; v_track uuid;
BEGIN
  PERFORM public.assert_shared_link_access(_link_id);
  SELECT sl.status::text, sl.expires_at, sl.playlist_id, sl.track_id
    INTO v_status, v_expires, v_playlist, v_track
  FROM public.shared_links sl
  WHERE sl.id = _link_id;

  IF v_status IS NULL OR v_status <> 'active' THEN RETURN; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RETURN; END IF;

  IF v_playlist IS NOT NULL THEN
    RETURN QUERY
      SELECT (jsonb_populate_record(
                t, jsonb_build_object('splits', public.sanitize_splits(t.splits))
              )).*
      FROM public.playlist_tracks pt
      JOIN public.tracks t ON t.id = pt.track_id
      WHERE pt.playlist_id = v_playlist
      ORDER BY pt.position;
  ELSIF v_track IS NOT NULL THEN
    RETURN QUERY
      SELECT (jsonb_populate_record(
                t, jsonb_build_object('splits', public.sanitize_splits(t.splits))
              )).*
      FROM public.tracks t
      WHERE t.id = v_track;
  END IF;
END;
$$;


--
-- Name: get_user_workspaces(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workspaces(_user_id uuid) RETURNS TABLE(id uuid, name text, is_personal boolean, owner_id uuid, slug text, plan text, created_at timestamp with time zone, settings jsonb, hero_image_url text, hero_position integer, hero_focal_point text, logo_url text, logo_size integer, brand_color text, social_instagram text, social_tiktok text, social_youtube text, social_facebook text, social_x text, social_website text, social_spotify text, social_apple text, bio text, epk_url text, owner_name text, my_access_level text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  RETURN QUERY
  SELECT w.id, w.name, w.is_personal, w.owner_id,
         w.slug, w.plan, w.created_at, w.settings,
         w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.logo_size, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website,
         w.social_spotify, w.social_apple, w.bio, w.epk_url,
         COALESCE(NULLIF(TRIM(p.full_name), ''), p.email)::text AS owner_name,
         CASE WHEN w.owner_id = _user_id THEN 'admin'
              ELSE COALESCE(wm.access_level, 'viewer') END::text AS my_access_level
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  LEFT JOIN profiles p ON p.id = w.owner_id;
END;
$$;


--
-- Name: get_visit_stats(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_visit_stats(_user_id uuid, _days integer DEFAULT 30) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  _result json;
  _d integer;
  _since timestamptz;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  _d := least(greatest(coalesce(_days, 30), 1), 365);
  _since := now() - (_d || ' days')::interval;

  SELECT json_build_object(
    'period_days', _d,
    'totals', json_build_object(
      'visits_all_time',    (SELECT count(*) FROM public.site_visits),
      'visitors_all_time',  (SELECT count(DISTINCT visitor_id) FROM public.site_visits WHERE visitor_id IS NOT NULL),
      'visits_period',      (SELECT count(*) FROM public.site_visits WHERE created_at > _since),
      'visitors_period',    (SELECT count(DISTINCT visitor_id) FROM public.site_visits WHERE created_at > _since AND visitor_id IS NOT NULL),
      'visits_7d',          (SELECT count(*) FROM public.site_visits WHERE created_at > now() - interval '7 days'),
      'visits_24h',         (SELECT count(*) FROM public.site_visits WHERE created_at > now() - interval '24 hours')
    ),
    'by_source', coalesce((
      SELECT json_agg(x) FROM (
        SELECT source,
               count(*)::int AS visits,
               count(DISTINCT visitor_id)::int AS visitors
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY source
        ORDER BY count(*) DESC
        LIMIT 25
      ) x
    ), '[]'::json),
    'by_day', coalesce((
      SELECT json_agg(x ORDER BY x.day) FROM (
        SELECT (date_trunc('day', created_at))::date AS day,
               count(*)::int AS visits,
               count(DISTINCT visitor_id)::int AS visitors
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY 1
      ) x
    ), '[]'::json),
    'top_pages', coalesce((
      SELECT json_agg(x) FROM (
        SELECT path, count(*)::int AS visits
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY path
        ORDER BY count(*) DESC
        LIMIT 15
      ) x
    ), '[]'::json),
    'top_campaigns', coalesce((
      SELECT json_agg(x) FROM (
        SELECT utm_campaign AS campaign, utm_source AS source, count(*)::int AS visits
        FROM public.site_visits
        WHERE created_at > _since AND utm_campaign IS NOT NULL
        GROUP BY 1, 2
        ORDER BY count(*) DESC
        LIMIT 15
      ) x
    ), '[]'::json)
  ) INTO _result;

  RETURN _result;
END;
$$;


--
-- Name: get_waitlist_signups_30d(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_waitlist_signups_30d(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _result json;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO _result
  FROM (
    SELECT d.date::date AS date, COALESCE(COUNT(w.id), 0) AS signups
    FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d(date)
    LEFT JOIN public.waitlist w ON date_trunc('day', w.created_at)::date = d.date::date
    GROUP BY d.date ORDER BY d.date
  ) t;
  RETURN _result;
END;
$$;


--
-- Name: get_workspace_branding_for_shared_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_branding_for_shared_link(_slug text) RETURNS TABLE(name text, slug text, hero_image_url text, hero_position integer, hero_focal_point text, logo_url text, logo_size integer, brand_color text, social_instagram text, social_tiktok text, social_youtube text, social_facebook text, social_x text, social_website text, bio text, social_spotify text, social_apple text, epk_url text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT w.name, w.slug, w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.logo_size, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website, w.bio,
         w.social_spotify, w.social_apple, w.epk_url
  FROM workspaces w
  JOIN shared_links sl ON sl.workspace_id = w.id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$$;


--
-- Name: get_workspace_catalog_shares(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid) RETURNS TABLE(id uuid, track_id uuid, source_workspace_id uuid, target_workspace_id uuid, access_level text, status text, created_at timestamp with time zone, source_workspace_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.track_id, cs.source_workspace_id, cs.target_workspace_id,
         cs.access_level, cs.status, cs.created_at, sw.name
  FROM public.catalog_shares cs
  LEFT JOIN public.workspaces sw ON sw.id = cs.source_workspace_id
  WHERE cs.playlist_id IS NULL
    AND (cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id);
END;
$$;


--
-- Name: get_workspace_epk_by_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_epk_by_slug(_workspace_slug text) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT w.epk_url
  FROM public.workspaces w
  WHERE w.slug = _workspace_slug
    AND w.epk_url IS NOT NULL
  LIMIT 1;
$$;


--
-- Name: get_workspace_seats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_seats(_workspace_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid; v_plan text; v_included int; v_purchased int;
  v_total int; v_used int; v_viewers int; v_pending int;
  v_uid uuid := auth.uid();
begin
  -- Membre du workspace, ou appel serveur.
  if auth.role() is distinct from 'service_role' then
    if v_uid is null or _workspace_id is null
       or not public.is_workspace_member(v_uid, _workspace_id) then
      return jsonb_build_object('error','not_authorized');
    end if;
  end if;

  select owner_id into v_owner from public.workspaces where id = _workspace_id;
  if v_owner is null then return jsonb_build_object('error','workspace_not_found'); end if;

  select s.plan, pl.seats_included, s.purchased_seats
    into v_plan, v_included, v_purchased
  from public.subscriptions s
  join public.plan_limits pl on pl.plan = s.plan
  where s.user_id = v_owner;

  v_plan      := coalesce(v_plan,'free');
  v_included  := coalesce(v_included,1);
  v_purchased := coalesce(v_purchased,0);
  v_total     := v_included + v_purchased;

  select count(*) filter (where access_level <> 'viewer'),
         count(*) filter (where access_level = 'viewer')
    into v_used, v_viewers
  from public.workspace_members where workspace_id = _workspace_id;

  select count(*) into v_pending
  from public.invitations
  where workspace_id = _workspace_id and status='pending'
    and access_level <> 'viewer' and expires_at > now();

  return jsonb_build_object(
    'plan', v_plan,
    'seats_included', v_total,
    'seats_from_plan', v_included,
    'seats_purchased', v_purchased,
    'seats_used', coalesce(v_used,0),
    'seats_pending', coalesce(v_pending,0),
    'seats_available', greatest(v_total - coalesce(v_used,0) - coalesce(v_pending,0), 0),
    'viewers', coalesce(v_viewers,0),
    'can_invite_active', (coalesce(v_used,0) + coalesce(v_pending,0)) < v_total
  );
end
$$;


--
-- Name: get_workspace_tracks(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid) RETURNS SETOF public.tracks
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_level text; v_is_owner boolean; v_full boolean;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT (w.owner_id = _user_id) INTO v_is_owner
  FROM public.workspaces w WHERE w.id = _workspace_id;

  SELECT m.access_level INTO v_level
  FROM public.workspace_members m
  WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id;

  v_full := coalesce(v_is_owner, false) OR coalesce(v_level,'viewer') IN ('admin','editor');

  IF v_full THEN
    RETURN QUERY
      SELECT * FROM public.tracks
      WHERE workspace_id = _workspace_id
      ORDER BY created_at DESC;
  ELSE
    RETURN QUERY
      SELECT (jsonb_populate_record(
                t,
                jsonb_build_object('splits', public.sanitize_splits(t.splits))
              )).*
      FROM public.tracks t
      WHERE t.workspace_id = _workspace_id
      ORDER BY t.created_at DESC;
  END IF;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  workspace_id uuid;
  user_name    text;
  base_slug    text;
  final_slug   text;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

  base_slug := lower(public.unaccent_safe(user_name || '''s Workspace'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  base_slug := left(nullif(base_slug, ''), 40);
  base_slug := COALESCE(base_slug, 'workspace');

  FOR i IN 1..5 LOOP
    final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = final_slug);
  END LOOP;

  INSERT INTO public.workspaces (name, slug, owner_id, is_personal)
  VALUES (user_name || '''s Workspace', final_slug, NEW.id, true)
  RETURNING id INTO workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, access_level)
  VALUES (workspace_id, NEW.id, 'admin');

  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_active_pass record;
BEGIN
  -- Check if user has an active beta pass for their email
  SELECT * INTO v_active_pass
  FROM public.beta_passes
  WHERE email = NEW.email 
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_active_pass IS NOT NULL THEN
    -- Create subscription with the granted plan
    INSERT INTO public.subscriptions (
      user_id, plan, subscription_status, beta_pass_id, current_period_end
    )
    VALUES (
      NEW.id,
      v_active_pass.plan_granted,
      'active',
      v_active_pass.id,
      v_active_pass.expires_at
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Mark pass as redeemed
    UPDATE public.beta_passes
    SET redeemed_by = NEW.id, redeemed_at = now(), status = 'redeemed'
    WHERE id = v_active_pass.id;
  ELSE
    -- Default: create Free subscription
    INSERT INTO public.subscriptions (user_id, plan, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_user_updated(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_user_updated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles SET
    full_name = NEW.raw_user_meta_data->>'full_name',
    email = NEW.email,
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: has_any_workspace_role(uuid, uuid, public.app_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = any(_roles)
  );
$$;


--
-- Name: FUNCTION has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]) IS 'LEGACY (depuis 2026-05-10) — Plus utilisée par aucune RLS policy. Remplacée par has_workspace_access_level. À supprimer en Phase 2.';


--
-- Name: has_workspace_access_level(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _level text;
  _hierarchy int;
  _required int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RETURN true;
  END IF;

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


--
-- Name: has_workspace_role(uuid, uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and workspace_id = _workspace_id
      and role = _role
  );
$$;


--
-- Name: FUNCTION has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role) IS 'LEGACY (depuis 2026-05-10) — Plus utilisée par aucune RLS policy. Remplacée par has_workspace_access_level. À supprimer en Phase 2.';


--
-- Name: increment_smart_ar_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_smart_ar_usage(_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.reset_monthly_usage_if_due(_user_id);

  UPDATE public.subscriptions
  SET smart_ar_queries_this_month = smart_ar_queries_this_month + 1,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING smart_ar_queries_this_month INTO v_count;

  RETURN v_count;
END;
$$;


--
-- Name: insert_approval(uuid, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_approval(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Tout member peut demander une approbation (matrice : flow inclusif)
  IF NOT public.is_workspace_member(_user_id, _workspace_id) THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN public.insert_approval_legacy_v0(_user_id, _workspace_id, _track_id, _send_type, _team_id);
END;
$$;


--
-- Name: insert_approval_legacy_v0(uuid, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_approval_legacy_v0(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  INSERT INTO approvals (workspace_id, submitted_by, track_id, send_type, team_id, status)
  VALUES (_workspace_id, _user_id, _track_id, _send_type, _team_id, 'pending'::approval_status)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;


--
-- Name: insert_catalog_share(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_catalog_share(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Admin sur SOURCE (celui qui partage)
  PERFORM public.require_workspace_access_level(_user_id, _source_workspace_id, 'admin');

  RETURN public.insert_catalog_share_legacy_v0(
    _user_id, _track_id, _source_workspace_id, _target_workspace_id, _access_level
  );
END;
$$;


--
-- Name: insert_catalog_share_legacy_v0(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_catalog_share_legacy_v0(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text DEFAULT 'pitcher'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _source_workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of source workspace';
  END IF;

  INSERT INTO catalog_shares (track_id, source_workspace_id, target_workspace_id, shared_by, access_level, status)
  VALUES (_track_id, _source_workspace_id, _target_workspace_id, _user_id, _access_level, 'active')
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;


--
-- Name: insert_stem(uuid, uuid, text, text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_stem(_user_id uuid, _track_id uuid, _name text, _file_url text, _file_size bigint, _stem_type text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id INTO v_workspace_id
  FROM public.tracks WHERE id = _track_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'pitcher');

  INSERT INTO public.stems
    (workspace_id, track_id, uploaded_by, file_name, stem_type, file_url, file_size_bytes)
  VALUES
    (v_workspace_id, _track_id, _user_id, _name, _stem_type::stem_type, _file_url, _file_size)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: insert_track(uuid, uuid, text, text, text, text, text, numeric, text, numeric, text[], text[], text, text, text[], text[], text, text, text, text, text, jsonb, text, jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_track(_user_id uuid, _workspace_id uuid, _title text, _artist text DEFAULT NULL::text, _featuring text DEFAULT NULL::text, _type text DEFAULT NULL::text, _status text DEFAULT NULL::text, _bpm numeric DEFAULT NULL::numeric, _key text DEFAULT NULL::text, _duration_sec numeric DEFAULT NULL::numeric, _genre text[] DEFAULT NULL::text[], _mood text[] DEFAULT '{}'::text[], _language text DEFAULT NULL::text, _gender text DEFAULT NULL::text, _labels text[] DEFAULT '{}'::text[], _publishers text[] DEFAULT '{}'::text[], _audio_url text DEFAULT NULL::text, _audio_preview_url text DEFAULT NULL::text, _cover_art_url text DEFAULT NULL::text, _lyrics text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _splits jsonb DEFAULT '[]'::jsonb, _isrc text DEFAULT NULL::text, _waveform_data jsonb DEFAULT NULL::jsonb, _released_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE new_track_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  INSERT INTO public.tracks (
    workspace_id, uploaded_by, title, artist, featuring,
    track_type, status, bpm, key, duration_sec,
    genre, mood, language, gender, labels, publishers,
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
    _lyrics, _notes,
    COALESCE(_splits, '[]'::jsonb),
    _isrc, _waveform_data, _released_at
  ) RETURNING id INTO new_track_id;
  RETURN new_track_id;
END;
$$;


--
-- Name: insert_track_comment_via_token(uuid, text, text, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_track_comment_via_token(_track_id uuid, _shared_link_token text, _content text, _author_name text DEFAULT NULL::text, _author_email text DEFAULT NULL::text, _timestamp_sec numeric DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_link    shared_links%rowtype;
  v_row     track_comments%rowtype;
  v_name    text;
  v_email   text;
  v_content text;
  v_ts      numeric;
  v_secret  text;
begin
  v_content := left(btrim(coalesce(_content, '')), 2000);
  if v_content = '' then
    raise exception 'content is required' using errcode = 'check_violation';
  end if;

  v_name := left(btrim(coalesce(_author_name, '')), 200);
  if v_name = '' then v_name := 'Anonymous'; end if;

  v_email := nullif(left(btrim(coalesce(_author_email, '')), 254), '');

  v_ts := case when _timestamp_sec is not null and _timestamp_sec >= 0
               then round(_timestamp_sec, 2) else 0 end;

  select sl.* into v_link
  from shared_links sl
  where sl.link_slug = _shared_link_token
    and sl.status = 'active'::link_status
    and (sl.expires_at is null or sl.expires_at > now())
    and (sl.track_id = _track_id
         or exists (select 1 from playlist_tracks pt
                    where pt.playlist_id = sl.playlist_id
                      and pt.track_id = _track_id))
  limit 1;

  if v_link.id is null then
    raise exception 'Invalid or expired share link for this track'
      using errcode = 'insufficient_privilege';
  end if;

  v_secret := replace(gen_random_uuid()::text, '-', '')
           || replace(gen_random_uuid()::text, '-', '');

  insert into track_comments
    (track_id, shared_link_id, author_name, author_email, author_type,
     timestamp_sec, content, author_secret_hash)
  values
    (_track_id, v_link.id, v_name, v_email, 'recipient', v_ts, v_content,
     encode(sha256(v_secret::bytea), 'hex'))
  returning * into v_row;

  return jsonb_build_object(
    'id',             v_row.id,
    'track_id',       v_row.track_id,
    'shared_link_id', v_row.shared_link_id,
    'author_name',    v_row.author_name,
    'author_type',    v_row.author_type,
    'timestamp_sec',  v_row.timestamp_sec,
    'content',        v_row.content,
    'created_at',     v_row.created_at,
    'updated_at',     v_row.updated_at,
    'is_edited',      v_row.is_edited,
    'is_own',         true,
    'author_secret',  v_secret
  );
end
$$;


--
-- Name: insert_track_document(uuid, uuid, text, text, bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_track_document(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint DEFAULT NULL::bigint, _doc_type text DEFAULT NULL::text, _file_name text DEFAULT NULL::text, _mime_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'editor');

  RETURN public.insert_track_document_legacy_v0(
    _user_id, _track_id, _name, _file_path, _file_size, _doc_type, _file_name, _mime_type
  );
END;
$$;


--
-- Name: insert_track_document_legacy_v0(uuid, uuid, text, text, bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_track_document_legacy_v0(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint DEFAULT NULL::bigint, _doc_type text DEFAULT NULL::text, _file_name text DEFAULT NULL::text, _mime_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _id uuid;
  _workspace_id uuid;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM tracks WHERE id = _track_id;
  
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  INSERT INTO track_documents (track_id, workspace_id, uploaded_by, name, file_name, file_path, file_size, mime_type, status)
  VALUES (_track_id, _workspace_id, _user_id, _name, _file_name, _file_path, _file_size, _mime_type, 'draft'::document_status)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;


--
-- Name: is_email_whitelisted(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_email_whitelisted(_email text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT EXISTS (SELECT 1 FROM whitelisted_emails WHERE email = lower(_email));
$$;


--
-- Name: is_platform_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  _email text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  RETURN _email IS NOT NULL AND lower(_email) IN ('yannick.rastogi@gmail.com');
END;
$$;


--
-- Name: is_workspace_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.workspace_members
    where user_id = _user_id and workspace_id = _workspace_id
  );
$$;


--
-- Name: leave_workspace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_workspace(_user_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'The owner cannot leave their own workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND is_personal = true
  ) THEN
    RAISE EXCEPTION 'Cannot leave a personal workspace';
  END IF;

  DELETE FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id;

  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$$;


--
-- Name: list_all_contacts(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_all_contacts(_user_id uuid, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _result json; _total int;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id)
  THEN RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT COUNT(*) INTO _total FROM public.contacts c
  WHERE _search IS NULL OR _search = ''
     OR lower(coalesce(c.first_name,'')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.last_name,'')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.email,'')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.company,'')) LIKE '%' || lower(_search) || '%';
  SELECT json_build_object('total', _total, 'rows', COALESCE(json_agg(row_to_json(t)),'[]'::json))
  INTO _result
  FROM (
    SELECT c.id, c.first_name, c.last_name, c.stage_name, c.email,
      c.role, c.company, c.phone, c.pro, c.ipi, c.publisher, c.created_at,
      w.name AS workspace_name, w.id AS workspace_id
    FROM public.contacts c LEFT JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE _search IS NULL OR _search = ''
       OR lower(coalesce(c.first_name,'')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.last_name,'')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.email,'')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.company,'')) LIKE '%' || lower(_search) || '%'
    ORDER BY c.created_at DESC LIMIT _limit OFFSET _offset
  ) t;
  RETURN _result;
END;
$$;


--
-- Name: list_all_users(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_all_users(_user_id uuid, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE _result json; _total int;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id)
  THEN RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT COUNT(*) INTO _total FROM auth.users u
  WHERE u.deleted_at IS NULL
    AND (_search IS NULL OR _search = ''
         OR lower(coalesce(u.email,'')) LIKE '%' || lower(_search) || '%'
         OR lower(coalesce(u.raw_user_meta_data->>'full_name','')) LIKE '%' || lower(_search) || '%');
  SELECT json_build_object('total', _total, 'rows', COALESCE(json_agg(row_to_json(t)),'[]'::json))
  INTO _result
  FROM (
    SELECT u.id, u.email,
      u.raw_user_meta_data->>'full_name' AS full_name,
      u.raw_user_meta_data->>'avatar_url' AS avatar_url,
      u.created_at, u.last_sign_in_at,
      u.email_confirmed_at IS NOT NULL AS email_confirmed,
      (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
      EXISTS (SELECT 1 FROM auth.mfa_factors mf WHERE mf.user_id = u.id AND mf.status = 'verified') AS has_2fa,
      (SELECT COUNT(*) FROM public.workspace_members wm WHERE wm.user_id = u.id) AS workspaces_count,
      (SELECT COUNT(*) FROM public.tracks t WHERE t.workspace_id IN
        (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = u.id)) AS tracks_in_workspaces,
      (SELECT COUNT(*) FROM public.pitches p WHERE p.workspace_id IN
        (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = u.id)) AS pitches_in_workspaces
    FROM auth.users u WHERE u.deleted_at IS NULL
      AND (_search IS NULL OR _search = ''
           OR lower(coalesce(u.email,'')) LIKE '%' || lower(_search) || '%'
           OR lower(coalesce(u.raw_user_meta_data->>'full_name','')) LIKE '%' || lower(_search) || '%')
    ORDER BY u.created_at DESC LIMIT _limit OFFSET _offset
  ) t;
  RETURN _result;
END;
$$;


--
-- Name: list_waitlist_signups(uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_waitlist_signups(_user_id uuid, _limit integer DEFAULT 20, _offset integer DEFAULT 0, _search text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE _result json; _total int;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*) INTO _total FROM public.waitlist
  WHERE _search IS NULL OR _search = '' OR lower(email) LIKE '%' || lower(_search) || '%';

  SELECT json_build_object(
    'total', _total,
    'rows', COALESCE(json_agg(row_to_json(t)), '[]'::json)
  ) INTO _result
  FROM (
    SELECT id, email, created_at, invited_at,
      CASE WHEN invited_at IS NOT NULL THEN 'invited' ELSE 'pending' END AS status
    FROM public.waitlist
    WHERE _search IS NULL OR _search = '' OR lower(email) LIKE '%' || lower(_search) || '%'
    ORDER BY created_at DESC LIMIT _limit OFFSET _offset
  ) t;
  RETURN _result;
END;
$$;


--
-- Name: log_audit_event(uuid, text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
  VALUES (_user_id, _action, _resource_type, _resource_id, _metadata);
END;
$$;


--
-- Name: log_site_visit(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_site_visit(_path text DEFAULT '/'::text, _referrer text DEFAULT NULL::text, _utm_source text DEFAULT NULL::text, _utm_medium text DEFAULT NULL::text, _utm_campaign text DEFAULT NULL::text, _visitor_id text DEFAULT NULL::text, _session_id text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _p    text;
  _ref  text;
  _dom  text;
  _us   text;
  _um   text;
  _uc   text;
  _vid  text;
  _sid  text;
  _src  text;
BEGIN
  -- Bornage strict des entrees (endpoint public)
  _p   := left(coalesce(nullif(trim(_path), ''), '/'), 300);
  _ref := left(nullif(trim(coalesce(_referrer, '')), ''), 500);
  _us  := left(nullif(trim(coalesce(_utm_source, '')), ''), 100);
  _um  := left(nullif(trim(coalesce(_utm_medium, '')), ''), 100);
  _uc  := left(nullif(trim(coalesce(_utm_campaign, '')), ''), 100);
  _vid := left(nullif(trim(coalesce(_visitor_id, '')), ''), 64);
  _sid := left(nullif(trim(coalesce(_session_id, '')), ''), 64);

  -- Anti-spam : max 60 evenements par session sur 1h
  IF _sid IS NOT NULL AND (
    SELECT count(*) FROM public.site_visits
    WHERE session_id = _sid AND created_at > now() - interval '1 hour'
  ) >= 60 THEN
    RETURN;
  END IF;

  -- Deduplication : meme session + meme page dans les 30 dernieres minutes
  IF _sid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.site_visits
    WHERE session_id = _sid AND path = _p AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  -- Domaine referent
  _dom := lower(coalesce(substring(_ref from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:?#]+)'), ''));
  _dom := regexp_replace(_dom, '^www\.', '');
  _dom := nullif(_dom, '');

  -- Auto-referencement (navigation interne) => traite comme direct
  IF _dom IS NOT NULL AND (_dom = 'trakalog.com' OR _dom LIKE '%.trakalog.com') THEN
    _dom := NULL;
  END IF;

  -- Source normalisee : UTM prioritaire, sinon referrer, sinon direct
  _src := CASE
    WHEN _us IS NOT NULL THEN lower(_us)
    WHEN _dom IS NULL THEN 'direct'
    WHEN _dom LIKE '%instagram%'                      THEN 'instagram'
    WHEN _dom LIKE '%tiktok%'                         THEN 'tiktok'
    WHEN _dom LIKE '%facebook%' OR _dom LIKE '%fb.%'  THEN 'facebook'
    WHEN _dom LIKE '%linkedin%' OR _dom = 'lnkd.in'   THEN 'linkedin'
    WHEN _dom LIKE '%youtube%'  OR _dom = 'youtu.be'  THEN 'youtube'
    WHEN _dom LIKE '%whatsapp%'                       THEN 'whatsapp'
    WHEN _dom LIKE '%google%'                         THEN 'google'
    WHEN _dom LIKE '%bing%'                           THEN 'bing'
    WHEN _dom LIKE '%duckduckgo%'                     THEN 'duckduckgo'
    WHEN _dom LIKE '%twitter%'  OR _dom = 'x.com' OR _dom = 't.co' THEN 'x'
    WHEN _dom LIKE '%reddit%'                         THEN 'reddit'
    WHEN _dom LIKE '%discord%'                        THEN 'discord'
    WHEN _dom LIKE '%spotify%'                        THEN 'spotify'
    WHEN _dom LIKE '%chatgpt%' OR _dom LIKE '%openai%' OR _dom LIKE '%claude.ai%' OR _dom LIKE '%perplexity%' THEN 'ai_assistant'
    WHEN _dom LIKE '%mail%' OR _dom LIKE '%outlook%'  THEN 'email'
    ELSE _dom
  END;

  INSERT INTO public.site_visits (
    visitor_id, session_id, path, referrer, referrer_domain,
    source, utm_source, utm_medium, utm_campaign
  ) VALUES (
    _vid, _sid, _p, _ref, _dom, _src, _us, _um, _uc
  );
END;
$$;


--
-- Name: mark_onboarding_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_onboarding_complete(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"onboarding_complete": true}'::jsonb
  WHERE id = _user_id;
END;
$$;


--
-- Name: mark_splits_signed_externally(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_splits_signed_externally(_user_id uuid, _track_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_split jsonb;
  v_email text;
  v_role  text;
  v_pro   text;
  v_count integer := 0;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  FOR v_split IN
    SELECT * FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof((SELECT splits FROM public.tracks WHERE id = _track_id)) = 'array'
           THEN (SELECT splits FROM public.tracks WHERE id = _track_id)
           ELSE '[]'::jsonb END)
  LOOP
    v_email := lower(trim(coalesce(v_split->>'email', '')));
    IF v_email = '' THEN CONTINUE; END IF;

    -- never overwrite an existing request (real pending or real signature) for this collaborator
    IF EXISTS (
      SELECT 1 FROM public.signature_requests
      WHERE track_id = _track_id AND lower(trim(coalesce(collaborator_email,''))) = v_email
    ) THEN
      CONTINUE;
    END IF;

    -- role: support roles[] array or singular role
    v_role := CASE WHEN jsonb_typeof(v_split->'roles') = 'array'
                   THEN (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_split->'roles') x)
                   ELSE v_split->>'role' END;
    -- pro: support pros[] array or singular pro
    v_pro := CASE WHEN jsonb_typeof(v_split->'pros') = 'array'
                  THEN (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_split->'pros') x)
                  ELSE v_split->>'pro' END;

    INSERT INTO public.signature_requests (
      track_id, collaborator_name, collaborator_email, role, split_share,
      pro, ipi, publisher, token, status, signature_data, signed_at, signed_externally
    ) VALUES (
      _track_id,
      coalesce(v_split->>'name', ''),
      v_split->>'email',
      v_role,
      coalesce((v_split->>'share')::numeric, 0),
      nullif(v_pro, ''),
      nullif(v_split->>'ipi', ''),
      nullif(v_split->>'publisher', ''),
      replace(gen_random_uuid()::text, '-', ''),
      'signed',
      NULL,
      now(),
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: mark_waitlist_invited(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_waitlist_invited(_user_id uuid, _email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.waitlist
  SET invited_at = now(), invitation_sent_by = _user_id
  WHERE lower(email) = lower(_email);
END;
$$;


--
-- Name: mark_workspace_personal(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_workspace_personal(_user_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not the owner of this workspace';
  END IF;

  UPDATE workspaces SET is_personal = true WHERE id = _workspace_id;
END;
$$;


--
-- Name: playlist_has_active_shared_link(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.playlist_has_active_shared_link(_playlist_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_links sl
    WHERE sl.playlist_id = _playlist_id
      AND sl.status = 'active'
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
  );
$$;


--
-- Name: prevent_client_plan_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_client_plan_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'plan can only be changed by the billing system'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: remove_track_from_trakalog(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_track_from_trakalog(_track_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: remove_track_from_trakalog_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_track_from_trakalog_legacy_v0(_track_id uuid, _user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE catalog_shares 
  SET status = 'revoked'
  WHERE track_id = _track_id 
  AND target_workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = _user_id
  )
  AND status = 'active';
END;
$$;


--
-- Name: remove_workspace_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_workspace_member(_user_id uuid, _member_user_id uuid, _workspace_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  IF EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _member_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the workspace owner';
  END IF;

  DELETE FROM public.workspace_members
  WHERE user_id = _member_user_id AND workspace_id = _workspace_id;

  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$$;


--
-- Name: replace_playlist_tracks(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: replace_playlist_tracks_legacy_v0(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replace_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _ws_id uuid;
  _i int;
BEGIN
  SELECT workspace_id INTO _ws_id FROM playlists WHERE id = _playlist_id;
  IF _ws_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _ws_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _ws_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM playlist_tracks WHERE playlist_id = _playlist_id;

  IF array_length(_track_ids, 1) IS NOT NULL THEN
    FOR _i IN 1..array_length(_track_ids, 1) LOOP
      INSERT INTO playlist_tracks (playlist_id, track_id, position, added_by)
      VALUES (_playlist_id, _track_ids[_i], _i - 1, _user_id);
    END LOOP;
  END IF;
END;
$$;


--
-- Name: request_track_access(uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_track_access(_user_id uuid, _workspace_id uuid, _track_id uuid, _message text DEFAULT NULL::text, _requester_name text DEFAULT NULL::text, _requester_company text DEFAULT NULL::text, _requester_email text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _request_id uuid;
  _owner_workspace_id uuid;
  _owner_user_id uuid;
  _track_title text;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT t.workspace_id, w.owner_id, t.title
  INTO _owner_workspace_id, _owner_user_id, _track_title
  FROM tracks t
  JOIN workspaces w ON w.id = t.workspace_id
  WHERE t.id = _track_id AND t.is_marketplace_public = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'track_not_found';
  END IF;

  INSERT INTO marketplace_requests (
    track_id, requester_user_id, requester_workspace_id,
    owner_workspace_id, message,
    requester_name, requester_company, requester_email
  ) VALUES (
    _track_id, _user_id, _workspace_id,
    _owner_workspace_id, _message,
    _requester_name, _requester_company, _requester_email
  )
  ON CONFLICT (track_id, requester_user_id) DO UPDATE
    SET message = EXCLUDED.message, created_at = now()
  RETURNING id INTO _request_id;

  PERFORM create_notification(
    _user_id, _owner_user_id, _owner_workspace_id,
    'access_requested',
    'New Access Request',
    COALESCE(_requester_name, 'Someone') || ' is interested in "' || _track_title || '"',
    _track_id
  );

  RETURN _request_id;
END;
$$;


--
-- Name: requeue_stale_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.requeue_stale_jobs(_older_than_minutes integer DEFAULT 15) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update jobs
     set status    = case when attempts >= max_attempts then 'failed'::job_status
                          else 'pending'::job_status end,
         error     = coalesce(error, 'worker timeout / lost'),
         locked_by = null,
         locked_at = null,
         run_after = now()
   where status = 'processing'
     and locked_at < now() - make_interval(mins => greatest(1, _older_than_minutes));

  get diagnostics v_n = row_count;
  return v_n;
end
$$;


--
-- Name: require_workspace_access_level(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: reset_monthly_usage_if_due(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_monthly_usage_if_due(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions s
  SET
    pitches_sent_this_month     = 0,
    ai_credits_monthly_used     = 0,
    smart_ar_queries_this_month = CASE WHEN s.plan = 'free'
                                       THEN s.smart_ar_queries_this_month
                                       ELSE 0 END,
    ai_credits_reset_at         = now() + interval '1 month',
    updated_at                  = now()
  WHERE s.user_id = _user_id
    AND (s.ai_credits_reset_at IS NULL OR s.ai_credits_reset_at <= now());
END;
$$;


--
-- Name: revoke_catalog_share(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_catalog_share(_user_id uuid, _share_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: revoke_catalog_share_legacy_v0(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_catalog_share_legacy_v0(_user_id uuid, _share_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _source_workspace_id uuid;
BEGIN
  SELECT source_workspace_id INTO _source_workspace_id FROM catalog_shares WHERE id = _share_id;

  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _source_workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of source workspace';
  END IF;

  UPDATE catalog_shares SET status = 'revoked', revoked_at = now() WHERE id = _share_id;
END;
$$;


--
-- Name: sanitize_splits(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_splits(_splits jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN _splits IS NULL OR jsonb_typeof(_splits) <> 'array' THEN _splits
    ELSE coalesce(
      (SELECT jsonb_agg(
                jsonb_strip_nulls(jsonb_build_object(
                  'id',         elem->'id',
                  'name',       elem->'name',
                  'stage_name', elem->'stage_name',
                  'role',       elem->'role',
                  'locked',     elem->'locked'
                ))
              )
       FROM jsonb_array_elements(_splits) AS elem),
      '[]'::jsonb)
  END;
$$;


--
-- Name: save_track_to_trakalog(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_track_to_trakalog(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Le user doit être membre du target workspace (où il sauve le track)
  IF NOT public.is_workspace_member(_user_id, _target_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of target workspace %', _target_workspace_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN public.save_track_to_trakalog_legacy_v0(_track_id, _source_workspace_id, _target_workspace_id, _user_id);
END;
$$;


--
-- Name: save_track_to_trakalog_legacy_v0(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_track_to_trakalog_legacy_v0(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_share_id uuid;
BEGIN
  -- Check if already saved
  IF EXISTS (
    SELECT 1 FROM catalog_shares 
    WHERE track_id = _track_id 
    AND target_workspace_id = _target_workspace_id
    AND status = 'active'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO catalog_shares (id, track_id, source_workspace_id, target_workspace_id, shared_by, access_level, status)
  VALUES (gen_random_uuid(), _track_id, _source_workspace_id, _target_workspace_id, _user_id, 'viewer', 'active')
  RETURNING id INTO new_share_id;

  RETURN new_share_id;
END;
$$;


--
-- Name: search_marketplace_tracks(text, text[], text[], integer, integer, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_marketplace_tracks(_q text DEFAULT NULL::text, _genre text[] DEFAULT NULL::text[], _mood text[] DEFAULT NULL::text[], _bpm_min integer DEFAULT NULL::integer, _bpm_max integer DEFAULT NULL::integer, _key text DEFAULT NULL::text, _type text DEFAULT NULL::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0) RETURNS TABLE(id uuid, title text, artist text, featuring text, cover_url text, track_type text, genre text[], mood text[], bpm smallint, key text, duration_sec integer, waveform_data jsonb, audio_preview_url text, workspace_name text, workspace_id uuid, production_stage text, marketplace_published_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, t.title, t.artist, t.featuring,
    t.cover_url, t.track_type::text, t.genre, t.mood,
    t.bpm, t.key, t.duration_sec,
    t.waveform_data, t.audio_preview_url,
    w.name AS workspace_name,
    t.workspace_id,
    t.production_stage,
    t.marketplace_published_at
  FROM tracks t
  JOIN workspaces w ON w.id = t.workspace_id
  WHERE t.is_marketplace_public = true
    AND t.status = 'available'
    AND (_q IS NULL OR 
         t.title ILIKE '%' || _q || '%' OR 
         t.artist ILIKE '%' || _q || '%')
    AND (_genre IS NULL OR t.genre && _genre)
    AND (_mood IS NULL OR t.mood && _mood)
    AND (_bpm_min IS NULL OR t.bpm >= _bpm_min)
    AND (_bpm_max IS NULL OR t.bpm <= _bpm_max)
    AND (_key IS NULL OR t.key = _key)
    AND (_type IS NULL OR t.track_type::text = _type)
  ORDER BY t.marketplace_published_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;


--
-- Name: set_track_comment_workspace(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_track_comment_workspace() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT t.workspace_id INTO NEW.workspace_id
    FROM public.tracks t WHERE t.id = NEW.track_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_track_marketplace_public(uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_track_marketplace_public(_user_id uuid, _track_id uuid, _workspace_id uuid, _public boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  IF NOT EXISTS (SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id)
  THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE tracks SET
    is_marketplace_public = _public,
    marketplace_published_at = CASE WHEN _public THEN now() ELSE NULL END
  WHERE id = _track_id;
END;
$$;


--
-- Name: set_track_version_active(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_track_version_active(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE track_versions SET is_active = false WHERE track_id = _track_id;
  UPDATE track_versions SET is_active = true WHERE id = _version_id AND track_id = _track_id;
END;
$$;


--
-- Name: share_playlist_with_workspace(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.share_playlist_with_workspace(_user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing uuid;
  v_new_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _source_workspace_id, 'admin');

  IF _source_workspace_id = _target_workspace_id THEN
    RAISE EXCEPTION 'Cannot share a playlist with the same workspace';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = _playlist_id AND p.workspace_id = _source_workspace_id) THEN
    RAISE EXCEPTION 'Playlist % is not in the source workspace', _playlist_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _target_workspace_id) THEN
    RAISE EXCEPTION 'Target workspace % not found', _target_workspace_id;
  END IF;

  -- dedup: reuse an existing active share
  SELECT id INTO v_existing FROM public.catalog_shares
  WHERE playlist_id = _playlist_id AND target_workspace_id = _target_workspace_id AND status = 'active'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.catalog_shares (playlist_id, track_id, source_workspace_id, target_workspace_id, shared_by, access_level, status)
  VALUES (_playlist_id, NULL, _source_workspace_id, _target_workspace_id, _user_id, COALESCE(_access_level, 'viewer'), 'active')
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


--
-- Name: shared_link_is_secured(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shared_link_is_secured(_link_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select sl.password_hash is not null
                   from shared_links sl where sl.id = _link_id), false);
$$;


--
-- Name: sign_agreement_via_token(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sign_agreement_via_token(_token text, _signature_data text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request_id uuid;
BEGIN
  -- Strict token match against pending requests only
  SELECT id INTO v_request_id
  FROM public.signature_requests
  WHERE token = _token
    AND status = 'pending'
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  UPDATE public.signature_requests
  SET status = 'signed',
      signature_data = _signature_data,
      signed_at = now()
  WHERE id = v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;


--
-- Name: signature_requests_anon_immutable_cols(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.signature_requests_anon_immutable_cols() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: storage_path_workspace_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.storage_path_workspace_id(_path text) RETURNS uuid
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'storage'
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


--
-- Name: stripe_apply_subscription(text, text, text, text, text, timestamp with time zone, timestamp with time zone, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_apply_subscription(_customer_id text, _plan text, _cycle text, _status text, _stripe_sub_id text, _period_start timestamp with time zone, _period_end timestamp with time zone, _cancel_at_period_end boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET plan                   = _plan,
      billing_cycle          = _cycle,
      subscription_status    = CASE
                                 WHEN subscription_status IN ('active','trialing')
                                   AND _status IN ('incomplete','incomplete_expired')
                                 THEN subscription_status
                                 ELSE _status END,
      stripe_subscription_id = _stripe_sub_id,
      current_period_start   = _period_start,
      current_period_end     = _period_end,
      cancel_at_period_end   = coalesce(_cancel_at_period_end, false),
      canceled_at            = NULL,
      updated_at             = now()
  WHERE stripe_customer_id = _customer_id;
END;
$$;


--
-- Name: stripe_claim_webhook_event(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_claim_webhook_event(_event_id text, _event_type text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(_event_id, '') = '' then
    raise exception 'event_id is required' using errcode = 'check_violation';
  end if;

  insert into stripe_webhook_events (event_id, event_type)
  values (left(_event_id, 255), left(coalesce(_event_type, ''), 100))
  on conflict (event_id) do nothing;

  get diagnostics v_n = row_count;
  return v_n = 1;
end
$$;


--
-- Name: stripe_downgrade_to_free(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_downgrade_to_free(_customer_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET plan                   = 'free',
      billing_cycle          = NULL,
      subscription_status    = 'canceled',
      stripe_subscription_id = NULL,
      cancel_at_period_end   = false,
      canceled_at            = now(),
      updated_at             = now()
  WHERE stripe_customer_id = _customer_id;
END;
$$;


--
-- Name: stripe_grant_credits(text, integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_grant_credits(_customer_id text, _credits integer, _payment_intent text, _amount_cents integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.subscriptions WHERE stripe_customer_id = _customer_id;
  IF v_user IS NULL THEN RETURN; END IF;

  -- Déjà traité ? (retry webhook) -> on ne double-crédite pas.
  IF _payment_intent IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.credit_purchases WHERE stripe_payment_intent_id = _payment_intent
     ) THEN
    RETURN;
  END IF;

  INSERT INTO public.credit_purchases (user_id, amount, price_cents, stripe_payment_intent_id, status)
  VALUES (v_user, _credits, _amount_cents, _payment_intent, 'completed');

  UPDATE public.subscriptions
  SET ai_credits_purchased = coalesce(ai_credits_purchased,0) + _credits,
      updated_at = now()
  WHERE user_id = v_user;
END;
$$;


--
-- Name: stripe_mark_webhook_processed(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_mark_webhook_processed(_event_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update stripe_webhook_events
     set processed_at = now()
   where event_id = _event_id;
end
$$;


--
-- Name: stripe_reset_billing_usage(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET pitches_sent_this_month     = 0,
      smart_ar_queries_this_month = 0,
      ai_credits_monthly_used     = 0,
      ai_credits_reset_at         = _new_reset_at,
      subscription_status         = 'active',
      updated_at                  = now()
  WHERE stripe_customer_id = _customer_id
    AND (ai_credits_reset_at IS NULL OR _new_reset_at > ai_credits_reset_at);
END;
$$;


--
-- Name: stripe_set_customer(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_set_customer(_user_id uuid, _customer_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET stripe_customer_id = _customer_id, updated_at = now()
  WHERE user_id = _user_id;
END;
$$;


--
-- Name: stripe_set_purchased_seats(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stripe_set_purchased_seats(_customer_id text, _seats integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET purchased_seats = greatest(coalesce(_seats,0), 0), updated_at = now()
  WHERE stripe_customer_id = _customer_id;
END;
$$;


--
-- Name: sync_pitch_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_pitch_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.sent_by IS NOT NULL THEN
    PERFORM public.reset_monthly_usage_if_due(NEW.sent_by);
    UPDATE public.subscriptions
    SET pitches_sent_this_month = pitches_sent_this_month + 1,
        updated_at = now()
    WHERE user_id = NEW.sent_by;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_subscription_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_subscription_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subscriptions
    SET 
      tracks_uploaded_count = tracks_uploaded_count + 1,
      storage_bytes_used = storage_bytes_used + COALESCE(NEW.file_size_bytes, 0),
      updated_at = now()
    WHERE user_id = NEW.uploaded_by;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subscriptions
    SET 
      tracks_uploaded_count = GREATEST(tracks_uploaded_count - 1, 0),
      storage_bytes_used = GREATEST(storage_bytes_used - COALESCE(OLD.file_size_bytes, 0), 0),
      updated_at = now()
    WHERE user_id = OLD.uploaded_by;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: toggle_track_video_visibility(uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_track_video_visibility(_user_id uuid, _track_id uuid, _workspace_id uuid, _visible boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE tracks SET video_visible_on_shared_links = _visible WHERE id = _track_id AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: track_comments_anon_immutable_cols(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_comments_anon_immutable_cols() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: unaccent_safe(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unaccent_safe(_t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select translate(
    coalesce(_t, ''),
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;


--
-- Name: unmark_splits_signed_externally(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unmark_splits_signed_externally(_user_id uuid, _track_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_count integer;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  DELETE FROM public.signature_requests
  WHERE track_id = _track_id AND signed_externally = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;


--
-- Name: update_approval_status(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_approval_status(_user_id uuid, _approval_id uuid, _status text, _note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_approval_status_legacy_v0(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_approval_status_legacy_v0(_user_id uuid, _approval_id uuid, _status text, _note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM approvals WHERE id = _approval_id;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not an admin of this workspace';
  END IF;

  UPDATE approvals SET 
    status = _status::approval_status, 
    reviewed_by = _user_id,
    reviewer_note = _note,
    reviewed_at = now()
  WHERE id = _approval_id;
END;
$$;


--
-- Name: update_contact(uuid, uuid, uuid, text, text, text, text, text, text, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text DEFAULT NULL::text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  RETURN public.update_contact_legacy_v0(
    _user_id, _workspace_id, _contact_id,
    _first_name, _last_name, _email, _role, _company, _phone,
    _pro, _ipi, _publisher, _stage_name, _city, _country
  );
END;
$$;


--
-- Name: update_contact_legacy_v0(uuid, uuid, uuid, text, text, text, text, text, text, text[], text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_legacy_v0(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text DEFAULT NULL::text, _last_name text DEFAULT NULL::text, _email text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE id = _contact_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or wrong workspace';
  END IF;

  UPDATE contacts
  SET
    first_name = _first_name,
    last_name  = _last_name,
    email      = _email,
    role       = _role,
    company    = _company,
    phone      = _phone,
    pro        = _pro,
    ipi        = _ipi,
    publisher  = _publisher,
    stage_name = _stage_name,
    city       = _city,
    country    = _country,
    updated_at = now()
  WHERE id = _contact_id AND workspace_id = _workspace_id;

  RETURN _contact_id;
END;
$$;


--
-- Name: update_member_role(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_member_role(_user_id uuid, _member_user_id uuid, _workspace_id uuid, _access_level text, _professional_title text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  IF _access_level IS NOT NULL AND _access_level NOT IN ('viewer','pitcher','editor','admin')
  THEN RAISE EXCEPTION 'Invalid access level: %', _access_level; END IF;
  IF _access_level IS NOT NULL THEN
    UPDATE public.workspace_members SET access_level = _access_level
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id; END IF;
  IF _professional_title IS NOT NULL THEN
    UPDATE public.workspace_members SET professional_title = NULLIF(btrim(_professional_title),'')
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id; END IF;
END;
$$;


--
-- Name: update_pitch_share_link(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pitch_share_link(_user_id uuid, _pitch_id uuid, _workspace_id uuid, _share_link_id uuid DEFAULT NULL::uuid, _contact_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  IF _share_link_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shared_links
    WHERE id = _share_link_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid share link';
  END IF;

  IF _contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE id = _contact_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Invalid contact';
  END IF;

  UPDATE pitches
  SET share_link_id = COALESCE(_share_link_id, share_link_id),
      contact_id     = COALESCE(_contact_id, contact_id),
      updated_at     = now()
  WHERE id = _pitch_id
    AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: update_playlist(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_playlist(_user_id uuid, _playlist_id uuid, _name text DEFAULT NULL::text, _description text DEFAULT NULL::text, _cover_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_playlist_legacy_v0(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_playlist_legacy_v0(_user_id uuid, _playlist_id uuid, _name text DEFAULT NULL::text, _description text DEFAULT NULL::text, _cover_url text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _ws_id uuid;
BEGIN
  SELECT workspace_id INTO _ws_id FROM playlists WHERE id = _playlist_id;
  IF _ws_id IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members WHERE user_id = _user_id AND workspace_id = _ws_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE id = _ws_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE playlists SET
    name = COALESCE(_name, name),
    description = COALESCE(_description, description),
    cover_url = COALESCE(_cover_url, cover_url),
    updated_at = now()
  WHERE id = _playlist_id;
END;
$$;


--
-- Name: update_shared_link_status(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shared_link_status(_user_id uuid, _link_id uuid, _disabled boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_shared_link_status_legacy_v0(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_shared_link_status_legacy_v0(_user_id uuid, _link_id uuid, _disabled boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM shared_links WHERE id = _link_id;

  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE shared_links SET 
    status = CASE WHEN _disabled THEN 'disabled'::link_status ELSE 'active'::link_status END
  WHERE id = _link_id;
END;
$$;


--
-- Name: update_stem_type(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_stem_type_legacy_v0(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_stem_type_legacy_v0(_user_id uuid, _stem_id uuid, _stem_type text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT t.workspace_id INTO _workspace_id 
  FROM stems s JOIN tracks t ON t.id = s.track_id 
  WHERE s.id = _stem_id;
  
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE stems SET type = _stem_type::stem_type WHERE id = _stem_id;
END;
$$;


--
-- Name: update_studio_submission_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_studio_submission_status(_user_id uuid, _submission_id uuid, _status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_studio_submission_status_legacy_v0(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_studio_submission_status_legacy_v0(_user_id uuid, _submission_id uuid, _status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT t.workspace_id INTO _workspace_id 
  FROM studio_submissions s 
  JOIN tracks t ON t.id = s.track_id 
  WHERE s.id = _submission_id;

  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE studio_submissions SET status = _status WHERE id = _submission_id;
END;
$$;


--
-- Name: update_track(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  workspace_uuid uuid;
  uploader_uuid uuid;
  k text;
  v jsonb;
  set_clauses text := '';
  text_arr text[];
  v_allowed_columns text[] := ARRAY[
    'title', 'artist', 'featuring', 'track_type', 'status',
    'bpm', 'key', 'genre', 'mood',
    'language', 'gender',
    'notes', 'lyrics', 'lyrics_segments',
    'audio_url', 'audio_preview_url', 'cover_url',
    'duration_sec', 'waveform_data', 'sonic_dna', 'chapters',
    'album', 'upc', 'isrc', 'iswc',
    'released_at', 'copyright', 'explicit',
    'labels', 'publishers',
    'credits', 'tags', 'splits',
    'qr_token',
    'production_stage'
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
    OR (
      public.has_workspace_access_level(_user_id, workspace_uuid, 'pitcher')
      AND uploader_uuid = _user_id
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient access level for update_track: editor required to edit any track, or pitcher to edit own track'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each(_updates) LOOP
    IF NOT (k = ANY(v_allowed_columns)) THEN
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

  IF length(set_clauses) > 0 THEN
    set_clauses := substring(set_clauses from 3);
    EXECUTE format('UPDATE public.tracks SET %s, updated_at = now() WHERE id = %L',
                   set_clauses, _track_id);
  END IF;
END;
$$;


--
-- Name: update_track_comment_via_token(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_comment_via_token(_comment_id uuid, _shared_link_token text, _new_content text, _author_secret text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_content text;
  v_n       int;
begin
  v_content := left(btrim(coalesce(_new_content, '')), 2000);
  if v_content = '' then
    raise exception 'content is required' using errcode = 'check_violation';
  end if;
  if coalesce(_author_secret, '') = '' then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;

  update track_comments tc
     set content = v_content, updated_at = now(), is_edited = true
   where tc.id = _comment_id
     and tc.author_secret_hash is not null
     and tc.author_secret_hash = encode(sha256(_author_secret::bytea), 'hex')
     and exists (
       select 1 from shared_links sl
       where sl.link_slug = _shared_link_token
         and sl.status = 'active'::link_status
         and (sl.expires_at is null or sl.expires_at > now())
         and tc.shared_link_id = sl.id
     );

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  return true;
end
$$;


--
-- Name: update_track_document_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_document_status(_user_id uuid, _doc_id uuid, _status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_track_document_status_legacy_v0(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_document_status_legacy_v0(_user_id uuid, _doc_id uuid, _status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  _workspace_id uuid;
BEGIN
  SELECT t.workspace_id INTO _workspace_id 
  FROM track_documents d JOIN tracks t ON t.id = d.track_id 
  WHERE d.id = _doc_id;
  
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE track_documents SET status = _status WHERE id = _doc_id;
END;
$$;


--
-- Name: update_track_documents_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_documents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_track_version_chapters(uuid, uuid, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_version_chapters(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _chapters jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE track_versions SET chapters = _chapters WHERE id = _version_id AND track_id = _track_id;
  UPDATE tracks SET chapters = _chapters WHERE id = _track_id;
END;
$$;


--
-- Name: update_track_version_notes(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_version_notes(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _notes text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  UPDATE track_versions SET notes = _notes WHERE id = _version_id AND track_id = _track_id;
END;
$$;


--
-- Name: update_track_version_waveform(uuid, uuid, uuid, uuid, jsonb, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_version_waveform(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _waveform_data jsonb, _duration_sec numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE track_versions SET waveform_data = _waveform_data, duration_sec = _duration_sec WHERE id = _version_id AND track_id = _track_id;
END;
$$;


--
-- Name: update_track_video(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid, _video_url text, _video_filename text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'editor');
  UPDATE tracks SET video_url = _video_url, video_filename = _video_filename WHERE id = _track_id AND workspace_id = _workspace_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_user_profile(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data ||
    jsonb_build_object('first_name', _first_name, 'last_name', _last_name, 'phone', _phone, 'bio', _bio, 'avatar_url', _avatar_url)
  WHERE id = _user_id;
END;
$$;


--
-- Name: update_workspace_branding(uuid, uuid, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text DEFAULT NULL::text, _logo_url text DEFAULT NULL::text, _brand_color text DEFAULT NULL::text, _hero_position numeric DEFAULT NULL::numeric, _hero_focal_point text DEFAULT NULL::text, _social_instagram text DEFAULT NULL::text, _social_tiktok text DEFAULT NULL::text, _social_youtube text DEFAULT NULL::text, _social_facebook text DEFAULT NULL::text, _social_x text DEFAULT NULL::text, _social_website text DEFAULT NULL::text, _bio text DEFAULT NULL::text, _social_spotify text DEFAULT NULL::text, _social_apple text DEFAULT NULL::text, _epk_url text DEFAULT NULL::text, _logo_size integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND access_level = 'admin'
  ) THEN RAISE EXCEPTION 'Not an admin of this workspace'; END IF;

  UPDATE workspaces SET
    hero_image_url   = COALESCE(_hero_image_url, hero_image_url),
    logo_url         = COALESCE(_logo_url, logo_url),
    brand_color      = COALESCE(_brand_color, brand_color),
    hero_position    = COALESCE(_hero_position, hero_position),
    hero_focal_point = COALESCE(_hero_focal_point, hero_focal_point),
    social_instagram = COALESCE(_social_instagram, social_instagram),
    social_tiktok    = COALESCE(_social_tiktok, social_tiktok),
    social_youtube   = COALESCE(_social_youtube, social_youtube),
    social_facebook  = COALESCE(_social_facebook, social_facebook),
    social_x         = COALESCE(_social_x, social_x),
    social_website   = COALESCE(_social_website, social_website),
    bio              = COALESCE(_bio, bio),
    social_spotify   = COALESCE(_social_spotify, social_spotify),
    social_apple     = COALESCE(_social_apple, social_apple),
    -- borné serveur : 50% à 200%
    logo_size        = COALESCE(greatest(50, least(200, _logo_size)), logo_size),
    epk_url          = CASE WHEN _epk_url IS NULL THEN epk_url
                            WHEN _epk_url = '' THEN NULL
                            ELSE _epk_url END
  WHERE id = _workspace_id;
END;
$$;


--
-- Name: update_workspace_member(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_member(_user_id uuid, _workspace_id uuid, _member_id uuid, _professional_title text DEFAULT NULL::text, _access_level text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_admin boolean := false;
  is_self boolean := false;
  is_owner_target boolean := false;
  target_user_id uuid;
  workspace_owner_id uuid;
  old_title text;
  old_access_level text;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT user_id, professional_title, access_level
    INTO target_user_id, old_title, old_access_level
  FROM public.workspace_members
  WHERE id = _member_id AND workspace_id = _workspace_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Member % not found in workspace %', _member_id, _workspace_id;
  END IF;

  SELECT owner_id INTO workspace_owner_id
  FROM public.workspaces
  WHERE id = _workspace_id;

  is_owner_target := (target_user_id = workspace_owner_id);
  is_self := (target_user_id = _user_id);

  SELECT (access_level = 'admin') INTO is_admin
  FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  IF is_admin IS NULL THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id;
  END IF;

  IF _access_level IS NOT NULL THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only admins can change access level';
    END IF;
    IF is_owner_target THEN
      RAISE EXCEPTION 'Owner access level cannot be changed';
    END IF;
    IF _access_level NOT IN ('viewer', 'pitcher', 'editor', 'admin') THEN
      RAISE EXCEPTION 'Invalid access level: %', _access_level;
    END IF;

    UPDATE public.workspace_members
    SET access_level = _access_level
    WHERE id = _member_id;
  END IF;

  IF _professional_title IS NOT NULL THEN
    IF NOT is_admin AND NOT is_self THEN
      RAISE EXCEPTION 'You can only edit your own title or you must be admin';
    END IF;

    UPDATE public.workspace_members
    SET professional_title = NULLIF(btrim(_professional_title), '')
    WHERE id = _member_id;
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (user_id, workspace_id, action, resource_type, resource_id, metadata)
    VALUES (
      _user_id,
      _workspace_id,
      'workspace_member.updated',
      'workspace_member',
      _member_id,
      jsonb_build_object(
        'target_user_id', target_user_id,
        'old_access_level', old_access_level,
        'new_access_level', _access_level,
        'old_title', old_title,
        'new_title', _professional_title,
        'updated_by', _user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;


--
-- Name: update_workspace_name(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_name(_user_id uuid, _workspace_id uuid, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_name_legacy_v0(_user_id, _workspace_id, _name);
END;
$$;


--
-- Name: update_workspace_name_legacy_v0(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_name_legacy_v0(_user_id uuid, _workspace_id uuid, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not an admin of this workspace';
  END IF;

  UPDATE workspaces SET name = _name WHERE id = _workspace_id;
END;
$$;


--
-- Name: update_workspace_settings(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_settings(_user_id uuid, _workspace_id uuid, _settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_settings_legacy_v0(_user_id, _workspace_id, _settings);
END;
$$;


--
-- Name: update_workspace_settings_legacy_v0(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_settings_legacy_v0(_user_id uuid, _workspace_id uuid, _settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not an admin of this workspace';
  END IF;

  UPDATE workspaces SET
    is_personal = COALESCE((_settings->>'is_personal')::boolean, is_personal),
    name = COALESCE(_settings->>'name', name)
  WHERE id = _workspace_id;
END;
$$;


--
-- Name: update_workspace_slug(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_slug(_user_id uuid, _workspace_id uuid, _slug text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');
  PERFORM public.update_workspace_slug_legacy_v0(_user_id, _workspace_id, _slug);
END;
$$;


--
-- Name: update_workspace_slug_legacy_v0(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspace_slug_legacy_v0(_user_id uuid, _workspace_id uuid, _slug text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not an admin of this workspace';
  END IF;

  UPDATE workspaces SET slug = _slug WHERE id = _workspace_id;
END;
$$;


--
-- Name: upsert_artist_alias(uuid, uuid, text, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_artist_alias(_user_id uuid, _workspace_id uuid, _alias_name text, _contact_ids uuid[], _alias_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  IF _alias_id IS NOT NULL THEN
    UPDATE artist_aliases SET alias_name = _alias_name, contact_ids = _contact_ids 
    WHERE id = _alias_id AND workspace_id = _workspace_id 
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO artist_aliases (workspace_id, alias_name, contact_ids, created_by)
    VALUES (_workspace_id, _alias_name, _contact_ids, _user_id)
    ON CONFLICT (workspace_id, alias_name) DO UPDATE SET contact_ids = EXCLUDED.contact_ids
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: upsert_contact(uuid, uuid, text, text, text, text, text, text, text, text, text, text[], text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text DEFAULT NULL::text, _stage_name text DEFAULT NULL::text, _role text DEFAULT NULL::text, _company text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _city text DEFAULT NULL::text, _country text DEFAULT NULL::text, _pro text[] DEFAULT NULL::text[], _ipi text DEFAULT NULL::text, _publisher text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: upsert_notification_preferences(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_notification_preferences(_user_id uuid, _preferences jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('notification_preferences', _preferences)
  WHERE id = _user_id;
END;
$$;


--
-- Name: upsert_track_rating(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'viewer');
  IF _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  INSERT INTO track_ratings (track_id, workspace_id, user_id, rating)
  VALUES (_track_id, _workspace_id, _user_id, _rating)
  ON CONFLICT (track_id, workspace_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
END;
$$;


--
-- Name: verify_shared_link_session(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_shared_link_session(_link_id uuid, _token text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from shared_link_sessions s
    where s.link_id = _link_id
      and s.expires_at > now()
      and s.token_hash = encode(sha256(coalesce(_token, '')::bytea), 'hex')
      and coalesce(_token, '') <> ''
  );
$$;


--
-- Name: write_audit_log(uuid, uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_caller(_user_id);
  INSERT INTO audit_logs (user_id, workspace_id, action, resource_type, resource_id, metadata)
  VALUES (_user_id, _workspace_id, _action, _entity_type, _entity_id, _metadata::jsonb);
END;
$$;


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    track_id uuid NOT NULL,
    requested_by uuid,
    reviewed_by uuid,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    review_note text,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: artist_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    alias_name text NOT NULL,
    contact_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: beta_passes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_passes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    pass_type text NOT NULL,
    plan_granted text DEFAULT 'pro'::text NOT NULL,
    granted_by uuid,
    redeemed_by uuid,
    redeemed_at timestamp with time zone,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT beta_passes_pass_type_check CHECK ((pass_type = ANY (ARRAY['lifetime'::text, 'annual'::text, 'monthly'::text]))),
    CONSTRAINT beta_passes_plan_granted_check CHECK ((plan_granted = ANY (ARRAY['starter'::text, 'pro'::text, 'business'::text]))),
    CONSTRAINT beta_passes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'redeemed'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: catalog_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid,
    source_workspace_id uuid NOT NULL,
    target_workspace_id uuid NOT NULL,
    shared_by uuid NOT NULL,
    access_level text DEFAULT 'pitcher'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone,
    playlist_id uuid
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    created_by uuid,
    first_name text NOT NULL,
    last_name text,
    email text,
    phone text,
    company text,
    role text,
    tags text[] DEFAULT '{}'::text[],
    notes text,
    favorite boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pro text[],
    ipi text DEFAULT ''::text,
    publisher text DEFAULT ''::text,
    stage_name text,
    city text,
    country text
);


--
-- Name: credit_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    price_cents integer NOT NULL,
    stripe_payment_intent_id text,
    status text DEFAULT 'completed'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credit_purchases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'refunded'::text, 'failed'::text])))
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'viewer'::text,
    token text NOT NULL,
    status text DEFAULT 'pending'::text,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    created_at timestamp with time zone DEFAULT now(),
    access_level text DEFAULT 'viewer'::text,
    professional_title text,
    CONSTRAINT invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: leak_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leak_traces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    hash_hex text,
    confidence real DEFAULT 0,
    match boolean DEFAULT false,
    visitor_email text,
    visitor_name text,
    link_id uuid,
    raw_payload text,
    created_at timestamp with time zone DEFAULT now(),
    leaker_ip text,
    ip_source text
);


--
-- Name: link_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    downloader_name text,
    downloader_email text,
    organization text,
    role text,
    track_name text,
    stems_downloaded text[] DEFAULT '{}'::text[],
    ip_address inet,
    user_agent text,
    downloaded_at timestamp with time zone DEFAULT now() NOT NULL,
    visitor_ip text
);


--
-- Name: link_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid,
    track_id uuid,
    visitor_email text,
    event_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    visitor_ip text,
    CONSTRAINT link_events_event_type_check CHECK ((event_type = ANY (ARRAY['play'::text, 'download'::text, 'view'::text])))
);


--
-- Name: marketplace_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    requester_user_id uuid NOT NULL,
    requester_workspace_id uuid,
    owner_workspace_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    requester_name text,
    requester_company text,
    requester_email text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    link_activity boolean DEFAULT true,
    comments boolean DEFAULT true,
    signatures boolean DEFAULT true,
    new_member_joined boolean DEFAULT true,
    track_uploads boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean DEFAULT false NOT NULL,
    track_id uuid,
    pitch_id uuid,
    link_id uuid,
    approval_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pitches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pitches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    sent_by uuid,
    contact_id uuid,
    recipient_name text NOT NULL,
    recipient_email text,
    recipient_company text,
    subject text NOT NULL,
    message text,
    track_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status public.pitch_status DEFAULT 'draft'::public.pitch_status NOT NULL,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    responded_at timestamp with time zone,
    response_note text,
    share_link_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_limits (
    plan text NOT NULL,
    tracks_max integer NOT NULL,
    storage_bytes_max bigint NOT NULL,
    playlists_max integer NOT NULL,
    shared_links_max integer NOT NULL,
    contacts_max integer NOT NULL,
    pitches_per_month integer NOT NULL,
    smart_ar_per_month integer NOT NULL,
    smart_ar_lifetime integer,
    workspaces_max integer NOT NULL,
    seats_included integer NOT NULL,
    seats_addon_allowed boolean NOT NULL,
    seat_addon_price_cents integer,
    viewers_unlimited boolean NOT NULL,
    can_buy_credits boolean NOT NULL,
    price_monthly_cents integer NOT NULL,
    price_yearly_cents integer NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plan_limits_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'business'::text])))
);


--
-- Name: playlist_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    playlist_id uuid NOT NULL,
    track_id uuid NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


--
-- Name: playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    created_by uuid,
    name text NOT NULL,
    description text,
    cover_url text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now(),
    onboarding_complete boolean DEFAULT false NOT NULL
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    request_count integer DEFAULT 1 NOT NULL
);


--
-- Name: shared_link_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_link_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    link_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE shared_link_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.shared_link_sessions IS 'Sessions emises apres verification reussie du mot de passe d''un lien protege. Seul le hash du jeton est stocke.';


--
-- Name: shared_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    created_by uuid,
    share_type public.share_type NOT NULL,
    track_id uuid,
    playlist_id uuid,
    link_name text NOT NULL,
    link_slug text NOT NULL,
    link_type text DEFAULT 'public'::text NOT NULL,
    password_hash text,
    message text,
    allow_download boolean DEFAULT false NOT NULL,
    download_quality text,
    expires_at timestamp with time zone,
    status public.link_status DEFAULT 'active'::public.link_status NOT NULL,
    pack_items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    allow_save boolean DEFAULT true NOT NULL,
    watermarking_enabled boolean DEFAULT true NOT NULL,
    gate_screen_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT shared_links_download_quality_check CHECK ((download_quality = ANY (ARRAY['hi-res'::text, 'low-res'::text]))),
    CONSTRAINT shared_links_link_type_check CHECK ((link_type = ANY (ARRAY['public'::text, 'secured'::text])))
);


--
-- Name: signature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signature_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    collaborator_name text NOT NULL,
    collaborator_email text NOT NULL,
    role text DEFAULT ''::text NOT NULL,
    split_share numeric DEFAULT 0 NOT NULL,
    pro text DEFAULT ''::text,
    ipi text DEFAULT ''::text,
    publisher text DEFAULT ''::text,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    signature_data text,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    signed_externally boolean DEFAULT false NOT NULL,
    CONSTRAINT signature_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'declined'::text])))
);


--
-- Name: site_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id text,
    session_id text,
    path text DEFAULT '/'::text NOT NULL,
    referrer text,
    referrer_domain text,
    source text DEFAULT 'direct'::text NOT NULL,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE site_visits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.site_visits IS 'Analytics maison : pages vues + source de provenance. Aucune donnee personnelle (pas d IP, pas d email). Ecriture via public.log_site_visit, lecture via public.get_visit_stats (admin plateforme).';


--
-- Name: stems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    track_id uuid NOT NULL,
    uploaded_by uuid,
    file_name text NOT NULL,
    stem_type public.stem_type DEFAULT 'other'::public.stem_type NOT NULL,
    file_url text NOT NULL,
    file_size_bytes bigint,
    duration_sec integer,
    sample_rate integer,
    bit_depth smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stems_file_size_bytes_check CHECK ((file_size_bytes > 0))
);


--
-- Name: stripe_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_prices (
    stripe_price_id text NOT NULL,
    kind text NOT NULL,
    plan text,
    billing_cycle text,
    credits_amount integer,
    amount_cents integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_prices_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT stripe_prices_kind_check CHECK ((kind = ANY (ARRAY['subscription'::text, 'credits'::text, 'seat'::text]))),
    CONSTRAINT stripe_prices_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'business'::text])))
);


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    event_id text NOT NULL,
    event_type text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: TABLE stripe_webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_webhook_events IS 'Idempotence des webhooks Stripe : un event_id ne peut etre traite qu''une seule fois.';


--
-- Name: studio_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.studio_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    artist_name text,
    roles text[] DEFAULT '{}'::text[],
    pro_name text,
    ipi_number text,
    publisher_name text,
    proposed_split numeric DEFAULT 0 NOT NULL,
    justification text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT studio_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text,
    subscription_status text DEFAULT 'active'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    ai_credits_purchased integer DEFAULT 0,
    ai_credits_monthly_used integer DEFAULT 0,
    ai_credits_reset_at timestamp with time zone DEFAULT (now() + '1 mon'::interval),
    tracks_uploaded_count integer DEFAULT 0,
    storage_bytes_used bigint DEFAULT 0,
    pitches_sent_this_month integer DEFAULT 0,
    smart_ar_queries_this_month integer DEFAULT 0,
    beta_pass_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    purchased_seats integer DEFAULT 0 NOT NULL,
    CONSTRAINT subscriptions_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text]))),
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text, 'business'::text]))),
    CONSTRAINT subscriptions_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text, 'trialing'::text, 'paused'::text])))
);


--
-- Name: track_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    name text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    mime_type text DEFAULT 'application/pdf'::text NOT NULL,
    status public.document_status DEFAULT 'draft'::public.document_status NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: track_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT track_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: track_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    version_name text DEFAULT 'V1'::text NOT NULL,
    audio_url text,
    audio_preview_url text,
    waveform_data jsonb,
    sonic_dna jsonb,
    duration_sec numeric,
    is_active boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    chapters jsonb DEFAULT '[]'::jsonb
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'LEGACY (depuis 2026-05-10) — Table conservée pour backward compat. Aucune RLS policy ne s''appuie plus dessus. Source de vérité : workspace_members.access_level. À supprimer en Phase 2.';


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    invited_at timestamp with time zone,
    invitation_sent_by uuid,
    name text
);


--
-- Name: watermark_payloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watermark_payloads (
    hash_hex text NOT NULL,
    raw_payload text NOT NULL,
    link_id uuid,
    visitor_email text,
    visitor_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: whitelisted_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whitelisted_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    access_level text DEFAULT 'viewer'::text NOT NULL,
    professional_title text
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    owner_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hero_image_url text,
    logo_url text,
    brand_color text,
    hero_position integer DEFAULT 50,
    is_personal boolean DEFAULT false,
    hero_focal_point text DEFAULT '50% 50%'::text,
    social_instagram text DEFAULT ''::text,
    social_tiktok text DEFAULT ''::text,
    social_youtube text DEFAULT ''::text,
    social_facebook text DEFAULT ''::text,
    social_x text DEFAULT ''::text,
    social_website text,
    bio text,
    social_spotify text,
    social_apple text,
    epk_url text,
    logo_size integer DEFAULT 100 NOT NULL,
    CONSTRAINT brand_color_format_check CHECK (((brand_color IS NULL) OR (brand_color ~ '^#[0-9a-fA-F]{6}$'::text))),
    CONSTRAINT workspaces_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: artist_aliases artist_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_pkey PRIMARY KEY (id);


--
-- Name: artist_aliases artist_aliases_workspace_id_alias_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_workspace_id_alias_name_key UNIQUE (workspace_id, alias_name);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: beta_passes beta_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_passes
    ADD CONSTRAINT beta_passes_pkey PRIMARY KEY (id);


--
-- Name: catalog_shares catalog_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_pkey PRIMARY KEY (id);


--
-- Name: catalog_shares catalog_shares_track_id_source_workspace_id_target_workspac_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_track_id_source_workspace_id_target_workspac_key UNIQUE (track_id, source_workspace_id, target_workspace_id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: credit_purchases credit_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_pkey PRIMARY KEY (id);


--
-- Name: credit_purchases credit_purchases_stripe_payment_intent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: leak_traces leak_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leak_traces
    ADD CONSTRAINT leak_traces_pkey PRIMARY KEY (id);


--
-- Name: link_downloads link_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_downloads
    ADD CONSTRAINT link_downloads_pkey PRIMARY KEY (id);


--
-- Name: link_events link_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_pkey PRIMARY KEY (id);


--
-- Name: marketplace_requests marketplace_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_pkey PRIMARY KEY (id);


--
-- Name: marketplace_requests marketplace_requests_track_id_requester_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_track_id_requester_user_id_key UNIQUE (track_id, requester_user_id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pitches pitches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_pkey PRIMARY KEY (id);


--
-- Name: plan_limits plan_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_limits
    ADD CONSTRAINT plan_limits_pkey PRIMARY KEY (plan);


--
-- Name: playlist_tracks playlist_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (id);


--
-- Name: playlist_tracks playlist_tracks_playlist_id_track_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_playlist_id_track_id_key UNIQUE (playlist_id, track_id);


--
-- Name: playlists playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_key_key UNIQUE (key);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: shared_link_sessions shared_link_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_link_sessions
    ADD CONSTRAINT shared_link_sessions_pkey PRIMARY KEY (id);


--
-- Name: shared_links shared_links_link_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_link_slug_key UNIQUE (link_slug);


--
-- Name: shared_links shared_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_pkey PRIMARY KEY (id);


--
-- Name: signature_requests signature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_requests
    ADD CONSTRAINT signature_requests_pkey PRIMARY KEY (id);


--
-- Name: signature_requests signature_requests_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_requests
    ADD CONSTRAINT signature_requests_token_key UNIQUE (token);


--
-- Name: site_visits site_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_visits
    ADD CONSTRAINT site_visits_pkey PRIMARY KEY (id);


--
-- Name: stems stems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stems
    ADD CONSTRAINT stems_pkey PRIMARY KEY (id);


--
-- Name: stripe_prices stripe_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_prices
    ADD CONSTRAINT stripe_prices_pkey PRIMARY KEY (stripe_price_id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (event_id);


--
-- Name: studio_submissions studio_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_submissions
    ADD CONSTRAINT studio_submissions_pkey PRIMARY KEY (id);


--
-- Name: studio_submissions studio_submissions_track_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_submissions
    ADD CONSTRAINT studio_submissions_track_id_email_key UNIQUE (track_id, email);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);


--
-- Name: track_comments track_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_comments
    ADD CONSTRAINT track_comments_pkey PRIMARY KEY (id);


--
-- Name: track_documents track_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_documents
    ADD CONSTRAINT track_documents_pkey PRIMARY KEY (id);


--
-- Name: track_ratings track_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_ratings
    ADD CONSTRAINT track_ratings_pkey PRIMARY KEY (id);


--
-- Name: track_ratings track_ratings_track_id_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_ratings
    ADD CONSTRAINT track_ratings_track_id_workspace_id_user_id_key UNIQUE (track_id, workspace_id, user_id);


--
-- Name: track_versions track_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_pkey PRIMARY KEY (id);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: tracks tracks_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_qr_token_key UNIQUE (qr_token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_workspace_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_workspace_id_role_key UNIQUE (user_id, workspace_id, role);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: watermark_payloads watermark_payloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watermark_payloads
    ADD CONSTRAINT watermark_payloads_pkey PRIMARY KEY (hash_hex);


--
-- Name: whitelisted_emails whitelisted_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whitelisted_emails
    ADD CONSTRAINT whitelisted_emails_email_key UNIQUE (email);


--
-- Name: whitelisted_emails whitelisted_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whitelisted_emails
    ADD CONSTRAINT whitelisted_emails_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: idx_approvals_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_requested ON public.approvals USING btree (requested_by);


--
-- Name: idx_approvals_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_reviewed_by ON public.approvals USING btree (reviewed_by);


--
-- Name: idx_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_status ON public.approvals USING btree (workspace_id, status);


--
-- Name: idx_approvals_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_track ON public.approvals USING btree (track_id);


--
-- Name: idx_approvals_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_workspace ON public.approvals USING btree (workspace_id);


--
-- Name: idx_artist_aliases_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artist_aliases_created_by ON public.artist_aliases USING btree (created_by);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_beta_passes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_passes_email ON public.beta_passes USING btree (email);


--
-- Name: idx_beta_passes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_passes_expires_at ON public.beta_passes USING btree (expires_at);


--
-- Name: idx_beta_passes_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_passes_granted_by ON public.beta_passes USING btree (granted_by);


--
-- Name: idx_beta_passes_redeemed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_passes_redeemed_by ON public.beta_passes USING btree (redeemed_by);


--
-- Name: idx_beta_passes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beta_passes_status ON public.beta_passes USING btree (status);


--
-- Name: idx_catalog_shares_playlist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_shares_playlist_id ON public.catalog_shares USING btree (playlist_id);


--
-- Name: idx_catalog_shares_shared_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_shares_shared_by ON public.catalog_shares USING btree (shared_by);


--
-- Name: idx_catalog_shares_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_shares_source ON public.catalog_shares USING btree (source_workspace_id);


--
-- Name: idx_catalog_shares_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_shares_target ON public.catalog_shares USING btree (target_workspace_id);


--
-- Name: idx_catalog_shares_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_shares_track ON public.catalog_shares USING btree (track_id);


--
-- Name: idx_catalog_shares_unique_full_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_catalog_shares_unique_full_catalog ON public.catalog_shares USING btree (source_workspace_id, target_workspace_id) WHERE ((track_id IS NULL) AND (status = 'active'::text));


--
-- Name: idx_catalog_shares_unique_track; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_catalog_shares_unique_track ON public.catalog_shares USING btree (track_id, source_workspace_id, target_workspace_id) WHERE ((track_id IS NOT NULL) AND (status = 'active'::text));


--
-- Name: idx_contacts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_company ON public.contacts USING btree (workspace_id, company);


--
-- Name: idx_contacts_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_created_by ON public.contacts USING btree (created_by);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (workspace_id, email);


--
-- Name: idx_contacts_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_workspace ON public.contacts USING btree (workspace_id);


--
-- Name: idx_credit_purchases_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases USING btree (user_id);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);


--
-- Name: idx_invitations_invited_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_invited_by ON public.invitations USING btree (invited_by);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_invitations_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_workspace_id ON public.invitations USING btree (workspace_id);


--
-- Name: idx_jobs_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_claim ON public.jobs USING btree (status, run_after, priority, created_at) WHERE (status = ANY (ARRAY['pending'::public.job_status, 'processing'::public.job_status]));


--
-- Name: idx_jobs_dedupe_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_jobs_dedupe_active ON public.jobs USING btree (dedupe_key) WHERE ((dedupe_key IS NOT NULL) AND (status = ANY (ARRAY['pending'::public.job_status, 'processing'::public.job_status])));


--
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_type ON public.jobs USING btree (job_type, status);


--
-- Name: idx_jobs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_workspace ON public.jobs USING btree (workspace_id, created_at DESC);


--
-- Name: idx_ld_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ld_date ON public.link_downloads USING btree (downloaded_at DESC);


--
-- Name: idx_ld_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ld_link ON public.link_downloads USING btree (link_id);


--
-- Name: idx_leak_traces_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leak_traces_workspace ON public.leak_traces USING btree (workspace_id, created_at DESC);


--
-- Name: idx_link_events_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_events_ip ON public.link_events USING btree (visitor_ip);


--
-- Name: idx_link_events_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_events_link_id ON public.link_events USING btree (link_id);


--
-- Name: idx_link_events_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_link_events_track_id ON public.link_events USING btree (track_id);


--
-- Name: idx_mkt_requests_owner_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mkt_requests_owner_ws ON public.marketplace_requests USING btree (owner_workspace_id);


--
-- Name: idx_mkt_requests_requester_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mkt_requests_requester_user ON public.marketplace_requests USING btree (requester_user_id);


--
-- Name: idx_mkt_requests_requester_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mkt_requests_requester_ws ON public.marketplace_requests USING btree (requester_workspace_id);


--
-- Name: idx_notif_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notif_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notif_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_workspace ON public.notifications USING btree (workspace_id);


--
-- Name: idx_notifications_approval_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_approval_id ON public.notifications USING btree (approval_id);


--
-- Name: idx_notifications_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_link_id ON public.notifications USING btree (link_id);


--
-- Name: idx_notifications_pitch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_pitch_id ON public.notifications USING btree (pitch_id);


--
-- Name: idx_notifications_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_track_id ON public.notifications USING btree (track_id);


--
-- Name: idx_pitches_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_contact ON public.pitches USING btree (contact_id);


--
-- Name: idx_pitches_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_sent_at ON public.pitches USING btree (workspace_id, sent_at DESC);


--
-- Name: idx_pitches_sent_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_sent_by ON public.pitches USING btree (sent_by);


--
-- Name: idx_pitches_share_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_share_link_id ON public.pitches USING btree (share_link_id);


--
-- Name: idx_pitches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_status ON public.pitches USING btree (workspace_id, status);


--
-- Name: idx_pitches_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pitches_workspace ON public.pitches USING btree (workspace_id);


--
-- Name: idx_playlist_tracks_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlist_tracks_added_by ON public.playlist_tracks USING btree (added_by);


--
-- Name: idx_playlists_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlists_created_by ON public.playlists USING btree (created_by);


--
-- Name: idx_playlists_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_playlists_workspace ON public.playlists USING btree (workspace_id);


--
-- Name: idx_pt_playlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_playlist ON public.playlist_tracks USING btree (playlist_id);


--
-- Name: idx_pt_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_position ON public.playlist_tracks USING btree (playlist_id, "position");


--
-- Name: idx_pt_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_track ON public.playlist_tracks USING btree (track_id);


--
-- Name: idx_rate_limits_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_window ON public.rate_limits USING btree (window_start);


--
-- Name: idx_shared_links_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_links_created_by ON public.shared_links USING btree (created_by);


--
-- Name: idx_signature_requests_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_signature_requests_track_id ON public.signature_requests USING btree (track_id);


--
-- Name: idx_site_visits_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_visits_created_at ON public.site_visits USING btree (created_at DESC);


--
-- Name: idx_site_visits_session_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_visits_session_path ON public.site_visits USING btree (session_id, path, created_at DESC);


--
-- Name: idx_site_visits_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_visits_source ON public.site_visits USING btree (source, created_at DESC);


--
-- Name: idx_site_visits_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_visits_visitor ON public.site_visits USING btree (visitor_id, created_at DESC);


--
-- Name: idx_sl_playlist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_playlist ON public.shared_links USING btree (playlist_id);


--
-- Name: idx_sl_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_slug ON public.shared_links USING btree (link_slug);


--
-- Name: idx_sl_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_status ON public.shared_links USING btree (workspace_id, status);


--
-- Name: idx_sl_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_track ON public.shared_links USING btree (track_id);


--
-- Name: idx_sl_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sl_workspace ON public.shared_links USING btree (workspace_id);


--
-- Name: idx_sls_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sls_link ON public.shared_link_sessions USING btree (link_id, expires_at DESC);


--
-- Name: idx_sls_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sls_token_hash ON public.shared_link_sessions USING btree (token_hash);


--
-- Name: idx_stems_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stems_track ON public.stems USING btree (track_id);


--
-- Name: idx_stems_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stems_type ON public.stems USING btree (track_id, stem_type);


--
-- Name: idx_stems_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stems_uploaded_by ON public.stems USING btree (uploaded_by);


--
-- Name: idx_stems_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stems_workspace ON public.stems USING btree (workspace_id);


--
-- Name: idx_stripe_webhook_events_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_webhook_events_received_at ON public.stripe_webhook_events USING btree (received_at DESC);


--
-- Name: idx_subscriptions_beta_pass_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_beta_pass_id ON public.subscriptions USING btree (beta_pass_id);


--
-- Name: idx_subscriptions_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_plan ON public.subscriptions USING btree (plan);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (subscription_status);


--
-- Name: idx_subscriptions_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_subscription ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_track_comments_shared_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_comments_shared_link ON public.track_comments USING btree (shared_link_id);


--
-- Name: idx_track_comments_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_comments_track_id ON public.track_comments USING btree (track_id);


--
-- Name: idx_track_comments_track_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_comments_track_ws ON public.track_comments USING btree (track_id, workspace_id);


--
-- Name: idx_track_comments_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_comments_workspace_id ON public.track_comments USING btree (workspace_id);


--
-- Name: idx_track_documents_track_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_documents_track_id ON public.track_documents USING btree (track_id);


--
-- Name: idx_track_documents_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_documents_uploaded_by ON public.track_documents USING btree (uploaded_by);


--
-- Name: idx_track_documents_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_documents_workspace_id ON public.track_documents USING btree (workspace_id);


--
-- Name: idx_track_ratings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_ratings_user_id ON public.track_ratings USING btree (user_id);


--
-- Name: idx_track_ratings_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_ratings_workspace_id ON public.track_ratings USING btree (workspace_id);


--
-- Name: idx_track_versions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_versions_active ON public.track_versions USING btree (track_id) WHERE (is_active = true);


--
-- Name: idx_track_versions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_track_versions_created_by ON public.track_versions USING btree (created_by);


--
-- Name: idx_tracks_artist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_artist ON public.tracks USING btree (workspace_id, artist);


--
-- Name: idx_tracks_bpm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_bpm ON public.tracks USING btree (workspace_id, bpm);


--
-- Name: idx_tracks_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_created ON public.tracks USING btree (workspace_id, created_at DESC);


--
-- Name: idx_tracks_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_fts ON public.tracks USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(artist, ''::text))));


--
-- Name: idx_tracks_genre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_genre ON public.tracks USING btree (workspace_id, genre);


--
-- Name: idx_tracks_genre_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_genre_gin ON public.tracks USING gin (genre);


--
-- Name: idx_tracks_marketplace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_marketplace ON public.tracks USING btree (is_marketplace_public) WHERE (is_marketplace_public = true);


--
-- Name: idx_tracks_mkt_filters; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_mkt_filters ON public.tracks USING btree (status, bpm) WHERE (is_marketplace_public = true);


--
-- Name: idx_tracks_mood_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_mood_gin ON public.tracks USING gin (mood);


--
-- Name: idx_tracks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_status ON public.tracks USING btree (workspace_id, status);


--
-- Name: idx_tracks_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_uploaded_by ON public.tracks USING btree (uploaded_by);


--
-- Name: idx_tracks_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracks_workspace ON public.tracks USING btree (workspace_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_roles_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_ws ON public.user_roles USING btree (workspace_id);


--
-- Name: idx_waitlist_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_created_at ON public.waitlist USING btree (created_at DESC);


--
-- Name: idx_waitlist_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_email_lower ON public.waitlist USING btree (lower(email));


--
-- Name: idx_waitlist_invitation_sent_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_invitation_sent_by ON public.waitlist USING btree (invitation_sent_by);


--
-- Name: idx_watermark_payloads_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watermark_payloads_link_id ON public.watermark_payloads USING btree (link_id);


--
-- Name: idx_watermark_payloads_visitor_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watermark_payloads_visitor_email ON public.watermark_payloads USING btree (visitor_email);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_user_ws_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user_ws_level ON public.workspace_members USING btree (user_id, workspace_id, access_level);


--
-- Name: idx_workspace_members_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_ws ON public.workspace_members USING btree (workspace_id);


--
-- Name: unique_personal_workspace_per_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_personal_workspace_per_owner ON public.workspaces USING btree (owner_id) WHERE (is_personal = true);


--
-- Name: uq_contacts_ws_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_contacts_ws_email ON public.contacts USING btree (workspace_id, lower(email)) WHERE ((email IS NOT NULL) AND (btrim(email) <> ''::text));


--
-- Name: uq_contacts_ws_name_noemail; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_contacts_ws_name_noemail ON public.contacts USING btree (workspace_id, lower(first_name), lower(COALESCE(last_name, ''::text))) WHERE ((email IS NULL) OR (btrim(email) = ''::text));


--
-- Name: pitches enforce_pitch_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_pitch_limit BEFORE INSERT ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.enforce_pitch_limit();


--
-- Name: invitations enforce_seat_limit_invitation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_seat_limit_invitation BEFORE INSERT ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit_invitation();


--
-- Name: workspace_members enforce_seat_limit_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_seat_limit_member BEFORE INSERT OR UPDATE OF access_level ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_limit_member();


--
-- Name: tracks enforce_track_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_track_limit BEFORE INSERT ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.enforce_track_limit();


--
-- Name: workspaces enforce_workspace_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_workspace_limit BEFORE INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_limit();


--
-- Name: signature_requests signature_requests_anon_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER signature_requests_anon_immutability BEFORE UPDATE ON public.signature_requests FOR EACH ROW EXECUTE FUNCTION public.signature_requests_anon_immutable_cols();


--
-- Name: pitches sync_pitch_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_pitch_usage AFTER INSERT ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.sync_pitch_usage();


--
-- Name: tracks sync_tracks_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_tracks_usage AFTER INSERT OR DELETE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_usage();


--
-- Name: track_comments track_comments_anon_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_comments_anon_immutability BEFORE UPDATE ON public.track_comments FOR EACH ROW EXECUTE FUNCTION public.track_comments_anon_immutable_cols();


--
-- Name: track_documents track_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER track_documents_updated_at BEFORE UPDATE ON public.track_documents FOR EACH ROW EXECUTE FUNCTION public.update_track_documents_updated_at();


--
-- Name: contacts trg_auto_alias_on_contact; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_alias_on_contact AFTER INSERT OR UPDATE OF stage_name ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.auto_create_alias_from_stage_name();


--
-- Name: workspaces trg_prevent_client_plan_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_client_plan_change BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.prevent_client_plan_change();


--
-- Name: track_comments trg_set_track_comment_workspace; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_track_comment_workspace BEFORE INSERT ON public.track_comments FOR EACH ROW EXECUTE FUNCTION public.set_track_comment_workspace();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pitches update_pitches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pitches_updated_at BEFORE UPDATE ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: playlists update_playlists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shared_links update_shared_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shared_links_updated_at BEFORE UPDATE ON public.shared_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tracks update_tracks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workspaces update_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approvals approvals_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: approvals approvals_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: approvals approvals_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: artist_aliases artist_aliases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: artist_aliases artist_aliases_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist_aliases
    ADD CONSTRAINT artist_aliases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: beta_passes beta_passes_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_passes
    ADD CONSTRAINT beta_passes_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: beta_passes beta_passes_redeemed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_passes
    ADD CONSTRAINT beta_passes_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES auth.users(id);


--
-- Name: catalog_shares catalog_shares_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: catalog_shares catalog_shares_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id);


--
-- Name: catalog_shares catalog_shares_source_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_source_workspace_id_fkey FOREIGN KEY (source_workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: catalog_shares catalog_shares_target_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_target_workspace_id_fkey FOREIGN KEY (target_workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: catalog_shares catalog_shares_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_shares
    ADD CONSTRAINT catalog_shares_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: credit_purchases credit_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: invitations invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: leak_traces leak_traces_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leak_traces
    ADD CONSTRAINT leak_traces_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);


--
-- Name: link_downloads link_downloads_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_downloads
    ADD CONSTRAINT link_downloads_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.shared_links(id) ON DELETE CASCADE;


--
-- Name: link_events link_events_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.shared_links(id) ON DELETE CASCADE;


--
-- Name: link_events link_events_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: marketplace_requests marketplace_requests_owner_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_owner_workspace_id_fkey FOREIGN KEY (owner_workspace_id) REFERENCES public.workspaces(id);


--
-- Name: marketplace_requests marketplace_requests_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id);


--
-- Name: marketplace_requests marketplace_requests_requester_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_requester_workspace_id_fkey FOREIGN KEY (requester_workspace_id) REFERENCES public.workspaces(id);


--
-- Name: marketplace_requests marketplace_requests_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_requests
    ADD CONSTRAINT marketplace_requests_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.shared_links(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_pitch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pitch_id_fkey FOREIGN KEY (pitch_id) REFERENCES public.pitches(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: pitches pitches_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: pitches pitches_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: pitches pitches_share_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_share_link_id_fkey FOREIGN KEY (share_link_id) REFERENCES public.shared_links(id) ON DELETE SET NULL;


--
-- Name: pitches pitches_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pitches
    ADD CONSTRAINT pitches_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: playlist_tracks playlist_tracks_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: playlist_tracks playlist_tracks_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_tracks
    ADD CONSTRAINT playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: playlists playlists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: playlists playlists_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_link_sessions shared_link_sessions_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_link_sessions
    ADD CONSTRAINT shared_link_sessions_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.shared_links(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shared_links shared_links_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: shared_links shared_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_links
    ADD CONSTRAINT shared_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: signature_requests signature_requests_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signature_requests
    ADD CONSTRAINT signature_requests_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: stems stems_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stems
    ADD CONSTRAINT stems_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: stems stems_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stems
    ADD CONSTRAINT stems_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stems stems_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stems
    ADD CONSTRAINT stems_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: studio_submissions studio_submissions_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.studio_submissions
    ADD CONSTRAINT studio_submissions_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_beta_pass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_beta_pass_id_fkey FOREIGN KEY (beta_pass_id) REFERENCES public.beta_passes(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: track_comments track_comments_shared_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_comments
    ADD CONSTRAINT track_comments_shared_link_id_fkey FOREIGN KEY (shared_link_id) REFERENCES public.shared_links(id) ON DELETE SET NULL;


--
-- Name: track_comments track_comments_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_comments
    ADD CONSTRAINT track_comments_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_comments track_comments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_comments
    ADD CONSTRAINT track_comments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: track_documents track_documents_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_documents
    ADD CONSTRAINT track_documents_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_documents track_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_documents
    ADD CONSTRAINT track_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: track_documents track_documents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_documents
    ADD CONSTRAINT track_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: track_ratings track_ratings_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_ratings
    ADD CONSTRAINT track_ratings_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: track_ratings track_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_ratings
    ADD CONSTRAINT track_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: track_ratings track_ratings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_ratings
    ADD CONSTRAINT track_ratings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: track_versions track_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: track_versions track_versions_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;


--
-- Name: tracks tracks_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tracks tracks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: waitlist waitlist_invitation_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_invitation_sent_by_fkey FOREIGN KEY (invitation_sent_by) REFERENCES auth.users(id);


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_workspace_role(( SELECT auth.uid() AS uid), workspace_id, 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(( SELECT auth.uid() AS uid), workspace_id, 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_workspace_role(( SELECT auth.uid() AS uid), workspace_id, 'admin'::public.app_role));


--
-- Name: user_roles Admins can view workspace roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view workspace roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_workspace_role(( SELECT auth.uid() AS uid), workspace_id, 'admin'::public.app_role));


--
-- Name: waitlist Allow anon insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon insert" ON public.waitlist FOR INSERT TO anon WITH CHECK (true);


--
-- Name: link_events Anonymous users can insert link events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can insert link events" ON public.link_events FOR INSERT TO anon WITH CHECK (true);


--
-- Name: link_downloads Anyone can log a download for valid links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can log a download for valid links" ON public.link_downloads FOR INSERT TO authenticated, anon WITH CHECK ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.id = link_downloads.link_id) AND (sl.status = 'active'::public.link_status)))));


--
-- Name: workspaces Authenticated users can create workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: link_events Authenticated users can insert link events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert link events" ON public.link_events FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: workspace_members Members can leave workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can leave workspace" ON public.workspace_members FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: approvals Members can view approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view approvals" ON public.approvals FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: catalog_shares Members can view catalog shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view catalog shares" ON public.catalog_shares FOR SELECT USING ((public.is_workspace_member(( SELECT auth.uid() AS uid), source_workspace_id) OR public.is_workspace_member(( SELECT auth.uid() AS uid), target_workspace_id)));


--
-- Name: contacts Members can view contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view contacts" ON public.contacts FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: link_downloads Members can view link downloads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view link downloads" ON public.link_downloads FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.shared_links sl
  WHERE ((sl.id = link_downloads.link_id) AND public.is_workspace_member(( SELECT auth.uid() AS uid), sl.workspace_id)))));


--
-- Name: pitches Members can view pitches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view pitches" ON public.pitches FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: playlist_tracks Members can view playlist tracks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view playlist tracks" ON public.playlist_tracks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.playlists p
  WHERE ((p.id = playlist_tracks.playlist_id) AND public.is_workspace_member(( SELECT auth.uid() AS uid), p.workspace_id)))));


--
-- Name: playlists Members can view playlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view playlists" ON public.playlists FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: shared_links Members can view shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view shared links" ON public.shared_links FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: stems Members can view stems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view stems" ON public.stems FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: workspace_members Members can view team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view team" ON public.workspace_members FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: workspaces Members can view their workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their workspace" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), id));


--
-- Name: tracks Members can view tracks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view tracks" ON public.tracks FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: workspaces Owner can delete workspace; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can delete workspace" ON public.workspaces FOR DELETE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: catalog_shares Source workspace members can delete shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Source workspace members can delete shares" ON public.catalog_shares FOR DELETE USING (public.is_workspace_member(( SELECT auth.uid() AS uid), source_workspace_id));


--
-- Name: catalog_shares Source workspace members can share; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Source workspace members can share" ON public.catalog_shares FOR INSERT WITH CHECK (public.is_workspace_member(( SELECT auth.uid() AS uid), source_workspace_id));


--
-- Name: catalog_shares Source workspace members can update shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Source workspace members can update shares" ON public.catalog_shares FOR UPDATE USING (public.is_workspace_member(( SELECT auth.uid() AS uid), source_workspace_id));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notification_preferences Users can insert their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications Users can mark own notifications read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own notifications read" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: leak_traces Users can read own workspace traces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own workspace traces" ON public.leak_traces FOR SELECT USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: notification_preferences Users can update their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: credit_purchases Users can view own credit purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own credit purchases" ON public.credit_purchases FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: workspace_members Users can view own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own memberships" ON public.workspace_members FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: subscriptions Users can view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: notification_preferences Users can view their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own preferences" ON public.notification_preferences FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: shared_links Workspace members can view shared links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace members can view shared links" ON public.shared_links FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: invitations anon_read_invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_invitations ON public.invitations FOR SELECT TO anon USING (((status = 'pending'::text) AND (expires_at > now())));


--
-- Name: playlist_tracks anon_read_playlist_tracks_via_shared_link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_playlist_tracks_via_shared_link ON public.playlist_tracks FOR SELECT TO anon USING ((playlist_id IN ( SELECT shared_links.playlist_id
   FROM public.shared_links
  WHERE ((shared_links.status = 'active'::public.link_status) AND (shared_links.playlist_id IS NOT NULL)))));


--
-- Name: playlists anon_read_playlists_via_shared_link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_playlists_via_shared_link ON public.playlists FOR SELECT TO anon USING (public.playlist_has_active_shared_link(id));


--
-- Name: workspaces anon_read_workspace_branding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_workspace_branding ON public.workspaces FOR SELECT TO anon USING ((id IN ( SELECT shared_links.workspace_id
   FROM public.shared_links
  WHERE (shared_links.status = 'active'::public.link_status))));


--
-- Name: signature_requests anon_sign; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_sign ON public.signature_requests FOR UPDATE TO anon USING (false) WITH CHECK (false);


--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals approvals_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_delete_admin ON public.approvals FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: approvals approvals_insert_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_insert_member ON public.approvals FOR INSERT TO authenticated WITH CHECK ((public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id) AND (requested_by = ( SELECT auth.uid() AS uid))));


--
-- Name: approvals approvals_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_update_admin ON public.approvals FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: artist_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artist_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: artist_aliases artist_aliases_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artist_aliases_delete_admin ON public.artist_aliases FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: artist_aliases artist_aliases_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artist_aliases_insert_pitcher ON public.artist_aliases FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: artist_aliases artist_aliases_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artist_aliases_select_members ON public.artist_aliases FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM public.workspace_members
  WHERE (workspace_members.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: artist_aliases artist_aliases_update_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY artist_aliases_update_editor ON public.artist_aliases FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_submissions auth_all_submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_submissions ON public.studio_submissions TO authenticated USING ((track_id IN ( SELECT tracks.id
   FROM public.tracks
  WHERE (tracks.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: signature_requests auth_manage_signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_manage_signatures ON public.signature_requests TO authenticated USING ((track_id IN ( SELECT tracks.id
   FROM public.tracks
  WHERE (tracks.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: beta_passes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_passes ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalog_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_delete_admin ON public.contacts FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: contacts contacts_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_insert_pitcher ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: contacts contacts_update_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_update_pitcher ON public.contacts FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: credit_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs jobs_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_select_members ON public.jobs FOR SELECT TO authenticated USING (((workspace_id IS NOT NULL) AND public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id)));


--
-- Name: leak_traces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leak_traces ENABLE ROW LEVEL SECURITY;

--
-- Name: link_downloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_downloads ENABLE ROW LEVEL SECURITY;

--
-- Name: link_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_events ENABLE ROW LEVEL SECURITY;

--
-- Name: link_events link_events_select_workspace_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY link_events_select_workspace_member ON public.link_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.shared_links sl
     JOIN public.workspace_members wm ON ((wm.workspace_id = sl.workspace_id)))
  WHERE ((sl.id = link_events.link_id) AND (wm.user_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: marketplace_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_requests mr_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_owner_select ON public.marketplace_requests FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), owner_workspace_id));


--
-- Name: marketplace_requests mr_requester_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_requester_select ON public.marketplace_requests FOR SELECT TO authenticated USING ((requester_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: pitches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

--
-- Name: pitches pitches_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pitches_delete_admin ON public.pitches FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: pitches pitches_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pitches_insert_pitcher ON public.pitches FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text) AND (sent_by = ( SELECT auth.uid() AS uid))));


--
-- Name: pitches pitches_update_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pitches_update_pitcher ON public.pitches FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: plan_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_limits plan_limits public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan_limits public read" ON public.plan_limits FOR SELECT TO authenticated, anon USING (true);


--
-- Name: playlist_tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: playlist_tracks playlist_tracks_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlist_tracks_delete_admin ON public.playlist_tracks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.playlists p
  WHERE ((p.id = playlist_tracks.playlist_id) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), p.workspace_id, 'admin'::text)))));


--
-- Name: playlist_tracks playlist_tracks_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlist_tracks_insert_pitcher ON public.playlist_tracks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.playlists p
  WHERE ((p.id = playlist_tracks.playlist_id) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), p.workspace_id, 'pitcher'::text)))));


--
-- Name: playlist_tracks playlist_tracks_update_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlist_tracks_update_pitcher ON public.playlist_tracks FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.playlists p
  WHERE ((p.id = playlist_tracks.playlist_id) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), p.workspace_id, 'pitcher'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.playlists p
  WHERE ((p.id = playlist_tracks.playlist_id) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), p.workspace_id, 'pitcher'::text)))));


--
-- Name: playlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

--
-- Name: playlists playlists_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlists_delete_admin ON public.playlists FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: playlists playlists_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlists_insert_pitcher ON public.playlists FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: playlists playlists_update_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY playlists_update_pitcher ON public.playlists FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_self_or_comember; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_self_or_comember ON public.profiles FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.workspace_members me
     JOIN public.workspace_members them ON ((them.workspace_id = me.workspace_id)))
  WHERE ((me.user_id = ( SELECT auth.uid() AS uid)) AND (them.user_id = profiles.id))))));


--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_link_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_link_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_links shared_links_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_links_delete_admin ON public.shared_links FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: shared_links shared_links_delete_pitcher_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_links_delete_pitcher_own ON public.shared_links FOR DELETE TO authenticated USING (((created_by = ( SELECT auth.uid() AS uid)) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)));


--
-- Name: shared_links shared_links_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_links_insert_pitcher ON public.shared_links FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: shared_links shared_links_update_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_links_update_pitcher ON public.shared_links FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text));


--
-- Name: signature_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: site_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: stems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stems ENABLE ROW LEVEL SECURITY;

--
-- Name: stems stems_delete_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stems_delete_editor ON public.stems FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text));


--
-- Name: stems stems_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stems_insert_pitcher ON public.stems FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text) AND (uploaded_by = ( SELECT auth.uid() AS uid))));


--
-- Name: stems stems_update_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stems_update_editor ON public.stems FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text));


--
-- Name: stripe_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_prices stripe_prices public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stripe_prices public read" ON public.stripe_prices FOR SELECT TO authenticated, anon USING (true);


--
-- Name: stripe_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.studio_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: studio_submissions studio_submissions_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_submissions_anon_insert ON public.studio_submissions FOR INSERT TO anon WITH CHECK (((EXISTS ( SELECT 1
   FROM public.tracks
  WHERE ((tracks.id = studio_submissions.track_id) AND (tracks.qr_token IS NOT NULL)))) AND (email IS NOT NULL) AND (length(btrim(email)) > 0) AND (full_name IS NOT NULL) AND (length(btrim(full_name)) > 0)));


--
-- Name: studio_submissions studio_submissions_anon_select_by_track; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY studio_submissions_anon_select_by_track ON public.studio_submissions FOR SELECT TO anon USING ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE ((t.qr_token IS NOT NULL) AND (t.id = studio_submissions.track_id)))));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: track_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.track_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: track_comments track_comments_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_comments_anon_select ON public.track_comments FOR SELECT TO anon USING (((shared_link_id IS NOT NULL) AND (shared_link_id IN ( SELECT shared_links.id
   FROM public.shared_links
  WHERE (shared_links.status = 'active'::public.link_status)))));


--
-- Name: track_comments track_comments_delete_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_comments_delete_editor ON public.track_comments FOR DELETE TO authenticated USING ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.has_workspace_access_level(( SELECT auth.uid() AS uid), t.workspace_id, 'editor'::text))));


--
-- Name: track_comments track_comments_insert_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_comments_insert_members ON public.track_comments FOR INSERT TO authenticated WITH CHECK ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.is_workspace_member(( SELECT auth.uid() AS uid), t.workspace_id))));


--
-- Name: track_comments track_comments_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_comments_select_members ON public.track_comments FOR SELECT TO authenticated USING ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.is_workspace_member(( SELECT auth.uid() AS uid), t.workspace_id))));


--
-- Name: track_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.track_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: track_documents track_documents_delete_uploader_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_documents_delete_uploader_or_admin ON public.track_documents FOR DELETE TO authenticated USING (((uploaded_by = ( SELECT auth.uid() AS uid)) OR public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text)));


--
-- Name: track_documents track_documents_insert_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_documents_insert_editor ON public.track_documents FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text) AND (uploaded_by = ( SELECT auth.uid() AS uid))));


--
-- Name: track_documents track_documents_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_documents_select_members ON public.track_documents FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: track_documents track_documents_update_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_documents_update_editor ON public.track_documents FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text));


--
-- Name: track_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: track_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.track_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: track_versions track_versions_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_versions_delete_admin ON public.track_versions FOR DELETE TO authenticated USING ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.has_workspace_access_level(( SELECT auth.uid() AS uid), t.workspace_id, 'admin'::text))));


--
-- Name: track_versions track_versions_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_versions_insert_pitcher ON public.track_versions FOR INSERT TO authenticated WITH CHECK ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.has_workspace_access_level(( SELECT auth.uid() AS uid), t.workspace_id, 'pitcher'::text))));


--
-- Name: track_versions track_versions_select_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_versions_select_members ON public.track_versions FOR SELECT TO authenticated USING ((track_id IN ( SELECT tracks.id
   FROM public.tracks
  WHERE (tracks.workspace_id IN ( SELECT workspace_members.workspace_id
           FROM public.workspace_members
          WHERE (workspace_members.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: track_versions track_versions_update_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY track_versions_update_editor ON public.track_versions FOR UPDATE TO authenticated USING ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.has_workspace_access_level(( SELECT auth.uid() AS uid), t.workspace_id, 'editor'::text)))) WITH CHECK ((track_id IN ( SELECT t.id
   FROM public.tracks t
  WHERE public.has_workspace_access_level(( SELECT auth.uid() AS uid), t.workspace_id, 'editor'::text))));


--
-- Name: tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: tracks tracks_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracks_delete_admin ON public.tracks FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: tracks tracks_insert_pitcher; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracks_insert_pitcher ON public.tracks FOR INSERT TO authenticated WITH CHECK ((public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text) AND (uploaded_by = ( SELECT auth.uid() AS uid))));


--
-- Name: tracks tracks_update_editor_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracks_update_editor_all ON public.tracks FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'editor'::text));


--
-- Name: tracks tracks_update_pitcher_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tracks_update_pitcher_own ON public.tracks FOR UPDATE TO authenticated USING (((uploaded_by = ( SELECT auth.uid() AS uid)) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text))) WITH CHECK (((uploaded_by = ( SELECT auth.uid() AS uid)) AND public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'pitcher'::text)));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: watermark_payloads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watermark_payloads ENABLE ROW LEVEL SECURITY;

--
-- Name: whitelisted_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: track_ratings workspace members can manage own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workspace members can manage own ratings" ON public.track_ratings USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: track_ratings workspace members can read all ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "workspace members can read all ratings" ON public.track_ratings FOR SELECT TO authenticated USING (public.is_workspace_member(( SELECT auth.uid() AS uid), workspace_id));


--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_members workspace_members_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_delete_admin ON public.workspace_members FOR DELETE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: workspace_members workspace_members_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_insert_admin ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: workspace_members workspace_members_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_update_admin ON public.workspace_members FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), workspace_id, 'admin'::text));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_update_admin ON public.workspaces FOR UPDATE TO authenticated USING (public.has_workspace_access_level(( SELECT auth.uid() AS uid), id, 'admin'::text)) WITH CHECK (public.has_workspace_access_level(( SELECT auth.uid() AS uid), id, 'admin'::text));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION add_contact_manual(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_contact_manual(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text) TO authenticated;
GRANT ALL ON FUNCTION public.add_contact_manual(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text) TO service_role;


--
-- Name: FUNCTION add_contact_manual_legacy_v0(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_contact_manual_legacy_v0(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_contact_manual_legacy_v0(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _city text, _country text, _stage_name text) TO service_role;


--
-- Name: FUNCTION add_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.add_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO service_role;


--
-- Name: FUNCTION add_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO service_role;


--
-- Name: FUNCTION add_to_whitelist(_user_id uuid, _email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_to_whitelist(_user_id uuid, _email text) TO authenticated;
GRANT ALL ON FUNCTION public.add_to_whitelist(_user_id uuid, _email text) TO service_role;


--
-- Name: FUNCTION add_track_comment(_track_id uuid, _author_name text, _author_email text, _author_type text, _timestamp_sec numeric, _content text, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_track_comment(_track_id uuid, _author_name text, _author_email text, _author_type text, _timestamp_sec numeric, _content text, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.add_track_comment(_track_id uuid, _author_name text, _author_email text, _author_type text, _timestamp_sec numeric, _content text, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION add_track_comment_legacy_v0(_track_id uuid, _user_id uuid, _content text, _timecode numeric, _visitor_name text, _visitor_email text, _shared_link_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_track_comment_legacy_v0(_track_id uuid, _user_id uuid, _content text, _timecode numeric, _visitor_name text, _visitor_email text, _shared_link_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_track_comment_legacy_v0(_track_id uuid, _user_id uuid, _content text, _timecode numeric, _visitor_name text, _visitor_email text, _shared_link_id uuid) TO service_role;


--
-- Name: FUNCTION add_track_version(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text, _audio_url text, _audio_preview_url text, _waveform_data jsonb, _sonic_dna jsonb, _duration_sec numeric, _notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_track_version(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text, _audio_url text, _audio_preview_url text, _waveform_data jsonb, _sonic_dna jsonb, _duration_sec numeric, _notes text) TO anon;
GRANT ALL ON FUNCTION public.add_track_version(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text, _audio_url text, _audio_preview_url text, _waveform_data jsonb, _sonic_dna jsonb, _duration_sec numeric, _notes text) TO authenticated;
GRANT ALL ON FUNCTION public.add_track_version(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_name text, _audio_url text, _audio_preview_url text, _waveform_data jsonb, _sonic_dna jsonb, _duration_sec numeric, _notes text) TO service_role;


--
-- Name: FUNCTION assert_caller(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.assert_caller(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.assert_caller(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.assert_caller(_user_id uuid) TO service_role;


--
-- Name: FUNCTION assert_shared_link_access(_link_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assert_shared_link_access(_link_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assert_shared_link_access(_link_id uuid) TO service_role;


--
-- Name: FUNCTION assert_shared_link_access_by_slug(_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assert_shared_link_access_by_slug(_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assert_shared_link_access_by_slug(_slug text) TO service_role;


--
-- Name: FUNCTION auto_create_alias_from_stage_name(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_create_alias_from_stage_name() TO authenticated;
GRANT ALL ON FUNCTION public.auto_create_alias_from_stage_name() TO service_role;


--
-- Name: FUNCTION bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb) TO anon;
GRANT ALL ON FUNCTION public.bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb) TO service_role;


--
-- Name: FUNCTION check_rate_limit(_key text, _max_requests integer, _window_seconds integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_rate_limit(_key text, _max_requests integer, _window_seconds integer) TO anon;
GRANT ALL ON FUNCTION public.check_rate_limit(_key text, _max_requests integer, _window_seconds integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(_key text, _max_requests integer, _window_seconds integer) TO service_role;


--
-- Name: FUNCTION check_smart_ar_quota(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_smart_ar_quota(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_smart_ar_quota(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_smart_ar_quota(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_smart_ar_quota(_user_id uuid) TO service_role;


--
-- Name: FUNCTION check_upload_allowed(_file_size_bytes bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_upload_allowed(_file_size_bytes bigint) TO authenticated;
GRANT ALL ON FUNCTION public.check_upload_allowed(_file_size_bytes bigint) TO service_role;


--
-- Name: TABLE jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.jobs TO service_role;
GRANT SELECT ON TABLE public.jobs TO authenticated;


--
-- Name: FUNCTION claim_jobs(_worker_id text, _job_types text[], _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_jobs(_worker_id text, _job_types text[], _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_jobs(_worker_id text, _job_types text[], _limit integer) TO service_role;


--
-- Name: FUNCTION clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid) TO anon;
GRANT ALL ON FUNCTION public.clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clean_revoked_playlist_tracks(_source_workspace_id uuid, _target_workspace_id uuid, _track_id uuid) TO service_role;


--
-- Name: FUNCTION cleanup_rate_limits(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_rate_limits() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_rate_limits() TO service_role;


--
-- Name: FUNCTION complete_job(_job_id uuid, _result jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_job(_job_id uuid, _result jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_job(_job_id uuid, _result jsonb) TO service_role;


--
-- Name: FUNCTION create_notification(_actor_user_id uuid, _target_user_id uuid, _workspace_id uuid, _type text, _title text, _message text, _track_id uuid, _pitch_id uuid, _link_id uuid, _approval_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_notification(_actor_user_id uuid, _target_user_id uuid, _workspace_id uuid, _type text, _title text, _message text, _track_id uuid, _pitch_id uuid, _link_id uuid, _approval_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(_actor_user_id uuid, _target_user_id uuid, _workspace_id uuid, _type text, _title text, _message text, _track_id uuid, _pitch_id uuid, _link_id uuid, _approval_id uuid) TO service_role;


--
-- Name: FUNCTION create_pitch(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_pitch(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.create_pitch(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION create_pitch_legacy_v0(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_pitch_legacy_v0(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_pitch_legacy_v0(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text, _recipient_company text, _subject text, _message text, _track_ids uuid[], _status text, _sent_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION create_playlist(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_playlist(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text) TO authenticated;
GRANT ALL ON FUNCTION public.create_playlist(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text) TO service_role;


--
-- Name: FUNCTION create_playlist_legacy_v0(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_playlist_legacy_v0(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_playlist_legacy_v0(_user_id uuid, _workspace_id uuid, _name text, _description text, _cover_url text) TO service_role;


--
-- Name: FUNCTION create_shared_link(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_shared_link(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean) TO authenticated;
GRANT ALL ON FUNCTION public.create_shared_link(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean) TO service_role;


--
-- Name: FUNCTION create_shared_link_legacy_v0(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_shared_link_legacy_v0(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_shared_link_legacy_v0(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid, _playlist_id uuid, _link_name text, _link_slug text, _link_type text, _password_hash text, _message text, _allow_download boolean, _allow_save boolean, _download_quality text, _expires_at timestamp with time zone, _pack_items text, _watermarking_enabled boolean, _gate_screen_enabled boolean) TO service_role;


--
-- Name: FUNCTION create_shared_link_session(_link_id uuid, _ttl_hours integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_shared_link_session(_link_id uuid, _ttl_hours integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_shared_link_session(_link_id uuid, _ttl_hours integer) TO service_role;


--
-- Name: FUNCTION create_workspace_with_member(_name text, _description text, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_workspace_with_member(_name text, _description text, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_workspace_with_member(_name text, _description text, _user_id uuid) TO service_role;


--
-- Name: FUNCTION delete_artist_alias(_user_id uuid, _workspace_id uuid, _alias_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_artist_alias(_user_id uuid, _workspace_id uuid, _alias_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_artist_alias(_user_id uuid, _workspace_id uuid, _alias_id uuid) TO service_role;


--
-- Name: FUNCTION delete_contact(_user_id uuid, _contact_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_contact(_user_id uuid, _contact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_contact(_user_id uuid, _contact_id uuid) TO service_role;


--
-- Name: FUNCTION delete_contacts(_user_id uuid, _workspace_id uuid, _ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_contacts(_user_id uuid, _workspace_id uuid, _ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.delete_contacts(_user_id uuid, _workspace_id uuid, _ids uuid[]) TO service_role;


--
-- Name: FUNCTION delete_leak_trace(_trace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_leak_trace(_trace_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_leak_trace(_trace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_leak_trace(_trace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION delete_playlist(_user_id uuid, _playlist_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_playlist(_user_id uuid, _playlist_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_playlist(_user_id uuid, _playlist_id uuid) TO service_role;


--
-- Name: FUNCTION delete_playlist_legacy_v0(_user_id uuid, _playlist_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_playlist_legacy_v0(_user_id uuid, _playlist_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_playlist_legacy_v0(_user_id uuid, _playlist_id uuid) TO service_role;


--
-- Name: FUNCTION delete_stem(_user_id uuid, _stem_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_stem(_user_id uuid, _stem_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_stem(_user_id uuid, _stem_id uuid) TO service_role;


--
-- Name: FUNCTION delete_stem_legacy_v0(_user_id uuid, _stem_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_stem_legacy_v0(_user_id uuid, _stem_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_stem_legacy_v0(_user_id uuid, _stem_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track(_user_id uuid, _track_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track(_user_id uuid, _track_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track(_user_id uuid, _track_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_comment(_comment_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track_comment(_comment_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track_comment(_comment_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_comment_via_token(_comment_id uuid, _shared_link_token text, _author_secret text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track_comment_via_token(_comment_id uuid, _shared_link_token text, _author_secret text) TO anon;
GRANT ALL ON FUNCTION public.delete_track_comment_via_token(_comment_id uuid, _shared_link_token text, _author_secret text) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track_comment_via_token(_comment_id uuid, _shared_link_token text, _author_secret text) TO service_role;


--
-- Name: FUNCTION delete_track_document(_user_id uuid, _doc_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track_document(_user_id uuid, _doc_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track_document(_user_id uuid, _doc_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_document_legacy_v0(_user_id uuid, _doc_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_track_document_legacy_v0(_user_id uuid, _doc_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_track_document_legacy_v0(_user_id uuid, _doc_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_legacy_v0(_user_id uuid, _track_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_track_legacy_v0(_user_id uuid, _track_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_track_legacy_v0(_user_id uuid, _track_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_version(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track_version(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track_version(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION delete_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION delete_workspace(_user_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_workspace(_user_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_workspace(_user_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION edit_track_comment(_comment_id uuid, _user_id uuid, _new_content text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.edit_track_comment(_comment_id uuid, _user_id uuid, _new_content text) TO authenticated;
GRANT ALL ON FUNCTION public.edit_track_comment(_comment_id uuid, _user_id uuid, _new_content text) TO service_role;


--
-- Name: FUNCTION enforce_pitch_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_pitch_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_pitch_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_pitch_limit() TO service_role;


--
-- Name: FUNCTION enforce_seat_limit_invitation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_seat_limit_invitation() TO anon;
GRANT ALL ON FUNCTION public.enforce_seat_limit_invitation() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_seat_limit_invitation() TO service_role;


--
-- Name: FUNCTION enforce_seat_limit_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_seat_limit_member() TO anon;
GRANT ALL ON FUNCTION public.enforce_seat_limit_member() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_seat_limit_member() TO service_role;


--
-- Name: FUNCTION enforce_track_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_track_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_track_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_track_limit() TO service_role;


--
-- Name: FUNCTION enforce_workspace_limit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_workspace_limit() TO anon;
GRANT ALL ON FUNCTION public.enforce_workspace_limit() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_workspace_limit() TO service_role;


--
-- Name: FUNCTION enqueue_job(_job_type text, _payload jsonb, _workspace_id uuid, _created_by uuid, _dedupe_key text, _priority integer, _max_attempts integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_job(_job_type text, _payload jsonb, _workspace_id uuid, _created_by uuid, _dedupe_key text, _priority integer, _max_attempts integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_job(_job_type text, _payload jsonb, _workspace_id uuid, _created_by uuid, _dedupe_key text, _priority integer, _max_attempts integer) TO service_role;


--
-- Name: FUNCTION fail_job(_job_id uuid, _error text, _retry boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fail_job(_job_id uuid, _error text, _retry boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fail_job(_job_id uuid, _error text, _retry boolean) TO service_role;


--
-- Name: FUNCTION get_admin_overview(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_admin_overview(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_overview(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_artist_aliases(_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_artist_aliases(_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_artist_aliases(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_artist_aliases(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_contacts_engagement(_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_contacts_engagement(_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_contacts_engagement(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_contacts_engagement(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_my_subscription(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_subscription() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_subscription() TO service_role;


--
-- Name: FUNCTION get_playlist_meta_for_shared_link(_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_playlist_meta_for_shared_link(_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_playlist_meta_for_shared_link(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_playlist_meta_for_shared_link(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_playlist_meta_for_shared_link(_slug text) TO service_role;


--
-- Name: FUNCTION get_playlist_tracks_for_shared_link(_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_playlist_tracks_for_shared_link(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_playlist_tracks_for_shared_link(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_playlist_tracks_for_shared_link(_slug text) TO service_role;


--
-- Name: FUNCTION get_shared_link_by_id(_link_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_link_by_id(_link_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_shared_link_by_id(_link_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_shared_link_by_id(_link_id uuid) TO service_role;


--
-- Name: FUNCTION get_shared_link_by_slug(_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_link_by_slug(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_shared_link_by_slug(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_shared_link_by_slug(_slug text) TO service_role;


--
-- Name: TABLE tracks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tracks TO anon;
GRANT ALL ON TABLE public.tracks TO authenticated;
GRANT ALL ON TABLE public.tracks TO service_role;


--
-- Name: FUNCTION get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_shared_playlist_tracks(_playlist_id uuid, _target_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_shared_workspace_playlists(_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_workspace_playlists(_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_shared_workspace_playlists(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_shared_workspace_playlists(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_shared_workspace_tracks(_source_workspace_id uuid, _target_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_signature_agreement_by_token(_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_signature_agreement_by_token(_token text) TO anon;
GRANT ALL ON FUNCTION public.get_signature_agreement_by_token(_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_signature_agreement_by_token(_token text) TO service_role;


--
-- Name: FUNCTION get_track_by_qr_token(_qr_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_track_by_qr_token(_qr_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_track_by_qr_token(_qr_token text) TO anon;
GRANT ALL ON FUNCTION public.get_track_by_qr_token(_qr_token text) TO authenticated;
GRANT ALL ON FUNCTION public.get_track_by_qr_token(_qr_token text) TO service_role;


--
-- Name: TABLE track_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.track_comments TO anon;
GRANT ALL ON TABLE public.track_comments TO authenticated;
GRANT ALL ON TABLE public.track_comments TO service_role;


--
-- Name: FUNCTION get_track_comments(_track_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_track_comments(_track_id uuid, _workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_track_comments(_track_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_track_comments(_track_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_track_for_shared_link(_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_track_for_shared_link(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_track_for_shared_link(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_track_for_shared_link(_slug text) TO service_role;


--
-- Name: FUNCTION get_track_rating_stats(_track_id uuid, _workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_track_rating_stats(_track_id uuid, _workspace_id uuid, _user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_track_rating_stats(_track_id uuid, _workspace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_track_rating_stats(_track_id uuid, _workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION get_tracks_for_shared_link(_link_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_tracks_for_shared_link(_link_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_tracks_for_shared_link(_link_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_tracks_for_shared_link(_link_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_tracks_for_shared_link(_link_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_workspaces(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_workspaces(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_workspaces(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_workspaces(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_visit_stats(_user_id uuid, _days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_visit_stats(_user_id uuid, _days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_visit_stats(_user_id uuid, _days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_visit_stats(_user_id uuid, _days integer) TO service_role;


--
-- Name: FUNCTION get_waitlist_signups_30d(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_waitlist_signups_30d(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_waitlist_signups_30d(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_workspace_branding_for_shared_link(_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_workspace_branding_for_shared_link(_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_branding_for_shared_link(_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_branding_for_shared_link(_slug text) TO service_role;


--
-- Name: FUNCTION get_workspace_catalog_shares(_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_workspace_epk_by_slug(_workspace_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_workspace_epk_by_slug(_workspace_slug text) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_epk_by_slug(_workspace_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_epk_by_slug(_workspace_slug text) TO service_role;


--
-- Name: FUNCTION get_workspace_seats(_workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_workspace_seats(_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_workspace_seats(_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_seats(_workspace_id uuid) TO service_role;


--
-- Name: FUNCTION get_workspace_tracks(_workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_workspace_tracks(_workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_new_user_subscription(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user_subscription() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user_subscription() TO service_role;


--
-- Name: FUNCTION handle_user_updated(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_user_updated() TO authenticated;
GRANT ALL ON FUNCTION public.handle_user_updated() TO service_role;


--
-- Name: FUNCTION has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]) TO authenticated;
GRANT ALL ON FUNCTION public.has_any_workspace_role(_user_id uuid, _workspace_id uuid, _roles public.app_role[]) TO service_role;


--
-- Name: FUNCTION has_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) TO authenticated;
GRANT ALL ON FUNCTION public.has_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) TO service_role;


--
-- Name: FUNCTION has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION increment_smart_ar_usage(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_smart_ar_usage(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_smart_ar_usage(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_smart_ar_usage(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_smart_ar_usage(_user_id uuid) TO service_role;


--
-- Name: FUNCTION insert_approval(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_approval(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.insert_approval(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid) TO service_role;


--
-- Name: FUNCTION insert_approval_legacy_v0(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.insert_approval_legacy_v0(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.insert_approval_legacy_v0(_user_id uuid, _workspace_id uuid, _track_id uuid, _send_type text, _team_id uuid) TO service_role;


--
-- Name: FUNCTION insert_catalog_share(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_catalog_share(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_catalog_share(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO service_role;


--
-- Name: FUNCTION insert_catalog_share_legacy_v0(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.insert_catalog_share_legacy_v0(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.insert_catalog_share_legacy_v0(_user_id uuid, _track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO service_role;


--
-- Name: FUNCTION insert_stem(_user_id uuid, _track_id uuid, _name text, _file_url text, _file_size bigint, _stem_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_stem(_user_id uuid, _track_id uuid, _name text, _file_url text, _file_size bigint, _stem_type text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_stem(_user_id uuid, _track_id uuid, _name text, _file_url text, _file_size bigint, _stem_type text) TO service_role;


--
-- Name: FUNCTION insert_track(_user_id uuid, _workspace_id uuid, _title text, _artist text, _featuring text, _type text, _status text, _bpm numeric, _key text, _duration_sec numeric, _genre text[], _mood text[], _language text, _gender text, _labels text[], _publishers text[], _audio_url text, _audio_preview_url text, _cover_art_url text, _lyrics text, _notes text, _splits jsonb, _isrc text, _waveform_data jsonb, _released_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_track(_user_id uuid, _workspace_id uuid, _title text, _artist text, _featuring text, _type text, _status text, _bpm numeric, _key text, _duration_sec numeric, _genre text[], _mood text[], _language text, _gender text, _labels text[], _publishers text[], _audio_url text, _audio_preview_url text, _cover_art_url text, _lyrics text, _notes text, _splits jsonb, _isrc text, _waveform_data jsonb, _released_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.insert_track(_user_id uuid, _workspace_id uuid, _title text, _artist text, _featuring text, _type text, _status text, _bpm numeric, _key text, _duration_sec numeric, _genre text[], _mood text[], _language text, _gender text, _labels text[], _publishers text[], _audio_url text, _audio_preview_url text, _cover_art_url text, _lyrics text, _notes text, _splits jsonb, _isrc text, _waveform_data jsonb, _released_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION insert_track_comment_via_token(_track_id uuid, _shared_link_token text, _content text, _author_name text, _author_email text, _timestamp_sec numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_track_comment_via_token(_track_id uuid, _shared_link_token text, _content text, _author_name text, _author_email text, _timestamp_sec numeric) TO anon;
GRANT ALL ON FUNCTION public.insert_track_comment_via_token(_track_id uuid, _shared_link_token text, _content text, _author_name text, _author_email text, _timestamp_sec numeric) TO authenticated;
GRANT ALL ON FUNCTION public.insert_track_comment_via_token(_track_id uuid, _shared_link_token text, _content text, _author_name text, _author_email text, _timestamp_sec numeric) TO service_role;


--
-- Name: FUNCTION insert_track_document(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.insert_track_document(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_track_document(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text) TO service_role;


--
-- Name: FUNCTION insert_track_document_legacy_v0(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.insert_track_document_legacy_v0(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.insert_track_document_legacy_v0(_user_id uuid, _track_id uuid, _name text, _file_path text, _file_size bigint, _doc_type text, _file_name text, _mime_type text) TO service_role;


--
-- Name: FUNCTION is_email_whitelisted(_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_email_whitelisted(_email text) TO anon;
GRANT ALL ON FUNCTION public.is_email_whitelisted(_email text) TO authenticated;
GRANT ALL ON FUNCTION public.is_email_whitelisted(_email text) TO service_role;


--
-- Name: FUNCTION is_platform_admin(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_platform_admin(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin(_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_workspace_member(_user_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION leave_workspace(_user_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.leave_workspace(_user_id uuid, _workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.leave_workspace(_user_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.leave_workspace(_user_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION list_all_contacts(_user_id uuid, _limit integer, _offset integer, _search text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_all_contacts(_user_id uuid, _limit integer, _offset integer, _search text) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_contacts(_user_id uuid, _limit integer, _offset integer, _search text) TO service_role;


--
-- Name: FUNCTION list_all_users(_user_id uuid, _limit integer, _offset integer, _search text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_all_users(_user_id uuid, _limit integer, _offset integer, _search text) TO authenticated;
GRANT ALL ON FUNCTION public.list_all_users(_user_id uuid, _limit integer, _offset integer, _search text) TO service_role;


--
-- Name: FUNCTION list_waitlist_signups(_user_id uuid, _limit integer, _offset integer, _search text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_waitlist_signups(_user_id uuid, _limit integer, _offset integer, _search text) TO authenticated;
GRANT ALL ON FUNCTION public.list_waitlist_signups(_user_id uuid, _limit integer, _offset integer, _search text) TO service_role;


--
-- Name: FUNCTION log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb) TO anon;
GRANT ALL ON FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.log_audit_event(_user_id uuid, _action text, _resource_type text, _resource_id uuid, _metadata jsonb) TO service_role;


--
-- Name: FUNCTION log_site_visit(_path text, _referrer text, _utm_source text, _utm_medium text, _utm_campaign text, _visitor_id text, _session_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_site_visit(_path text, _referrer text, _utm_source text, _utm_medium text, _utm_campaign text, _visitor_id text, _session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_site_visit(_path text, _referrer text, _utm_source text, _utm_medium text, _utm_campaign text, _visitor_id text, _session_id text) TO anon;
GRANT ALL ON FUNCTION public.log_site_visit(_path text, _referrer text, _utm_source text, _utm_medium text, _utm_campaign text, _visitor_id text, _session_id text) TO authenticated;
GRANT ALL ON FUNCTION public.log_site_visit(_path text, _referrer text, _utm_source text, _utm_medium text, _utm_campaign text, _visitor_id text, _session_id text) TO service_role;


--
-- Name: FUNCTION mark_onboarding_complete(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_onboarding_complete(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_onboarding_complete(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_onboarding_complete(_user_id uuid) TO service_role;


--
-- Name: FUNCTION mark_splits_signed_externally(_user_id uuid, _track_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_splits_signed_externally(_user_id uuid, _track_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mark_splits_signed_externally(_user_id uuid, _track_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_splits_signed_externally(_user_id uuid, _track_id uuid) TO service_role;


--
-- Name: FUNCTION mark_waitlist_invited(_user_id uuid, _email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_waitlist_invited(_user_id uuid, _email text) TO authenticated;
GRANT ALL ON FUNCTION public.mark_waitlist_invited(_user_id uuid, _email text) TO service_role;


--
-- Name: FUNCTION mark_workspace_personal(_user_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_workspace_personal(_user_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_workspace_personal(_user_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION playlist_has_active_shared_link(_playlist_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.playlist_has_active_shared_link(_playlist_id uuid) TO anon;
GRANT ALL ON FUNCTION public.playlist_has_active_shared_link(_playlist_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.playlist_has_active_shared_link(_playlist_id uuid) TO service_role;


--
-- Name: FUNCTION prevent_client_plan_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_client_plan_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_client_plan_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_client_plan_change() TO service_role;


--
-- Name: FUNCTION remove_track_from_trakalog(_track_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.remove_track_from_trakalog(_track_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_track_from_trakalog(_track_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION remove_track_from_trakalog_legacy_v0(_track_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_track_from_trakalog_legacy_v0(_track_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_track_from_trakalog_legacy_v0(_track_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION remove_workspace_member(_user_id uuid, _member_user_id uuid, _workspace_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.remove_workspace_member(_user_id uuid, _member_user_id uuid, _workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_workspace_member(_user_id uuid, _member_user_id uuid, _workspace_id uuid) TO service_role;


--
-- Name: FUNCTION replace_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.replace_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.replace_playlist_tracks(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO service_role;


--
-- Name: FUNCTION replace_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replace_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.replace_playlist_tracks_legacy_v0(_user_id uuid, _playlist_id uuid, _track_ids uuid[]) TO service_role;


--
-- Name: FUNCTION request_track_access(_user_id uuid, _workspace_id uuid, _track_id uuid, _message text, _requester_name text, _requester_company text, _requester_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.request_track_access(_user_id uuid, _workspace_id uuid, _track_id uuid, _message text, _requester_name text, _requester_company text, _requester_email text) TO authenticated;
GRANT ALL ON FUNCTION public.request_track_access(_user_id uuid, _workspace_id uuid, _track_id uuid, _message text, _requester_name text, _requester_company text, _requester_email text) TO service_role;


--
-- Name: FUNCTION requeue_stale_jobs(_older_than_minutes integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.requeue_stale_jobs(_older_than_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.requeue_stale_jobs(_older_than_minutes integer) TO service_role;


--
-- Name: FUNCTION require_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.require_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) TO authenticated;
GRANT ALL ON FUNCTION public.require_workspace_access_level(_user_id uuid, _workspace_id uuid, _min_level text) TO service_role;


--
-- Name: FUNCTION reset_monthly_usage_if_due(_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_monthly_usage_if_due(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_monthly_usage_if_due(_user_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_catalog_share(_user_id uuid, _share_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revoke_catalog_share(_user_id uuid, _share_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revoke_catalog_share(_user_id uuid, _share_id uuid) TO service_role;


--
-- Name: FUNCTION revoke_catalog_share_legacy_v0(_user_id uuid, _share_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revoke_catalog_share_legacy_v0(_user_id uuid, _share_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_catalog_share_legacy_v0(_user_id uuid, _share_id uuid) TO service_role;


--
-- Name: FUNCTION sanitize_splits(_splits jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sanitize_splits(_splits jsonb) TO anon;
GRANT ALL ON FUNCTION public.sanitize_splits(_splits jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.sanitize_splits(_splits jsonb) TO service_role;


--
-- Name: FUNCTION save_track_to_trakalog(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.save_track_to_trakalog(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.save_track_to_trakalog(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION save_track_to_trakalog_legacy_v0(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_track_to_trakalog_legacy_v0(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_track_to_trakalog_legacy_v0(_track_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION search_marketplace_tracks(_q text, _genre text[], _mood text[], _bpm_min integer, _bpm_max integer, _key text, _type text, _limit integer, _offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_marketplace_tracks(_q text, _genre text[], _mood text[], _bpm_min integer, _bpm_max integer, _key text, _type text, _limit integer, _offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_marketplace_tracks(_q text, _genre text[], _mood text[], _bpm_min integer, _bpm_max integer, _key text, _type text, _limit integer, _offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_marketplace_tracks(_q text, _genre text[], _mood text[], _bpm_min integer, _bpm_max integer, _key text, _type text, _limit integer, _offset integer) TO service_role;


--
-- Name: FUNCTION set_track_comment_workspace(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_track_comment_workspace() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_track_comment_workspace() TO service_role;


--
-- Name: FUNCTION set_track_marketplace_public(_user_id uuid, _track_id uuid, _workspace_id uuid, _public boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_track_marketplace_public(_user_id uuid, _track_id uuid, _workspace_id uuid, _public boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_track_marketplace_public(_user_id uuid, _track_id uuid, _workspace_id uuid, _public boolean) TO service_role;


--
-- Name: FUNCTION set_track_version_active(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_track_version_active(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_track_version_active(_user_id uuid, _track_id uuid, _workspace_id uuid, _version_id uuid) TO service_role;


--
-- Name: FUNCTION share_playlist_with_workspace(_user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.share_playlist_with_workspace(_user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO anon;
GRANT ALL ON FUNCTION public.share_playlist_with_workspace(_user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO authenticated;
GRANT ALL ON FUNCTION public.share_playlist_with_workspace(_user_id uuid, _playlist_id uuid, _source_workspace_id uuid, _target_workspace_id uuid, _access_level text) TO service_role;


--
-- Name: FUNCTION shared_link_is_secured(_link_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shared_link_is_secured(_link_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.shared_link_is_secured(_link_id uuid) TO service_role;


--
-- Name: FUNCTION sign_agreement_via_token(_token text, _signature_data text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sign_agreement_via_token(_token text, _signature_data text) TO anon;
GRANT ALL ON FUNCTION public.sign_agreement_via_token(_token text, _signature_data text) TO authenticated;
GRANT ALL ON FUNCTION public.sign_agreement_via_token(_token text, _signature_data text) TO service_role;


--
-- Name: FUNCTION signature_requests_anon_immutable_cols(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.signature_requests_anon_immutable_cols() TO anon;
GRANT ALL ON FUNCTION public.signature_requests_anon_immutable_cols() TO authenticated;
GRANT ALL ON FUNCTION public.signature_requests_anon_immutable_cols() TO service_role;


--
-- Name: FUNCTION storage_path_workspace_id(_path text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.storage_path_workspace_id(_path text) TO anon;
GRANT ALL ON FUNCTION public.storage_path_workspace_id(_path text) TO authenticated;
GRANT ALL ON FUNCTION public.storage_path_workspace_id(_path text) TO service_role;


--
-- Name: FUNCTION stripe_apply_subscription(_customer_id text, _plan text, _cycle text, _status text, _stripe_sub_id text, _period_start timestamp with time zone, _period_end timestamp with time zone, _cancel_at_period_end boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_apply_subscription(_customer_id text, _plan text, _cycle text, _status text, _stripe_sub_id text, _period_start timestamp with time zone, _period_end timestamp with time zone, _cancel_at_period_end boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_apply_subscription(_customer_id text, _plan text, _cycle text, _status text, _stripe_sub_id text, _period_start timestamp with time zone, _period_end timestamp with time zone, _cancel_at_period_end boolean) TO service_role;


--
-- Name: FUNCTION stripe_claim_webhook_event(_event_id text, _event_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_claim_webhook_event(_event_id text, _event_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_claim_webhook_event(_event_id text, _event_type text) TO service_role;


--
-- Name: FUNCTION stripe_downgrade_to_free(_customer_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_downgrade_to_free(_customer_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_downgrade_to_free(_customer_id text) TO service_role;


--
-- Name: FUNCTION stripe_grant_credits(_customer_id text, _credits integer, _payment_intent text, _amount_cents integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_grant_credits(_customer_id text, _credits integer, _payment_intent text, _amount_cents integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_grant_credits(_customer_id text, _credits integer, _payment_intent text, _amount_cents integer) TO service_role;


--
-- Name: FUNCTION stripe_mark_webhook_processed(_event_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_mark_webhook_processed(_event_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_mark_webhook_processed(_event_id text) TO service_role;


--
-- Name: FUNCTION stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION stripe_set_customer(_user_id uuid, _customer_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_set_customer(_user_id uuid, _customer_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_set_customer(_user_id uuid, _customer_id text) TO service_role;


--
-- Name: FUNCTION stripe_set_purchased_seats(_customer_id text, _seats integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.stripe_set_purchased_seats(_customer_id text, _seats integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.stripe_set_purchased_seats(_customer_id text, _seats integer) TO service_role;


--
-- Name: FUNCTION sync_pitch_usage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_pitch_usage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_pitch_usage() TO service_role;


--
-- Name: FUNCTION sync_subscription_usage(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_subscription_usage() TO authenticated;
GRANT ALL ON FUNCTION public.sync_subscription_usage() TO service_role;


--
-- Name: FUNCTION toggle_track_video_visibility(_user_id uuid, _track_id uuid, _workspace_id uuid, _visible boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.toggle_track_video_visibility(_user_id uuid, _track_id uuid, _workspace_id uuid, _visible boolean) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_track_video_visibility(_user_id uuid, _track_id uuid, _workspace_id uuid, _visible boolean) TO service_role;


--
-- Name: FUNCTION track_comments_anon_immutable_cols(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.track_comments_anon_immutable_cols() TO anon;
GRANT ALL ON FUNCTION public.track_comments_anon_immutable_cols() TO authenticated;
GRANT ALL ON FUNCTION public.track_comments_anon_immutable_cols() TO service_role;


--
-- Name: FUNCTION unaccent_safe(_t text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.unaccent_safe(_t text) TO anon;
GRANT ALL ON FUNCTION public.unaccent_safe(_t text) TO authenticated;
GRANT ALL ON FUNCTION public.unaccent_safe(_t text) TO service_role;


--
-- Name: FUNCTION unmark_splits_signed_externally(_user_id uuid, _track_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.unmark_splits_signed_externally(_user_id uuid, _track_id uuid) TO anon;
GRANT ALL ON FUNCTION public.unmark_splits_signed_externally(_user_id uuid, _track_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.unmark_splits_signed_externally(_user_id uuid, _track_id uuid) TO service_role;


--
-- Name: FUNCTION update_approval_status(_user_id uuid, _approval_id uuid, _status text, _note text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_approval_status(_user_id uuid, _approval_id uuid, _status text, _note text) TO authenticated;
GRANT ALL ON FUNCTION public.update_approval_status(_user_id uuid, _approval_id uuid, _status text, _note text) TO service_role;


--
-- Name: FUNCTION update_approval_status_legacy_v0(_user_id uuid, _approval_id uuid, _status text, _note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_approval_status_legacy_v0(_user_id uuid, _approval_id uuid, _status text, _note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_approval_status_legacy_v0(_user_id uuid, _approval_id uuid, _status text, _note text) TO service_role;


--
-- Name: FUNCTION update_contact(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_contact(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text) TO authenticated;
GRANT ALL ON FUNCTION public.update_contact(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text) TO service_role;


--
-- Name: FUNCTION update_contact_legacy_v0(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_contact_legacy_v0(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_contact_legacy_v0(_user_id uuid, _workspace_id uuid, _contact_id uuid, _first_name text, _last_name text, _email text, _role text, _company text, _phone text, _pro text[], _ipi text, _publisher text, _stage_name text, _city text, _country text) TO service_role;


--
-- Name: FUNCTION update_member_role(_user_id uuid, _member_user_id uuid, _workspace_id uuid, _access_level text, _professional_title text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_member_role(_user_id uuid, _member_user_id uuid, _workspace_id uuid, _access_level text, _professional_title text) TO authenticated;
GRANT ALL ON FUNCTION public.update_member_role(_user_id uuid, _member_user_id uuid, _workspace_id uuid, _access_level text, _professional_title text) TO service_role;


--
-- Name: FUNCTION update_pitch_share_link(_user_id uuid, _pitch_id uuid, _workspace_id uuid, _share_link_id uuid, _contact_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_pitch_share_link(_user_id uuid, _pitch_id uuid, _workspace_id uuid, _share_link_id uuid, _contact_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_pitch_share_link(_user_id uuid, _pitch_id uuid, _workspace_id uuid, _share_link_id uuid, _contact_id uuid) TO service_role;


--
-- Name: FUNCTION update_playlist(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_playlist(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text) TO authenticated;
GRANT ALL ON FUNCTION public.update_playlist(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text) TO service_role;


--
-- Name: FUNCTION update_playlist_legacy_v0(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_playlist_legacy_v0(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_playlist_legacy_v0(_user_id uuid, _playlist_id uuid, _name text, _description text, _cover_url text) TO service_role;


--
-- Name: FUNCTION update_shared_link_status(_user_id uuid, _link_id uuid, _disabled boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_shared_link_status(_user_id uuid, _link_id uuid, _disabled boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_shared_link_status(_user_id uuid, _link_id uuid, _disabled boolean) TO service_role;


--
-- Name: FUNCTION update_shared_link_status_legacy_v0(_user_id uuid, _link_id uuid, _disabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_shared_link_status_legacy_v0(_user_id uuid, _link_id uuid, _disabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_shared_link_status_legacy_v0(_user_id uuid, _link_id uuid, _disabled boolean) TO service_role;


--
-- Name: FUNCTION update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text) TO authenticated;
GRANT ALL ON FUNCTION public.update_stem_type(_user_id uuid, _stem_id uuid, _stem_type text) TO service_role;


--
-- Name: FUNCTION update_stem_type_legacy_v0(_user_id uuid, _stem_id uuid, _stem_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_stem_type_legacy_v0(_user_id uuid, _stem_id uuid, _stem_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_stem_type_legacy_v0(_user_id uuid, _stem_id uuid, _stem_type text) TO service_role;


--
-- Name: FUNCTION update_studio_submission_status(_user_id uuid, _submission_id uuid, _status text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_studio_submission_status(_user_id uuid, _submission_id uuid, _status text) TO authenticated;
GRANT ALL ON FUNCTION public.update_studio_submission_status(_user_id uuid, _submission_id uuid, _status text) TO service_role;


--
-- Name: FUNCTION update_studio_submission_status_legacy_v0(_user_id uuid, _submission_id uuid, _status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_studio_submission_status_legacy_v0(_user_id uuid, _submission_id uuid, _status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_studio_submission_status_legacy_v0(_user_id uuid, _submission_id uuid, _status text) TO service_role;


--
-- Name: FUNCTION update_track(_user_id uuid, _track_id uuid, _updates jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_track(_user_id uuid, _track_id uuid, _updates jsonb) TO service_role;


--
-- Name: FUNCTION update_track_comment_via_token(_comment_id uuid, _shared_link_token text, _new_content text, _author_secret text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_comment_via_token(_comment_id uuid, _shared_link_token text, _new_content text, _author_secret text) TO anon;
GRANT ALL ON FUNCTION public.update_track_comment_via_token(_comment_id uuid, _shared_link_token text, _new_content text, _author_secret text) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_comment_via_token(_comment_id uuid, _shared_link_token text, _new_content text, _author_secret text) TO service_role;


--
-- Name: FUNCTION update_track_document_status(_user_id uuid, _doc_id uuid, _status text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_document_status(_user_id uuid, _doc_id uuid, _status text) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_document_status(_user_id uuid, _doc_id uuid, _status text) TO service_role;


--
-- Name: FUNCTION update_track_document_status_legacy_v0(_user_id uuid, _doc_id uuid, _status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_track_document_status_legacy_v0(_user_id uuid, _doc_id uuid, _status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_track_document_status_legacy_v0(_user_id uuid, _doc_id uuid, _status text) TO service_role;


--
-- Name: FUNCTION update_track_documents_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_documents_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_track_documents_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_track_documents_updated_at() TO service_role;


--
-- Name: FUNCTION update_track_version_chapters(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _chapters jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_version_chapters(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _chapters jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_version_chapters(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _chapters jsonb) TO service_role;


--
-- Name: FUNCTION update_track_version_notes(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_version_notes(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _notes text) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_version_notes(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _notes text) TO service_role;


--
-- Name: FUNCTION update_track_version_waveform(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _waveform_data jsonb, _duration_sec numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_version_waveform(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _waveform_data jsonb, _duration_sec numeric) TO anon;
GRANT ALL ON FUNCTION public.update_track_version_waveform(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _waveform_data jsonb, _duration_sec numeric) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_version_waveform(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid, _waveform_data jsonb, _duration_sec numeric) TO service_role;


--
-- Name: FUNCTION update_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid, _video_url text, _video_filename text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid, _video_url text, _video_filename text) TO authenticated;
GRANT ALL ON FUNCTION public.update_track_video(_user_id uuid, _track_id uuid, _workspace_id uuid, _video_url text, _video_filename text) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text) TO anon;
GRANT ALL ON FUNCTION public.update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_profile(_user_id uuid, _first_name text, _last_name text, _phone text, _bio text, _avatar_url text) TO service_role;


--
-- Name: FUNCTION update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text, _logo_url text, _brand_color text, _hero_position numeric, _hero_focal_point text, _social_instagram text, _social_tiktok text, _social_youtube text, _social_facebook text, _social_x text, _social_website text, _bio text, _social_spotify text, _social_apple text, _epk_url text, _logo_size integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text, _logo_url text, _brand_color text, _hero_position numeric, _hero_focal_point text, _social_instagram text, _social_tiktok text, _social_youtube text, _social_facebook text, _social_x text, _social_website text, _bio text, _social_spotify text, _social_apple text, _epk_url text, _logo_size integer) TO anon;
GRANT ALL ON FUNCTION public.update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text, _logo_url text, _brand_color text, _hero_position numeric, _hero_focal_point text, _social_instagram text, _social_tiktok text, _social_youtube text, _social_facebook text, _social_x text, _social_website text, _bio text, _social_spotify text, _social_apple text, _epk_url text, _logo_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text, _logo_url text, _brand_color text, _hero_position numeric, _hero_focal_point text, _social_instagram text, _social_tiktok text, _social_youtube text, _social_facebook text, _social_x text, _social_website text, _bio text, _social_spotify text, _social_apple text, _epk_url text, _logo_size integer) TO service_role;


--
-- Name: FUNCTION update_workspace_member(_user_id uuid, _workspace_id uuid, _member_id uuid, _professional_title text, _access_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_workspace_member(_user_id uuid, _workspace_id uuid, _member_id uuid, _professional_title text, _access_level text) TO authenticated;
GRANT ALL ON FUNCTION public.update_workspace_member(_user_id uuid, _workspace_id uuid, _member_id uuid, _professional_title text, _access_level text) TO service_role;


--
-- Name: FUNCTION update_workspace_name(_user_id uuid, _workspace_id uuid, _name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_workspace_name(_user_id uuid, _workspace_id uuid, _name text) TO authenticated;
GRANT ALL ON FUNCTION public.update_workspace_name(_user_id uuid, _workspace_id uuid, _name text) TO service_role;


--
-- Name: FUNCTION update_workspace_name_legacy_v0(_user_id uuid, _workspace_id uuid, _name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_workspace_name_legacy_v0(_user_id uuid, _workspace_id uuid, _name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_workspace_name_legacy_v0(_user_id uuid, _workspace_id uuid, _name text) TO service_role;


--
-- Name: FUNCTION update_workspace_settings(_user_id uuid, _workspace_id uuid, _settings jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_workspace_settings(_user_id uuid, _workspace_id uuid, _settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_workspace_settings(_user_id uuid, _workspace_id uuid, _settings jsonb) TO service_role;


--
-- Name: FUNCTION update_workspace_settings_legacy_v0(_user_id uuid, _workspace_id uuid, _settings jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_workspace_settings_legacy_v0(_user_id uuid, _workspace_id uuid, _settings jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_workspace_settings_legacy_v0(_user_id uuid, _workspace_id uuid, _settings jsonb) TO service_role;


--
-- Name: FUNCTION update_workspace_slug(_user_id uuid, _workspace_id uuid, _slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_workspace_slug(_user_id uuid, _workspace_id uuid, _slug text) TO authenticated;
GRANT ALL ON FUNCTION public.update_workspace_slug(_user_id uuid, _workspace_id uuid, _slug text) TO service_role;


--
-- Name: FUNCTION update_workspace_slug_legacy_v0(_user_id uuid, _workspace_id uuid, _slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_workspace_slug_legacy_v0(_user_id uuid, _workspace_id uuid, _slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_workspace_slug_legacy_v0(_user_id uuid, _workspace_id uuid, _slug text) TO service_role;


--
-- Name: FUNCTION upsert_artist_alias(_user_id uuid, _workspace_id uuid, _alias_name text, _contact_ids uuid[], _alias_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_artist_alias(_user_id uuid, _workspace_id uuid, _alias_name text, _contact_ids uuid[], _alias_id uuid) TO anon;
GRANT ALL ON FUNCTION public.upsert_artist_alias(_user_id uuid, _workspace_id uuid, _alias_name text, _contact_ids uuid[], _alias_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_artist_alias(_user_id uuid, _workspace_id uuid, _alias_name text, _contact_ids uuid[], _alias_id uuid) TO service_role;


--
-- Name: FUNCTION upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _stage_name text, _role text, _company text, _phone text, _city text, _country text, _pro text[], _ipi text, _publisher text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _stage_name text, _role text, _company text, _phone text, _city text, _country text, _pro text[], _ipi text, _publisher text) TO anon;
GRANT ALL ON FUNCTION public.upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _stage_name text, _role text, _company text, _phone text, _city text, _country text, _pro text[], _ipi text, _publisher text) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_contact(_user_id uuid, _workspace_id uuid, _first_name text, _last_name text, _email text, _stage_name text, _role text, _company text, _phone text, _city text, _country text, _pro text[], _ipi text, _publisher text) TO service_role;


--
-- Name: FUNCTION upsert_notification_preferences(_user_id uuid, _preferences jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_notification_preferences(_user_id uuid, _preferences jsonb) TO anon;
GRANT ALL ON FUNCTION public.upsert_notification_preferences(_user_id uuid, _preferences jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_notification_preferences(_user_id uuid, _preferences jsonb) TO service_role;


--
-- Name: FUNCTION upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer) TO anon;
GRANT ALL ON FUNCTION public.upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_track_rating(_user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer) TO service_role;


--
-- Name: FUNCTION verify_shared_link_session(_link_id uuid, _token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_shared_link_session(_link_id uuid, _token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_shared_link_session(_link_id uuid, _token text) TO service_role;


--
-- Name: FUNCTION write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text) TO anon;
GRANT ALL ON FUNCTION public.write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text) TO authenticated;
GRANT ALL ON FUNCTION public.write_audit_log(_user_id uuid, _workspace_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata text) TO service_role;


--
-- Name: TABLE approvals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.approvals TO anon;
GRANT ALL ON TABLE public.approvals TO authenticated;
GRANT ALL ON TABLE public.approvals TO service_role;


--
-- Name: TABLE artist_aliases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.artist_aliases TO anon;
GRANT ALL ON TABLE public.artist_aliases TO authenticated;
GRANT ALL ON TABLE public.artist_aliases TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE beta_passes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.beta_passes TO anon;
GRANT ALL ON TABLE public.beta_passes TO authenticated;
GRANT ALL ON TABLE public.beta_passes TO service_role;


--
-- Name: TABLE catalog_shares; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.catalog_shares TO anon;
GRANT ALL ON TABLE public.catalog_shares TO authenticated;
GRANT ALL ON TABLE public.catalog_shares TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE credit_purchases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credit_purchases TO anon;
GRANT ALL ON TABLE public.credit_purchases TO authenticated;
GRANT ALL ON TABLE public.credit_purchases TO service_role;


--
-- Name: TABLE invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invitations TO anon;
GRANT ALL ON TABLE public.invitations TO authenticated;
GRANT ALL ON TABLE public.invitations TO service_role;


--
-- Name: TABLE leak_traces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leak_traces TO anon;
GRANT ALL ON TABLE public.leak_traces TO authenticated;
GRANT ALL ON TABLE public.leak_traces TO service_role;


--
-- Name: TABLE link_downloads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.link_downloads TO anon;
GRANT ALL ON TABLE public.link_downloads TO authenticated;
GRANT ALL ON TABLE public.link_downloads TO service_role;


--
-- Name: TABLE link_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.link_events TO anon;
GRANT ALL ON TABLE public.link_events TO authenticated;
GRANT ALL ON TABLE public.link_events TO service_role;


--
-- Name: TABLE marketplace_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.marketplace_requests TO anon;
GRANT ALL ON TABLE public.marketplace_requests TO authenticated;
GRANT ALL ON TABLE public.marketplace_requests TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE pitches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pitches TO anon;
GRANT ALL ON TABLE public.pitches TO authenticated;
GRANT ALL ON TABLE public.pitches TO service_role;


--
-- Name: TABLE plan_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_limits TO anon;
GRANT ALL ON TABLE public.plan_limits TO authenticated;
GRANT ALL ON TABLE public.plan_limits TO service_role;


--
-- Name: TABLE playlist_tracks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.playlist_tracks TO anon;
GRANT ALL ON TABLE public.playlist_tracks TO authenticated;
GRANT ALL ON TABLE public.playlist_tracks TO service_role;


--
-- Name: TABLE playlists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.playlists TO anon;
GRANT ALL ON TABLE public.playlists TO authenticated;
GRANT ALL ON TABLE public.playlists TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limits TO anon;
GRANT ALL ON TABLE public.rate_limits TO authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE shared_link_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shared_link_sessions TO service_role;


--
-- Name: TABLE shared_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shared_links TO anon;
GRANT ALL ON TABLE public.shared_links TO authenticated;
GRANT ALL ON TABLE public.shared_links TO service_role;


--
-- Name: TABLE signature_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.signature_requests TO anon;
GRANT ALL ON TABLE public.signature_requests TO authenticated;
GRANT ALL ON TABLE public.signature_requests TO service_role;


--
-- Name: TABLE site_visits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.site_visits TO service_role;


--
-- Name: TABLE stems; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stems TO anon;
GRANT ALL ON TABLE public.stems TO authenticated;
GRANT ALL ON TABLE public.stems TO service_role;


--
-- Name: TABLE stripe_prices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_prices TO anon;
GRANT ALL ON TABLE public.stripe_prices TO authenticated;
GRANT ALL ON TABLE public.stripe_prices TO service_role;


--
-- Name: TABLE stripe_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;


--
-- Name: TABLE studio_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.studio_submissions TO anon;
GRANT ALL ON TABLE public.studio_submissions TO authenticated;
GRANT ALL ON TABLE public.studio_submissions TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE track_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.track_documents TO anon;
GRANT ALL ON TABLE public.track_documents TO authenticated;
GRANT ALL ON TABLE public.track_documents TO service_role;


--
-- Name: TABLE track_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.track_ratings TO anon;
GRANT ALL ON TABLE public.track_ratings TO authenticated;
GRANT ALL ON TABLE public.track_ratings TO service_role;


--
-- Name: TABLE track_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.track_versions TO anon;
GRANT ALL ON TABLE public.track_versions TO authenticated;
GRANT ALL ON TABLE public.track_versions TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waitlist TO anon;
GRANT ALL ON TABLE public.waitlist TO authenticated;
GRANT ALL ON TABLE public.waitlist TO service_role;


--
-- Name: TABLE watermark_payloads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.watermark_payloads TO anon;
GRANT ALL ON TABLE public.watermark_payloads TO authenticated;
GRANT ALL ON TABLE public.watermark_payloads TO service_role;


--
-- Name: TABLE whitelisted_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whitelisted_emails TO anon;
GRANT ALL ON TABLE public.whitelisted_emails TO authenticated;
GRANT ALL ON TABLE public.whitelisted_emails TO service_role;


--
-- Name: TABLE workspace_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_members TO anon;
GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;


--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspaces TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

-- \unrestrict 9gZAMj7CfPwiaUMV2WwD0dQRPkiLnHpLmeqzLPrno7KnzzqpQEYkLnJcAh1zCE1

