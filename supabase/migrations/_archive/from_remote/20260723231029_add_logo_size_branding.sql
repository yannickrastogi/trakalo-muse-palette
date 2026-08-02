-- Taille du logo personnalisable (pourcentage, 100 = taille actuelle par défaut)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_size integer NOT NULL DEFAULT 100;

-- Recréation de la RPC avec _logo_size ajouté EN FIN de signature.
-- DROP de la signature exacte d'abord (sinon overload en doublon).
DROP FUNCTION IF EXISTS public.update_workspace_branding(
  uuid,uuid,text,text,text,numeric,text,text,text,text,text,text,text,text,text,text,text
);

CREATE OR REPLACE FUNCTION public.update_workspace_branding(
  _user_id uuid, _workspace_id uuid,
  _hero_image_url text DEFAULT NULL, _logo_url text DEFAULT NULL, _brand_color text DEFAULT NULL,
  _hero_position numeric DEFAULT NULL, _hero_focal_point text DEFAULT NULL,
  _social_instagram text DEFAULT NULL, _social_tiktok text DEFAULT NULL, _social_youtube text DEFAULT NULL,
  _social_facebook text DEFAULT NULL, _social_x text DEFAULT NULL, _social_website text DEFAULT NULL,
  _bio text DEFAULT NULL, _social_spotify text DEFAULT NULL, _social_apple text DEFAULT NULL,
  _epk_url text DEFAULT NULL,
  _logo_size integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    social_apple     = COALESCE(_social_apple, social_apple),
    -- borné serveur : 50% à 200%
    logo_size        = COALESCE(greatest(50, least(200, _logo_size)), logo_size),
    epk_url          = CASE WHEN _epk_url IS NULL THEN epk_url
                            WHEN _epk_url = '' THEN NULL
                            ELSE _epk_url END
  WHERE id = _workspace_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';;
