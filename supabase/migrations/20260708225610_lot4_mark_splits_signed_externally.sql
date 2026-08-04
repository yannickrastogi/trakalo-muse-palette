-- LOT 4 #8 — "Mark splits as already signed" for migrated / externally-signed tracks.
-- Double guard: assert_caller (anti-impersonation) + require_workspace_access_level('admin').
-- Never touches a real pending/signed request; reversible via unmark.

-- 1) Column distinguishing externally-marked from real signatures
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS signed_externally boolean NOT NULL DEFAULT false;

-- 2) mark
CREATE OR REPLACE FUNCTION public.mark_splits_signed_externally(_user_id uuid, _track_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
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
$func$;

-- 3) unmark (reversible — only removes externally-marked rows, never a real signature)
CREATE OR REPLACE FUNCTION public.unmark_splits_signed_externally(_user_id uuid, _track_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
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
$func$;

-- 4) Grants
GRANT EXECUTE ON FUNCTION public.mark_splits_signed_externally(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unmark_splits_signed_externally(uuid, uuid) TO authenticated, service_role;;
