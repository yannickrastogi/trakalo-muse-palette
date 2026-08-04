-- Métadonnées publiques d'une playlist partagée (pour l'aperçu OG / réseaux sociaux)
CREATE OR REPLACE FUNCTION public.get_playlist_meta_for_shared_link(_slug text)
RETURNS TABLE(name text, description text, cover_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  RETURN QUERY
  SELECT p.name, p.description, p.cover_url
  FROM public.shared_links sl
  JOIN public.playlists p ON p.id = sl.playlist_id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;

REVOKE ALL ON FUNCTION public.get_playlist_meta_for_shared_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_playlist_meta_for_shared_link(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';;
