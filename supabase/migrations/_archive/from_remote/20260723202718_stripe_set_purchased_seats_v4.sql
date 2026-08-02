-- Webhook : synchronise la quantité du line item "seat" de l'abonnement Stripe
CREATE OR REPLACE FUNCTION public.stripe_set_purchased_seats(_customer_id text, _seats integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $func$
BEGIN
  UPDATE public.subscriptions
  SET purchased_seats = greatest(coalesce(_seats,0), 0), updated_at = now()
  WHERE stripe_customer_id = _customer_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.stripe_set_purchased_seats(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stripe_set_purchased_seats(text,integer) TO service_role;

NOTIFY pgrst, 'reload schema';;
