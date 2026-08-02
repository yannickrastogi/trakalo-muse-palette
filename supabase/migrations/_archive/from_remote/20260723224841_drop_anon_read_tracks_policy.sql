-- Ferme la fuite : plus aucun SELECT direct sur tracks par le rôle anon.
-- L'accès public passe désormais exclusivement par les RPC SECURITY DEFINER
-- sanitisées (get_track_for_shared_link, get_tracks_for_shared_link).
DROP POLICY IF EXISTS anon_read_tracks_via_shared_link ON public.tracks;

NOTIFY pgrst, 'reload schema';;
