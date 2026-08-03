-- Feature EPK : PDF de press kit dans le branding workspace, affiché sur les liens partagés.

-- 1. Colonne EPK
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS epk_url text;

-- 2. Limite branding portée à 25 MB (les PDF EPK peuvent dépasser 10 MB)
UPDATE storage.buckets SET file_size_limit = 26214400 WHERE id = 'branding';

-- 3. Sauvegarde branding : ajout de _epk_url (transition-safe : NULL=garder, ''=effacer)
DROP FUNCTION IF EXISTS public.update_workspace_branding(uuid,uuid,text,text,text,numeric,text,text,text,text,text,text,text,text,text,text);
CREATE FUNCTION public.update_workspace_branding(
  _user_id uuid, _workspace_id uuid,
  _hero_image_url text DEFAULT NULL, _logo_url text DEFAULT NULL, _brand_color text DEFAULT NULL,
  _hero_position numeric DEFAULT NULL, _hero_focal_point text DEFAULT NULL,
  _social_instagram text DEFAULT NULL, _social_tiktok text DEFAULT NULL, _social_youtube text DEFAULT NULL,
  _social_facebook text DEFAULT NULL, _social_x text DEFAULT NULL, _social_website text DEFAULT NULL,
  _bio text DEFAULT NULL, _social_spotify text DEFAULT NULL, _social_apple text DEFAULT NULL,
  _epk_url text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    social_apple     = COALESCE(_social_apple, social_apple),
    epk_url          = CASE WHEN _epk_url IS NULL THEN epk_url
                            WHEN _epk_url = '' THEN NULL
                            ELSE _epk_url END
  WHERE id = _workspace_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.update_workspace_branding(uuid,uuid,text,text,text,numeric,text,text,text,text,text,text,text,text,text,text,text) TO authenticated, service_role;

-- 4. get_user_workspaces : ajout epk_url au retour (pour l'écran de réglages)
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);
CREATE FUNCTION public.get_user_workspaces(_user_id uuid)
 RETURNS TABLE(id uuid, name text, is_personal boolean, owner_id uuid, slug text, plan text,
   created_at timestamp with time zone, settings jsonb, hero_image_url text, hero_position integer,
   hero_focal_point text, logo_url text, brand_color text, social_instagram text, social_tiktok text,
   social_youtube text, social_facebook text, social_x text, social_website text, social_spotify text,
   social_apple text, bio text, epk_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM public.assert_caller(_user_id);
  RETURN QUERY
  SELECT w.id, w.name, w.is_personal, w.owner_id,
         w.slug, w.plan, w.created_at, w.settings,
         w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website,
         w.social_spotify, w.social_apple, w.bio, w.epk_url
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_user_workspaces(uuid) TO authenticated, service_role;

-- 5. get_workspace_branding_for_shared_link : ajout epk_url (pour l'onglet EPK sur le lien)
DROP FUNCTION IF EXISTS public.get_workspace_branding_for_shared_link(text);
CREATE FUNCTION public.get_workspace_branding_for_shared_link(_slug text)
 RETURNS TABLE(name text, hero_image_url text, hero_position integer, hero_focal_point text,
   logo_url text, brand_color text, social_instagram text, social_tiktok text, social_youtube text,
   social_facebook text, social_x text, social_website text, bio text, social_spotify text,
   social_apple text, epk_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT w.name, w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website, w.bio,
         w.social_spotify, w.social_apple, w.epk_url
  FROM workspaces w
  JOIN shared_links sl ON sl.workspace_id = w.id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_workspace_branding_for_shared_link(text) TO anon, authenticated, service_role;;
