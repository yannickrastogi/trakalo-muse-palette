-- ============================================================
-- ÉTAPE 3 — Enforcement des limites de plan (BEFORE INSERT triggers)
-- -1 = illimité (skip). service_role bypass (signup/backend).
-- Erreur uniforme: plan_limit_reached (le front catch -> modal upgrade)
-- ============================================================

-- 1) TRACKS (compteur maintenu tracks_uploaded_count)
CREATE OR REPLACE FUNCTION public.enforce_track_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_max int; v_used int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.uploaded_by IS NULL THEN RETURN NEW; END IF;

  SELECT pl.tracks_max, s.tracks_uploaded_count
    INTO v_max, v_used
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.uploaded_by;

  IF v_max IS NOT NULL AND v_max <> -1 AND coalesce(v_used,0) >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: tracks (%/%).', v_used, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_track_limit ON public.tracks;
CREATE TRIGGER enforce_track_limit
  BEFORE INSERT ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_track_limit();

-- 2) PITCHES (quota mensuel, reset paresseux d'abord)
CREATE OR REPLACE FUNCTION public.enforce_pitch_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_max int; v_used int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.sent_by IS NULL THEN RETURN NEW; END IF;

  PERFORM public.reset_monthly_usage_if_due(NEW.sent_by);

  SELECT pl.pitches_per_month, s.pitches_sent_this_month
    INTO v_max, v_used
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.sent_by;

  IF v_max IS NOT NULL AND v_max <> -1 AND coalesce(v_used,0) >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: pitches (%/% this month).', v_used, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_pitch_limit ON public.pitches;
CREATE TRIGGER enforce_pitch_limit
  BEFORE INSERT ON public.pitches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pitch_limit();

-- 3) WORKSPACES (count owned, le 1er perso passe toujours si max>=1)
CREATE OR REPLACE FUNCTION public.enforce_workspace_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_max int; v_count int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;

  SELECT pl.workspaces_max INTO v_max
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.owner_id;

  IF v_max IS NULL OR v_max = -1 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.workspaces WHERE owner_id = NEW.owner_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'plan_limit_reached: workspaces (%/%).', v_count, v_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS enforce_workspace_limit ON public.workspaces;
CREATE TRIGGER enforce_workspace_limit
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_limit();

-- 4) SMART A&R : check quota (appelée par l'EF avant de lancer une query)
CREATE OR REPLACE FUNCTION public.check_smart_ar_quota(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_plan text; v_used int; v_permonth int; v_lifetime int; v_limit int; v_allowed boolean;
BEGIN
  PERFORM public.assert_caller(_user_id);
  PERFORM public.reset_monthly_usage_if_due(_user_id);

  SELECT s.plan, s.smart_ar_queries_this_month, pl.smart_ar_per_month, pl.smart_ar_lifetime
    INTO v_plan, v_used, v_permonth, v_lifetime
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = _user_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription');
  END IF;

  v_limit := CASE WHEN v_plan = 'free' THEN coalesce(v_lifetime,0) ELSE v_permonth END;
  v_allowed := (v_limit = -1) OR (coalesce(v_used,0) < v_limit);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'plan', v_plan,
    'used', coalesce(v_used,0),
    'limit', v_limit,
    'scope', CASE WHEN v_plan='free' THEN 'lifetime' ELSE 'monthly' END
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.check_smart_ar_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_smart_ar_quota(uuid) TO authenticated, service_role;;
