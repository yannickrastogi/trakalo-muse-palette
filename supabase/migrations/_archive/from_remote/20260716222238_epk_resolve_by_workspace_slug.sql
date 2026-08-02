-- Résout le slug d'un workspace -> son epk_url (PDF public), pour servir l'EPK
-- sous une URL trakalog.com (route proxy /epk/:slug). Ne renvoie que l'URL du PDF (donnée publique).
CREATE OR REPLACE FUNCTION public.get_workspace_epk_by_slug(_workspace_slug text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
  SELECT w.epk_url
  FROM public.workspaces w
  WHERE w.slug = _workspace_slug
    AND w.epk_url IS NOT NULL
  LIMIT 1;
$func$;

GRANT EXECUTE ON FUNCTION public.get_workspace_epk_by_slug(text) TO anon, authenticated, service_role;;
