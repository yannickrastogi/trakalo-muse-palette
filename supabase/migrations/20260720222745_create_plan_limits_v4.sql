-- ============================================================
-- plan_limits : source de vérité serveur des plans (BILLING v4.0)
-- Convention : -1 = illimité. Storage en bytes décimaux (GB = 1e9).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan                  text PRIMARY KEY CHECK (plan IN ('free','starter','pro','business')),
  tracks_max            integer NOT NULL,
  storage_bytes_max     bigint  NOT NULL,
  playlists_max         integer NOT NULL,
  shared_links_max      integer NOT NULL,
  contacts_max          integer NOT NULL,
  pitches_per_month     integer NOT NULL,
  smart_ar_per_month    integer NOT NULL,
  smart_ar_lifetime     integer,
  workspaces_max        integer NOT NULL,
  seats_included        integer NOT NULL,
  seats_addon_allowed   boolean NOT NULL,
  seat_addon_price_cents integer,
  viewers_unlimited     boolean NOT NULL,
  can_buy_credits       boolean NOT NULL,
  price_monthly_cents   integer NOT NULL,
  price_yearly_cents    integer NOT NULL,
  features              jsonb   NOT NULL DEFAULT '{}'::jsonb,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_limits public read" ON public.plan_limits;
CREATE POLICY "plan_limits public read"
  ON public.plan_limits FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.plan_limits (
  plan, tracks_max, storage_bytes_max, playlists_max, shared_links_max, contacts_max,
  pitches_per_month, smart_ar_per_month, smart_ar_lifetime,
  workspaces_max, seats_included, seats_addon_allowed, seat_addon_price_cents, viewers_unlimited,
  can_buy_credits, price_monthly_cents, price_yearly_cents, features
) VALUES
  ('free',      10,   1500000000,      1,  1,  10,
   0,   0,    2,
   1,  1,  false, NULL,  false,
   false, 0,    0,
   '{"stems":false,"watermarking":false,"leak_tracing":false,"custom_branding":false,"lyrics_transcription":false,"splits_signatures":false,"qr_studio":false,"catalog_sharing":false,"trakalog_access":false,"contact_export":false,"approvals":false,"radio":true,"sonic_dna":true,"priority_support":false}'::jsonb),

  ('starter',   100,  40000000000,     -1, -1, -1,
   15,  15,   NULL,
   1,  1,  false, NULL,  false,
   true,  1000, 9000,
   '{"stems":true,"watermarking":true,"leak_tracing":true,"custom_branding":true,"lyrics_transcription":true,"splits_signatures":true,"qr_studio":true,"catalog_sharing":false,"trakalog_access":false,"contact_export":false,"approvals":false,"radio":true,"sonic_dna":true,"priority_support":false}'::jsonb),

  ('pro',       1000, 400000000000,    -1, -1, -1,
   -1,  50,   NULL,
   5,  5,  true,  1000,  true,
   true,  2500, 22500,
   '{"stems":true,"watermarking":true,"leak_tracing":true,"custom_branding":true,"lyrics_transcription":true,"splits_signatures":true,"qr_studio":true,"catalog_sharing":true,"trakalog_access":true,"contact_export":true,"approvals":true,"radio":true,"sonic_dna":true,"priority_support":false}'::jsonb),

  ('business',  5000, 2000000000000,   -1, -1, -1,
   -1,  500,  NULL,
   15, 10, true,  1000,  true,
   true,  4500, 40500,
   '{"stems":true,"watermarking":true,"leak_tracing":true,"custom_branding":true,"lyrics_transcription":true,"splits_signatures":true,"qr_studio":true,"catalog_sharing":true,"trakalog_access":true,"contact_export":true,"approvals":true,"radio":true,"sonic_dna":true,"priority_support":true}'::jsonb)
ON CONFLICT (plan) DO UPDATE SET
  tracks_max = EXCLUDED.tracks_max,
  storage_bytes_max = EXCLUDED.storage_bytes_max,
  playlists_max = EXCLUDED.playlists_max,
  shared_links_max = EXCLUDED.shared_links_max,
  contacts_max = EXCLUDED.contacts_max,
  pitches_per_month = EXCLUDED.pitches_per_month,
  smart_ar_per_month = EXCLUDED.smart_ar_per_month,
  smart_ar_lifetime = EXCLUDED.smart_ar_lifetime,
  workspaces_max = EXCLUDED.workspaces_max,
  seats_included = EXCLUDED.seats_included,
  seats_addon_allowed = EXCLUDED.seats_addon_allowed,
  seat_addon_price_cents = EXCLUDED.seat_addon_price_cents,
  viewers_unlimited = EXCLUDED.viewers_unlimited,
  can_buy_credits = EXCLUDED.can_buy_credits,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  features = EXCLUDED.features,
  updated_at = now();;
