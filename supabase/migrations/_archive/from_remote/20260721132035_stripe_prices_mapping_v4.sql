-- ============================================================
-- stripe_prices : mapping Price ID Stripe -> plan/cycle/crédits/siège
-- Lu par le webhook & la checkout EF. Price IDs non sensibles (public read).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stripe_prices (
  stripe_price_id  text PRIMARY KEY,
  kind             text NOT NULL CHECK (kind IN ('subscription','credits','seat')),
  plan             text CHECK (plan IN ('starter','pro','business')),
  billing_cycle    text CHECK (billing_cycle IN ('monthly','yearly')),
  credits_amount   integer,
  amount_cents     integer NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stripe_prices public read" ON public.stripe_prices;
CREATE POLICY "stripe_prices public read"
  ON public.stripe_prices FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.stripe_prices (stripe_price_id, kind, plan, billing_cycle, credits_amount, amount_cents) VALUES
  ('price_1TZDemJR5z0DJ4DZy3w5lcwv','subscription','starter','monthly', NULL, 1000),
  ('price_1TZDemJR5z0DJ4DZuVPhOWzA','subscription','starter','yearly',  NULL, 9000),
  ('price_1TZDkCJR5z0DJ4DZ0nKSC8qw','subscription','pro',    'monthly', NULL, 2500),
  ('price_1TZDkZJR5z0DJ4DZOgsP3o4D','subscription','pro',    'yearly',  NULL, 22500),
  ('price_1TZDoBJR5z0DJ4DZg3CK2Sg3','subscription','business','monthly',NULL, 4500),
  ('price_1TZDoiJR5z0DJ4DZwYrtlJyT','subscription','business','yearly', NULL, 40500),
  ('price_1TZDs4JR5z0DJ4DZyirFwVsn','credits',      NULL,     NULL,      25,   500),
  ('price_1TZDtdJR5z0DJ4DZ7UdnJSob','credits',      NULL,     NULL,      100,  1500),
  ('price_1TvdSTJR5z0DJ4DZYNmIxlyx','seat',         NULL,     NULL,      NULL, 1000)
ON CONFLICT (stripe_price_id) DO UPDATE SET
  kind=EXCLUDED.kind, plan=EXCLUDED.plan, billing_cycle=EXCLUDED.billing_cycle,
  credits_amount=EXCLUDED.credits_amount, amount_cents=EXCLUDED.amount_cents,
  active=true, updated_at=now();;
