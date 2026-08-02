-- Ajout de 2 colonnes en FIN de signature (owner_name, my_access_level) pour permettre
-- au switcher de séparer "My workspaces" et "Shared with me".
-- Le reste de la fonction est repris À L'IDENTIQUE.
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);

CREATE FUNCTION public.get_user_workspaces(_user_id uuid)
 RETURNS TABLE(id uuid, name text, is_personal boolean, owner_id uuid, slug text, plan text,
               created_at timestamp with time zone, settings jsonb, hero_image_url text,
               hero_position integer, hero_focal_point text, logo_url text, logo_size integer,
               brand_color text, social_instagram text, social_tiktok text, social_youtube text,
               social_facebook text, social_x text, social_website text, social_spotify text,
               social_apple text, bio text, epk_url text,
               owner_name text, my_access_level text)
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
         w.logo_url, w.logo_size, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website,
         w.social_spotify, w.social_apple, w.bio, w.epk_url,
         COALESCE(NULLIF(TRIM(p.full_name), ''), p.email)::text AS owner_name,
         CASE WHEN w.owner_id = _user_id THEN 'admin'
              ELSE COALESCE(wm.access_level, 'viewer') END::text AS my_access_level
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id
  LEFT JOIN profiles p ON p.id = w.owner_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_user_workspaces(uuid) TO authenticated, service_role;;
