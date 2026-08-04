CREATE OR REPLACE FUNCTION public.upsert_track_rating(
  _user_id uuid, _track_id uuid, _workspace_id uuid, _rating integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
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
$func$;;
