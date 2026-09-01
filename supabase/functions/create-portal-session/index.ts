import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { getAuthedUser, HttpError } from "../_shared/auth.ts";

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

  const ip = getClientIp(req);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", {
    _key: "portal:" + ip,
    _max_requests: 20,
    _window_seconds: 3600,
  });
  if (rateLimitOk === false) {
    return json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  try {
    const { user } = await getAuthedUser(req);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return json({ error: "No billing account found for this user" }, 400);
    }

    const baseUrl = (req.headers.get("origin") || "https://app.trakalog.com").replace(/\/$/, "");

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings/billing`,
    });

    return json({ url: portal.url });
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status);
    }
    console.error("create-portal-session error: " + (err instanceof Error ? err.message : "unknown"));
    return json({ error: "Internal server error" }, 500);
  }
});
