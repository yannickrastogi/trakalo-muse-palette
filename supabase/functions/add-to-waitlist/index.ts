import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";

// Loose RFC-5322-ish email validation. We only need to reject obviously malformed
// values — final uniqueness is enforced server-side by the waitlist UNIQUE index.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254; // per RFC 5321

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRejection = rejectInvalidOrigin(req);
  if (originRejection) return originRejection;
  const corsHeaders = getCorsHeaders(req);

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email : "";

    const email = rawEmail.trim().toLowerCase();
    if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit per IP: 5 requests per 15 minutes (per CLAUDE.md spec)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", {
      _key: "add-to-waitlist:" + ip,
      _max_requests: 5,
      _window_seconds: 900,
    });
    if (rateLimitOk === false) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Service-role insert. The waitlist table is otherwise un-writeable from the client
    // (no anon INSERT policy). The UNIQUE index on email surfaces duplicates as 23505.
    // The table has 5 real columns: id, email, created_at, invited_at,
    // invitation_sent_by — `email` is the only one we set; the rest default.
    const { error: insertErr } = await supabaseAdmin.from("waitlist").insert({ email });

    if (insertErr) {
      // Duplicate email is a success-equivalent for the user-facing flow.
      if (insertErr.code === "23505") {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Mask schema details — log server-side, return a generic message.
      console.error("[add-to-waitlist] insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "Could not save your email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[add-to-waitlist] unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
