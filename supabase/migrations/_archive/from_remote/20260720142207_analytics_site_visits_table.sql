CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text,
  session_id text,
  path text NOT NULL DEFAULT '/',
  referrer text,
  referrer_domain text,
  source text NOT NULL DEFAULT 'direct',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Aucune policy : la table n'est accessible que via les fonctions SECURITY DEFINER
-- et le service_role. Aucun accès direct anon/authenticated.
REVOKE ALL ON public.site_visits FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON public.site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_source ON public.site_visits (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_visitor ON public.site_visits (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_session_path ON public.site_visits (session_id, path, created_at DESC);

COMMENT ON TABLE public.site_visits IS 'Analytics maison : pages vues + source de provenance. Aucune donnee personnelle (pas d IP, pas d email). Ecriture via public.log_site_visit, lecture via public.get_visit_stats (admin plateforme).';;
