CREATE OR REPLACE FUNCTION public.get_visit_stats(_user_id uuid, _days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _result json;
  _d integer;
  _since timestamptz;
BEGIN
  PERFORM public.assert_caller(_user_id);
  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  _d := least(greatest(coalesce(_days, 30), 1), 365);
  _since := now() - (_d || ' days')::interval;

  SELECT json_build_object(
    'period_days', _d,
    'totals', json_build_object(
      'visits_all_time',    (SELECT count(*) FROM public.site_visits),
      'visitors_all_time',  (SELECT count(DISTINCT visitor_id) FROM public.site_visits WHERE visitor_id IS NOT NULL),
      'visits_period',      (SELECT count(*) FROM public.site_visits WHERE created_at > _since),
      'visitors_period',    (SELECT count(DISTINCT visitor_id) FROM public.site_visits WHERE created_at > _since AND visitor_id IS NOT NULL),
      'visits_7d',          (SELECT count(*) FROM public.site_visits WHERE created_at > now() - interval '7 days'),
      'visits_24h',         (SELECT count(*) FROM public.site_visits WHERE created_at > now() - interval '24 hours')
    ),
    'by_source', coalesce((
      SELECT json_agg(x) FROM (
        SELECT source,
               count(*)::int AS visits,
               count(DISTINCT visitor_id)::int AS visitors
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY source
        ORDER BY count(*) DESC
        LIMIT 25
      ) x
    ), '[]'::json),
    'by_day', coalesce((
      SELECT json_agg(x ORDER BY x.day) FROM (
        SELECT (date_trunc('day', created_at))::date AS day,
               count(*)::int AS visits,
               count(DISTINCT visitor_id)::int AS visitors
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY 1
      ) x
    ), '[]'::json),
    'top_pages', coalesce((
      SELECT json_agg(x) FROM (
        SELECT path, count(*)::int AS visits
        FROM public.site_visits
        WHERE created_at > _since
        GROUP BY path
        ORDER BY count(*) DESC
        LIMIT 15
      ) x
    ), '[]'::json),
    'top_campaigns', coalesce((
      SELECT json_agg(x) FROM (
        SELECT utm_campaign AS campaign, utm_source AS source, count(*)::int AS visits
        FROM public.site_visits
        WHERE created_at > _since AND utm_campaign IS NOT NULL
        GROUP BY 1, 2
        ORDER BY count(*) DESC
        LIMIT 15
      ) x
    ), '[]'::json)
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_visit_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visit_stats(uuid, integer) TO authenticated;;
