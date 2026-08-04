-- LOT 2B (#20) — add Spotify & Apple Music to workspace branding socials.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS social_spotify text,
  ADD COLUMN IF NOT EXISTS social_apple text;

-- Recreate update_workspace_branding with the 2 new trailing params (backward compatible).
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'update_workspace_branding'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig::text; END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.update_workspace_branding(
  _user_id uuid, _workspace_id uuid,
  _hero_image_url text DEFAULT NULL, _logo_url text DEFAULT NULL, _brand_color text DEFAULT NULL,
  _hero_position numeric DEFAULT NULL, _hero_focal_point text DEFAULT NULL,
  _social_instagram text DEFAULT NULL, _social_tiktok text DEFAULT NULL, _social_youtube text DEFAULT NULL,
  _social_facebook text DEFAULT NULL, _social_x text DEFAULT NULL, _social_website text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _social_spotify text DEFAULT NULL, _social_apple text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
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
    social_apple     = COALESCE(_social_apple, social_apple)
  WHERE id = _workspace_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.update_workspace_branding(uuid,uuid,text,text,text,numeric,text,text,text,text,text,text,text,text,text,text) TO authenticated, service_role;;
