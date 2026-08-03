CREATE OR REPLACE FUNCTION public.log_site_visit(
  _path text DEFAULT '/',
  _referrer text DEFAULT NULL,
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _visitor_id text DEFAULT NULL,
  _session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _p    text;
  _ref  text;
  _dom  text;
  _us   text;
  _um   text;
  _uc   text;
  _vid  text;
  _sid  text;
  _src  text;
BEGIN
  -- Bornage strict des entrees (endpoint public)
  _p   := left(coalesce(nullif(trim(_path), ''), '/'), 300);
  _ref := left(nullif(trim(coalesce(_referrer, '')), ''), 500);
  _us  := left(nullif(trim(coalesce(_utm_source, '')), ''), 100);
  _um  := left(nullif(trim(coalesce(_utm_medium, '')), ''), 100);
  _uc  := left(nullif(trim(coalesce(_utm_campaign, '')), ''), 100);
  _vid := left(nullif(trim(coalesce(_visitor_id, '')), ''), 64);
  _sid := left(nullif(trim(coalesce(_session_id, '')), ''), 64);

  -- Anti-spam : max 60 evenements par session sur 1h
  IF _sid IS NOT NULL AND (
    SELECT count(*) FROM public.site_visits
    WHERE session_id = _sid AND created_at > now() - interval '1 hour'
  ) >= 60 THEN
    RETURN;
  END IF;

  -- Deduplication : meme session + meme page dans les 30 dernieres minutes
  IF _sid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.site_visits
    WHERE session_id = _sid AND path = _p AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  -- Domaine referent
  _dom := lower(coalesce(substring(_ref from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/:?#]+)'), ''));
  _dom := regexp_replace(_dom, '^www\.', '');
  _dom := nullif(_dom, '');

  -- Auto-referencement (navigation interne) => traite comme direct
  IF _dom IS NOT NULL AND (_dom = 'trakalog.com' OR _dom LIKE '%.trakalog.com') THEN
    _dom := NULL;
  END IF;

  -- Source normalisee : UTM prioritaire, sinon referrer, sinon direct
  _src := CASE
    WHEN _us IS NOT NULL THEN lower(_us)
    WHEN _dom IS NULL THEN 'direct'
    WHEN _dom LIKE '%instagram%'                      THEN 'instagram'
    WHEN _dom LIKE '%tiktok%'                         THEN 'tiktok'
    WHEN _dom LIKE '%facebook%' OR _dom LIKE '%fb.%'  THEN 'facebook'
    WHEN _dom LIKE '%linkedin%' OR _dom = 'lnkd.in'   THEN 'linkedin'
    WHEN _dom LIKE '%youtube%'  OR _dom = 'youtu.be'  THEN 'youtube'
    WHEN _dom LIKE '%whatsapp%'                       THEN 'whatsapp'
    WHEN _dom LIKE '%google%'                         THEN 'google'
    WHEN _dom LIKE '%bing%'                           THEN 'bing'
    WHEN _dom LIKE '%duckduckgo%'                     THEN 'duckduckgo'
    WHEN _dom LIKE '%twitter%'  OR _dom = 'x.com' OR _dom = 't.co' THEN 'x'
    WHEN _dom LIKE '%reddit%'                         THEN 'reddit'
    WHEN _dom LIKE '%discord%'                        THEN 'discord'
    WHEN _dom LIKE '%spotify%'                        THEN 'spotify'
    WHEN _dom LIKE '%chatgpt%' OR _dom LIKE '%openai%' OR _dom LIKE '%claude.ai%' OR _dom LIKE '%perplexity%' THEN 'ai_assistant'
    WHEN _dom LIKE '%mail%' OR _dom LIKE '%outlook%'  THEN 'email'
    ELSE _dom
  END;

  INSERT INTO public.site_visits (
    visitor_id, session_id, path, referrer, referrer_domain,
    source, utm_source, utm_medium, utm_campaign
  ) VALUES (
    _vid, _sid, _p, _ref, _dom, _src, _us, _um, _uc
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.log_site_visit(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_site_visit(text, text, text, text, text, text, text) TO anon, authenticated;;
