-- LOT 2B — extend 3 read RPCs (DROP+recreate: RETURNS TABLE changes).
-- Existing columns kept in the same order; new columns appended => current frontend unaffected.

-- ── 1) get_user_workspaces: return full branding (#9 rehydrate, #20 settings display) ──
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);
CREATE FUNCTION public.get_user_workspaces(_user_id uuid)
RETURNS TABLE(
  id uuid, name text, is_personal boolean, owner_id uuid,
  slug text, plan text, created_at timestamptz, settings jsonb,
  hero_image_url text, hero_position integer, hero_focal_point text,
  logo_url text, brand_color text,
  social_instagram text, social_tiktok text, social_youtube text,
  social_facebook text, social_x text, social_website text,
  social_spotify text, social_apple text, bio text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
         w.social_spotify, w.social_apple, w.bio
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = _user_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_user_workspaces(uuid) TO anon, authenticated, service_role;

-- ── 2) get_workspace_catalog_shares: add source_workspace_name (#12) ──
DROP FUNCTION IF EXISTS public.get_workspace_catalog_shares(uuid);
CREATE FUNCTION public.get_workspace_catalog_shares(_workspace_id uuid)
RETURNS TABLE(
  id uuid, track_id uuid, source_workspace_id uuid, target_workspace_id uuid,
  access_level text, status text, created_at timestamptz, source_workspace_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT cs.id, cs.track_id, cs.source_workspace_id, cs.target_workspace_id,
         cs.access_level, cs.status, cs.created_at, sw.name
  FROM catalog_shares cs
  LEFT JOIN workspaces sw ON sw.id = cs.source_workspace_id
  WHERE cs.source_workspace_id = _workspace_id OR cs.target_workspace_id = _workspace_id;
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_workspace_catalog_shares(uuid) TO anon, authenticated, service_role;

-- ── 3) get_workspace_branding_for_shared_link: add spotify + apple (#20 public page) ──
DROP FUNCTION IF EXISTS public.get_workspace_branding_for_shared_link(text);
CREATE FUNCTION public.get_workspace_branding_for_shared_link(_slug text)
RETURNS TABLE(
  name text, hero_image_url text, hero_position integer, hero_focal_point text,
  logo_url text, brand_color text,
  social_instagram text, social_tiktok text, social_youtube text,
  social_facebook text, social_x text, social_website text, bio text,
  social_spotify text, social_apple text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT w.name, w.hero_image_url, w.hero_position, w.hero_focal_point,
         w.logo_url, w.brand_color,
         w.social_instagram, w.social_tiktok, w.social_youtube,
         w.social_facebook, w.social_x, w.social_website, w.bio,
         w.social_spotify, w.social_apple
  FROM public.workspaces w
  JOIN public.shared_links sl ON sl.workspace_id = w.id
  WHERE sl.link_slug = _slug
    AND sl.status = 'active'
    AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$func$;
GRANT EXECUTE ON FUNCTION public.get_workspace_branding_for_shared_link(text) TO anon, authenticated, service_role;;
