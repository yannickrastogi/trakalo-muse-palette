import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getAuthedUser, HttpError } from "../_shared/auth.ts";

// Stripe on Deno edge: use the fetch-based HTTP client.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", {
    _key: "checkout:" + ip,
    _max_requests: 20,
    _window_seconds: 3600,
  });
  if (rateLimitOk === false) {
    return json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  try {
    const { user } = await getAuthedUser(req);

    const body = await req.json().catch(() => ({}));
    const plan = typeof body.plan === "string" ? body.plan : null;
    const billingCycle = typeof body.billing_cycle === "string" ? body.billing_cycle : null;
    const creditsPack = typeof body.credits_pack === "number" ? body.credits_pack : null;

    const isSubscription = plan !== null;
    const isCredits = creditsPack !== null;
    // Exactly one of { plan+billing_cycle } | { credits_pack } is required.
    if (isSubscription && isCredits) {
      return json({ error: "Send either { plan, billing_cycle } or { credits_pack }, not both" }, 400);
    }
    if (!isSubscription && !isCredits) {
      return json({ error: "Missing { plan, billing_cycle } or { credits_pack }" }, 400);
    }

    // Resolve the Stripe price by READING the stripe_prices table — never hard-code price ids.
    let priceId: string | null = null;
    let kind: "subscription" | "credits";
    if (isSubscription) {
      kind = "subscription";
      if (!billingCycle) return json({ error: "billing_cycle is required for a subscription" }, 400);
      const { data: price, error } = await supabase
        .from("stripe_prices")
        .select("stripe_price_id")
        .eq("kind", "subscription")
        .eq("plan", plan)
        .eq("billing_cycle", billingCycle)
        .eq("active", true)
        .maybeSingle();
      if (error) throw new Error("price lookup failed");
      priceId = price?.stripe_price_id ?? null;
    } else {
      kind = "credits";
      const { data: price, error } = await supabase
        .from("stripe_prices")
        .select("stripe_price_id")
        .eq("kind", "credits")
        .eq("credits_amount", creditsPack)
        .eq("active", true)
        .maybeSingle();
      if (error) throw new Error("price lookup failed");
      priceId = price?.stripe_price_id ?? null;
    }

    if (!priceId) {
      return json({ error: "No matching price found for the requested product" }, 400);
    }

    // Fetch or create the Stripe customer for this user.
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      // Idempotency key keyed on user_id: a retry after a partial failure returns
      // the SAME customer instead of creating a Stripe orphan.
      const customer = await stripe.customers.create(
        {
          email: user.email,
          metadata: { user_id: user.id },
        },
        { idempotencyKey: "customer_create_" + user.id },
      );
      customerId = customer.id;
      const { error: setErr } = await supabase.rpc("stripe_set_customer", {
        _user_id: user.id,
        _customer_id: customerId,
      });
      if (setErr) throw new Error("failed to persist customer");
    }

    // Origin already validated by rejectInvalidOrigin (allowlist or absent).
    const baseUrl = (req.headers.get("origin") || "https://app.trakalog.com").replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id, kind },
      success_url: `${baseUrl}/settings/billing?checkout=success`,
      cancel_url: `${baseUrl}/settings/billing?checkout=cancel`,
    });

    return json({ url: session.url });
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status);
    }
    console.error("create-checkout-session error: " + (err instanceof Error ? err.message : "unknown"));
    return json({ error: "Internal server error" }, 500);
  }
});
