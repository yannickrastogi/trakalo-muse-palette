-- G1 : notifier les membres du workspace à chaque nouveau commentaire (tous chemins : RPC + EF visiteur)
CREATE OR REPLACE FUNCTION public.notify_on_track_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_home_ws uuid;
  v_title   text;
BEGIN
  BEGIN
    SELECT t.workspace_id, t.title
      INTO v_home_ws, v_title
    FROM public.tracks t
    WHERE t.id = NEW.track_id;

    IF v_home_ws IS NULL THEN
      RETURN NEW;
    END IF;

    -- une notification par membre du workspace du morceau
    INSERT INTO public.notifications (user_id, workspace_id, type, title, message, track_id, is_read)
    SELECT wm.user_id, v_home_ws, 'comment_added', 'New comment',
           COALESCE(NULLIF(btrim(NEW.author_name), ''), 'Someone')
             || ' commented on "' || COALESCE(NULLIF(btrim(v_title), ''), 'a track') || '"',
           NEW.track_id, false
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_home_ws;
  EXCEPTION WHEN OTHERS THEN
    -- ne jamais bloquer l'insertion du commentaire à cause de la notif
    NULL;
  END;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notify_on_track_comment ON public.track_comments;
CREATE TRIGGER trg_notify_on_track_comment
AFTER INSERT ON public.track_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_track_comment();;
