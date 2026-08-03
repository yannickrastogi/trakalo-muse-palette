-- LOT 7 #15 — bulk edit tracks (status/artist/genre/mood/...).
-- Reuses update_track per track => identical field whitelist + per-track access check
-- (editor on the track's workspace, or pitcher if uploader). Atomic: any failure rolls back.
CREATE OR REPLACE FUNCTION public.bulk_update_tracks(_user_id uuid, _track_ids uuid[], _updates jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
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
$func$;

GRANT EXECUTE ON FUNCTION public.bulk_update_tracks(uuid, uuid[], jsonb) TO authenticated, service_role;;
