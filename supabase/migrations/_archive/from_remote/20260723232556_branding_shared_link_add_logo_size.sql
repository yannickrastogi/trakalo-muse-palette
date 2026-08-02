-- Ajout de logo_size au RETURNS TABLE (changement de type de retour -> DROP obligatoire)
DROP FUNCTION IF EXISTS public.get_workspace_branding_for_shared_link(text);

CREATE OR REPLACE FUNCTION public.get_workspace_branding_for_shared_link(_slug text)
RETURNS TABLE(
  name text, slug text, hero_image_url text, hero_position integer, hero_focal_point text,
  logo_url text, logo_size integer, brand_color text,
  social_instagram text, social_tiktok text, social_youtube text,
  social_facebook text, social_x text, social_website text, bio text,
  social_spotify text, social_apple text, epk_url text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT w.name, w.slug, w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.logo_size, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website, w.bio,
         w.social_spotify, w.social_apple, w.epk_url
  FROM workspaces w
  JOIN shared_links sl ON sl.workspace_id = w.id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_workspace_branding_for_shared_link(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';;
