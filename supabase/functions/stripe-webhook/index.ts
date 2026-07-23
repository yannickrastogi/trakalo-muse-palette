import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// verify_jwt = false: Stripe calls this without a Supabase JWT. Authenticity is
// guaranteed by the Stripe signature over the RAW body, not by a JWT.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});
// Deno's Web Crypto is async → use the SubtleCrypto provider + constructEventAsync.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const toIso = (unixSeconds: unknown): string | null =>
  typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Missing signature", { status: 400 });
  }

  // CRITICAL: read the RAW body and verify the signature BEFORE parsing JSON.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed: " + (err instanceof Error ? err.message : "unknown"));
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const items = sub.items?.data ?? [];

        if (items.length === 0) {
          console.warn("stripe-webhook: subscription without items, sub=" + sub.id);
          break;
        }

        // Resolve EVERY line item's price via stripe_prices in one query, then
        // classify by kind: 'subscription' drives the plan, 'seat' the add-on qty.
        const priceIds = items
          .map((it) => it.price?.id)
          .filter((id): id is string => typeof id === "string");
        const { data: priceRows } = await supabase
          .from("stripe_prices")
          .select("stripe_price_id, kind, plan, billing_cycle")
          .in("stripe_price_id", priceIds);
        const priceById = new Map(
          (priceRows ?? []).map((p) => [p.stripe_price_id as string, p]),
        );

        let planItem: Stripe.SubscriptionItem | null = null;
        let planRow: { plan: string | null; billing_cycle: string | null } | null = null;
        let seatQty = 0; // 0 when no seat add-on present (or it was removed)
        for (const it of items) {
          const row = it.price?.id ? priceById.get(it.price.id) : undefined;
          if (!row) continue;
          if (row.kind === "subscription") {
            planItem = it;
            planRow = { plan: row.plan, billing_cycle: row.billing_cycle };
          } else if (row.kind === "seat") {
            seatQty += it.quantity ?? 0;
          }
        }

        if (!planItem || !planRow?.plan || !planRow?.billing_cycle) {
          console.warn("stripe-webhook: no subscription plan item resolved for sub " + sub.id);
          break;
        }

        // Period bounds live at subscription or item level depending on API version.
        const periodStart = toIso((sub as unknown as { current_period_start?: number }).current_period_start
          ?? (planItem as unknown as { current_period_start?: number })?.current_period_start);
        const periodEnd = toIso((sub as unknown as { current_period_end?: number }).current_period_end
          ?? (planItem as unknown as { current_period_end?: number })?.current_period_end);

        const { error } = await supabase.rpc("stripe_apply_subscription", {
          _customer_id: customerId,
          _plan: planRow.plan,
          _cycle: planRow.billing_cycle,
          _status: sub.status,
          _stripe_sub_id: sub.id,
          _period_start: periodStart,
          _period_end: periodEnd,
          _cancel_at_period_end: sub.cancel_at_period_end ?? false,
        });
        if (error) throw new Error("stripe_apply_subscription: " + error.message);

        // Sync purchased seat add-ons (resets to 0 when the seat item is gone).
        const { error: seatErr } = await supabase.rpc("stripe_set_purchased_seats", {
          _customer_id: customerId,
          _seats: seatQty,
        });
        if (seatErr) throw new Error("stripe_set_purchased_seats: " + seatErr.message);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const { error } = await supabase.rpc("stripe_downgrade_to_free", { _customer_id: customerId });
        if (error) throw new Error("stripe_downgrade_to_free: " + error.message);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only reset usage on subscription renewals — NOT on one-off credit invoices,
        // otherwise buying credits would wipe the current period's usage counters.
        const billingReason = invoice.billing_reason ?? "";
        if (!["subscription_cycle", "subscription_create", "subscription_update"].includes(billingReason)) {
          break;
        }
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        // New billing period end from the invoice line (fallback to invoice.period_end).
        const line = (invoice.lines?.data?.[0] as unknown as { period?: { end?: number } } | undefined);
        const newResetAt = toIso(line?.period?.end ?? (invoice as unknown as { period_end?: number }).period_end);
        if (!newResetAt) break;
        const { error } = await supabase.rpc("stripe_reset_billing_usage", {
          _customer_id: customerId,
          _new_reset_at: newResetAt,
        });
        if (error) throw new Error("stripe_reset_billing_usage: " + error.message);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only one-time credit purchases are handled here; subscriptions flow
        // through customer.subscription.* events.
        if (session.mode !== "payment") break;

        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (!customerId) break;

        // Line items aren't embedded in the event → fetch them to resolve the price.
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data?.[0]?.price?.id ?? null;
        if (!priceId) {
          console.warn("stripe-webhook: payment session without a price, session=" + session.id);
          break;
        }

        const { data: price } = await supabase
          .from("stripe_prices")
          .select("credits_amount")
          .eq("stripe_price_id", priceId)
          .maybeSingle();

        if (!price?.credits_amount) {
          console.warn("stripe-webhook: no credits mapping for price " + priceId);
          break;
        }

        const paymentIntent = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

        const { error } = await supabase.rpc("stripe_grant_credits", {
          _customer_id: customerId,
          _credits: price.credits_amount,
          _payment_intent: paymentIntent,
          _amount_cents: session.amount_total ?? 0,
        });
        if (error) throw new Error("stripe_grant_credits: " + error.message);
        break;
      }

      default:
        // Unhandled event types are fine — acknowledge without failing.
        console.log("stripe-webhook: unhandled event type " + event.type);
    }
  } catch (err) {
    // Processing failed → return 500 so Stripe retries (billing must stay consistent).
    console.error("stripe-webhook: handler error for " + event.type + ": " + (err instanceof Error ? err.message : "unknown"));
    return new Response(JSON.stringify({ error: "handler_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Acknowledge receipt quickly.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
