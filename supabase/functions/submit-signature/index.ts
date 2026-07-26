// Supabase Edge Function: submit-signature
// Records a collaborator's signature on a split agreement, validating the
// opaque token server-side. Replaces the previous anon-writable path so the
// `anon_sign` RLS policy can be locked to USING(false): no anonymous client can
// PATCH signature_requests directly anymore.
//
// POST /submit-signature
// Body: { token: string, signature_data: string }
// Returns: { success: true } or { error: string }
//
// verify_jwt = false — the signer is an anonymous collaborator holding a token.
//
// Deploy: supabase functions deploy submit-signature

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { LIMITS } from "../_shared/validation.ts";

// A signature is a PNG data URL (data:image/png;base64,...). Cap the payload so a
// caller can't push an unbounded blob into the row.
const MAX_SIGNATURE_LEN = 500_000;

Deno.serve(async (req) => {
  // CORS preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "submit-sig:" + ip, _max_requests: 10, _window_seconds: 300 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { token, signature_data } = await req.json();

    // 1. Validate inputs.
    if (typeof token !== "string" || token.trim().length === 0) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof signature_data !== "string" || signature_data.trim().length === 0) {
      return new Response(JSON.stringify({ error: "signature_data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (signature_data.length > MAX_SIGNATURE_LEN) {
      return new Response(JSON.stringify({ error: "signature_data too large" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Opaque access token — cap length (the large field, signature_data, is
    // already bounded by MAX_SIGNATURE_LEN above).
    const cleanToken = token.trim().slice(0, LIMITS.TOKEN);

    // 2. Resolve the signature request for this token.
    const { data: reqRow, error: selErr } = await supabaseAdmin
      .from("signature_requests")
      .select("id, status")
      .eq("token", cleanToken)
      .maybeSingle();

    if (selErr) {
      console.error("submit-signature: select failed (code=" + (selErr.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Could not process signature" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Not found / not pending.
    if (!reqRow) {
      return new Response(JSON.stringify({ error: "Signature request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reqRow.status !== "pending") {
      return new Response(JSON.stringify({ error: "This agreement is no longer pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Sign — scope the write to THIS token's still-pending row. The
    // status='pending' guard also makes the update idempotent under a race
    // (a second concurrent submit affects 0 rows).
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("signature_requests")
      .update({ status: "signed", signed_at: new Date().toISOString(), signature_data })
      .eq("token", cleanToken)
      .eq("status", "pending")
      .select("id");

    if (updErr) {
      console.error("submit-signature: update failed (code=" + (updErr.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Could not save signature" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lost the race (someone else signed between the SELECT and the UPDATE).
    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ error: "This agreement is no longer pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Success — never echo back any of the request's sensitive fields.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-signature: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
