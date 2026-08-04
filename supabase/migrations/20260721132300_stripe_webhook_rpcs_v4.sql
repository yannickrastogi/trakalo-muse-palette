-- ============================================================
-- ÉTAPE 4.1 — RPCs appelées par l'Edge Function stripe-webhook
-- Toutes SECURITY DEFINER, service_role uniquement.
-- ============================================================

-- 1) Enregistrer le customer Stripe sur la sub d'un user
CREATE OR REPLACE FUNCTION public.stripe_set_customer(_user_id uuid, _customer_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET stripe_customer_id = _customer_id, updated_at = now()
  WHERE user_id = _user_id;
END;
$func$;

-- 2) Appliquer un abonnement actif/mis à jour (matché par customer)
CREATE OR REPLACE FUNCTION public.stripe_apply_subscription(
  _customer_id text, _plan text, _cycle text, _status text,
  _stripe_sub_id text, _period_start timestamptz, _period_end timestamptz,
  _cancel_at_period_end boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET plan                   = _plan,
      billing_cycle          = _cycle,
      subscription_status    = _status,
      stripe_subscription_id = _stripe_sub_id,
      current_period_start   = _period_start,
      current_period_end     = _period_end,
      cancel_at_period_end   = coalesce(_cancel_at_period_end, false),
      canceled_at            = NULL,
      updated_at             = now()
  WHERE stripe_customer_id = _customer_id;
END;
$func$;

-- 3) Downgrade vers Free (subscription deleted / paiement définitivement échoué)
CREATE OR REPLACE FUNCTION public.stripe_downgrade_to_free(_customer_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET plan                   = 'free',
      billing_cycle          = NULL,
      subscription_status    = 'canceled',
      stripe_subscription_id = NULL,
      cancel_at_period_end   = false,
      canceled_at            = now(),
      updated_at             = now()
  WHERE stripe_customer_id = _customer_id;
END;
$func$;

-- 4) Reset des compteurs mensuels au renouvellement (invoice.paid). Idempotent.
CREATE OR REPLACE FUNCTION public.stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET pitches_sent_this_month     = 0,
      smart_ar_queries_this_month = 0,
      ai_credits_monthly_used     = 0,
      ai_credits_reset_at         = _new_reset_at,
      updated_at                  = now()
  WHERE stripe_customer_id = _customer_id
    AND (ai_credits_reset_at IS NULL OR _new_reset_at > ai_credits_reset_at);
END;
$func$;

-- 5) Créditer un pack acheté (checkout crédits). Idempotent par payment_intent.
CREATE OR REPLACE FUNCTION public.stripe_grant_credits(
  _customer_id text, _credits int, _payment_intent text, _amount_cents int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.subscriptions WHERE stripe_customer_id = _customer_id;
  IF v_user IS NULL THEN RETURN; END IF;

  -- Déjà traité ? (retry webhook) -> on ne double-crédite pas.
  IF _payment_intent IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.credit_purchases WHERE stripe_payment_intent_id = _payment_intent
     ) THEN
    RETURN;
  END IF;

  INSERT INTO public.credit_purchases (user_id, amount, price_cents, stripe_payment_intent_id, status)
  VALUES (v_user, _credits, _amount_cents, _payment_intent, 'completed');

  UPDATE public.subscriptions
  SET ai_credits_purchased = coalesce(ai_credits_purchased,0) + _credits,
      updated_at = now()
  WHERE user_id = v_user;
END;
$func$;

-- Verrouillage : service_role uniquement
REVOKE ALL ON FUNCTION public.stripe_set_customer(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stripe_apply_subscription(text,text,text,text,text,timestamptz,timestamptz,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stripe_downgrade_to_free(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stripe_reset_billing_usage(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stripe_grant_credits(text,int,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stripe_set_customer(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_apply_subscription(text,text,text,text,text,timestamptz,timestamptz,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_downgrade_to_free(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_reset_billing_usage(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_grant_credits(text,int,text,int) TO service_role;;
