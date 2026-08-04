-- La policy anon sur playlists interrogeait shared_links, table que anon ne peut
-- pas lire (aucune policy) -> sous-requête vide -> 406, cover de playlist absente.
-- Fix : helper SECURITY DEFINER qui contourne la RLS de shared_links UNIQUEMENT
-- pour répondre "ce lien existe-t-il et est-il actif ?". shared_links reste fermée.
CREATE OR REPLACE FUNCTION public.playlist_has_active_shared_link(_playlist_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_links sl
    WHERE sl.playlist_id = _playlist_id
      AND sl.status = 'active'
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
  );
$func$;

GRANT EXECUTE ON FUNCTION public.playlist_has_active_shared_link(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS anon_read_playlists_via_shared_link ON public.playlists;
CREATE POLICY anon_read_playlists_via_shared_link
  ON public.playlists FOR SELECT TO anon
  USING (public.playlist_has_active_shared_link(id));

NOTIFY pgrst, 'reload schema';;
