-- ============================================================
-- ÉTAPE 2 — Compteurs d'usage (pitches, Smart A&R) + reset mensuel
-- ============================================================

-- 1) Reset mensuel paresseux (helper interne)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage_if_due(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions s
  SET
    pitches_sent_this_month     = 0,
    ai_credits_monthly_used     = 0,
    smart_ar_queries_this_month = CASE WHEN s.plan = 'free'
                                       THEN s.smart_ar_queries_this_month
                                       ELSE 0 END,
    ai_credits_reset_at         = now() + interval '1 month',
    updated_at                  = now()
  WHERE s.user_id = _user_id
    AND (s.ai_credits_reset_at IS NULL OR s.ai_credits_reset_at <= now());
END;
$func$;

REVOKE ALL ON FUNCTION public.reset_monthly_usage_if_due(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_monthly_usage_if_due(uuid) TO service_role;

-- 2) Compteur PITCHES : trigger AFTER INSERT
CREATE OR REPLACE FUNCTION public.sync_pitch_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF NEW.sent_by IS NOT NULL THEN
    PERFORM public.reset_monthly_usage_if_due(NEW.sent_by);
    UPDATE public.subscriptions
    SET pitches_sent_this_month = pitches_sent_this_month + 1,
        updated_at = now()
    WHERE user_id = NEW.sent_by;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS sync_pitch_usage ON public.pitches;
CREATE TRIGGER sync_pitch_usage
  AFTER INSERT ON public.pitches
  FOR EACH ROW EXECUTE FUNCTION public.sync_pitch_usage();

-- 3) Compteur SMART A&R : RPC appelée par l'Edge Function
CREATE OR REPLACE FUNCTION public.increment_smart_ar_usage(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.reset_monthly_usage_if_due(_user_id);

  UPDATE public.subscriptions
  SET smart_ar_queries_this_month = smart_ar_queries_this_month + 1,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING smart_ar_queries_this_month INTO v_count;

  RETURN v_count;
END;
$func$;

REVOKE ALL ON FUNCTION public.increment_smart_ar_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_smart_ar_usage(uuid) TO authenticated, service_role;;
