import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { buildEmail, isValidEmail } from "../_shared/email-template.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limit: 10 invites per hour per IP
  const ip = getClientIp(req);
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", {
    _key: "send-waitlist-invite:" + ip,
    _max_requests: 10,
    _window_seconds: 3600,
  });
  if (rateLimitOk === false) {
    return json(429, { error: "Too many requests. Please try again later." });
  }

  // Auth: extract JWT and verify user
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return json(401, { error: "Missing authorization header" });
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user?.id) {
    return json(401, { error: "Invalid session" });
  }
  const userId = userData.user.id;

  // Authorization: must be a platform admin
  const { data: isAdmin, error: adminErr } = await supabaseAdmin.rpc("is_platform_admin", {
    _user_id: userId,
  });
  if (adminErr) {
    return json(500, { error: "Admin check failed" });
  }
  if (isAdmin !== true) {
    return json(403, { error: "Forbidden: not a platform admin" });
  }

  // Parse + validate body
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return json(400, { error: "Invalid email format" });
  }

  // Add to whitelist
  const { error: whitelistErr } = await supabaseAdmin.rpc("add_to_whitelist", {
    _user_id: userId,
    _email: rawEmail,
  });
  if (whitelistErr) {
    return json(500, { error: "Failed to add to whitelist: " + whitelistErr.message });
  }

  // Send email via Resend
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return json(500, { error: "RESEND_API_KEY not configured" });
  }

  const ctaUrl =
    "https://app.trakalog.com/auth?signup=true&email=" + encodeURIComponent(rawEmail);

  const htmlBody = buildEmail({
    preheader: "Your Trakalog early access is now active.",
    heading: "Welcome to Trakalog",
    body:
      "<p>Hi!</p>" +
      "<p>Your early access to Trakalog is now active. Click below to create your account and start managing your music catalog with the most secure platform built for music professionals.</p>",
    ctaLabel: "Create my account",
    ctaUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "Trakalog <noreply@trakalog.com>",
      to: [rawEmail],
      subject: "Your Trakalog early access is ready",
      html: htmlBody,
    }),
  });

  const resendData = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(res.status, {
      error: (resendData as { message?: string })?.message || "Failed to send email",
    });
  }

  // Mark as invited (best effort — log but do not fail the response if this errors,
  // since the email was sent successfully and the whitelist entry exists)
  const { error: markErr } = await supabaseAdmin.rpc("mark_waitlist_invited", {
    _user_id: userId,
    _email: rawEmail,
  });
  if (markErr) {
    console.error("mark_waitlist_invited failed:", markErr.message);
  }

  return json(200, { success: true });
});
