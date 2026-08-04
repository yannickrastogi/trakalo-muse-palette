-- L'UI d'activité lit track_comments directement (filtré par workspace_id), pas la table notifications.
-- On retire donc le trigger de notification (devenu inutile pour cette UI).
DROP TRIGGER IF EXISTS trg_notify_on_track_comment ON public.track_comments;
DROP FUNCTION IF EXISTS public.notify_on_track_comment();

-- Chaque commentaire doit porter workspace_id = workspace du morceau, sinon le filtre
-- frontend .eq("workspace_id") rate les commentaires visiteurs (l'EF anon les insère sans workspace_id).
CREATE OR REPLACE FUNCTION public.set_track_comment_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT t.workspace_id INTO NEW.workspace_id
    FROM public.tracks t WHERE t.id = NEW.track_id;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_track_comment_workspace ON public.track_comments;
CREATE TRIGGER trg_set_track_comment_workspace
BEFORE INSERT ON public.track_comments
FOR EACH ROW EXECUTE FUNCTION public.set_track_comment_workspace();

-- Backfill des commentaires existants (workspace_id NULL) pour qu'ils remontent aussi
UPDATE public.track_comments tc
SET workspace_id = t.workspace_id
FROM public.tracks t
WHERE tc.track_id = t.id AND tc.workspace_id IS NULL;;
