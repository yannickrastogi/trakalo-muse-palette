-- ============================================================
-- Lecture publique des tracks d'un lien partagé, splits SANITISÉS.
-- Remplace les .from("tracks").select("*") anon de SharedStemAccess.
-- Purement additif.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_tracks_for_shared_link(_link_id uuid)
RETURNS SETOF public.tracks
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE v_status text; v_expires timestamptz; v_playlist uuid; v_track uuid;
BEGIN
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
$func$;

REVOKE ALL ON FUNCTION public.get_tracks_for_shared_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracks_for_shared_link(uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';;
