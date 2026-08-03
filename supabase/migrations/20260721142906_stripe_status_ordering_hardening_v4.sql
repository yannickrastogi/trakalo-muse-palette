-- Durcissement contre le désordre d'events Stripe.

-- apply_subscription : ne jamais rétrograder active/trialing -> incomplete
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
      subscription_status    = CASE
                                 WHEN subscription_status IN ('active','trialing')
                                   AND _status IN ('incomplete','incomplete_expired')
                                 THEN subscription_status
                                 ELSE _status END,
      stripe_subscription_id = _stripe_sub_id,
      current_period_start   = _period_start,
      current_period_end     = _period_end,
      cancel_at_period_end   = coalesce(_cancel_at_period_end, false),
      canceled_at            = NULL,
      updated_at             = now()
  WHERE stripe_customer_id = _customer_id;
END;
$func$;

-- invoice.paid : paiement confirmé -> forcer active (en plus du reset)
CREATE OR REPLACE FUNCTION public.stripe_reset_billing_usage(_customer_id text, _new_reset_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET pitches_sent_this_month     = 0,
      smart_ar_queries_this_month = 0,
      ai_credits_monthly_used     = 0,
      ai_credits_reset_at         = _new_reset_at,
      subscription_status         = 'active',
      updated_at                  = now()
  WHERE stripe_customer_id = _customer_id
    AND (ai_credits_reset_at IS NULL OR _new_reset_at > ai_credits_reset_at);
END;
$func$;;
