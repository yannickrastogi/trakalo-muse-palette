import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { buildEmail, isValidEmail, htmlEscape } from "../_shared/email-template.ts";
import { sanitizeEmailSubject } from "../_shared/validation.ts";

// Sends a Trakalog shared link (track / playlist / stems / pack) to one or more
// recipients by email, branded with the workspace. Hardened against abuse:
//  - The CALLER is authenticated via their user JWT (not the public anon key) —
//    no open email relay from noreply@trakalog.com.
//  - The workspace + branding are derived from the LINK (shared_links row) and the
//    caller must be a member of that workspace — no workspace impersonation.
//  - The sender identity (from/reply-to) is derived from the authenticated user,
//    never from the request body.
//  - The public URL is reconstructed server-side from the validated slug — the
//    client never supplies a full URL (no phishing).
//  - One email is sent PER recipient (recipients never see each other).
const APP_BASE = "https://app.trakalog.com";
const MAX_RECIPIENTS = 20;

const ITEM_LABELS: Record<string, string> = {
  track: "track",
  playlist: "playlist",
  stems: "stems",
  pack: "pack",
};

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Authenticate the caller (user JWT, not the anon key) ────────────────
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Unauthorized" }, 401);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
  const caller = userData?.user;
  if (userErr || !caller) return json({ error: "Unauthorized" }, 401);

  // Rate-limit by authenticated user id (not client-controlled IP).
  const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "send-shared-link:" + caller.id, _max_requests: 20, _window_seconds: 3600 });
  if (rateLimitOk === false) return json({ error: "Too many requests. Please try again later." }, 429);

  try {
    const { recipients, message, link_slug, item_type, item_name } = await req.json();

    // ── Validate recipients ──────────────────────────────────────────────
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return json({ error: "At least one recipient is required" }, 400);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return json({ error: "Too many recipients (max " + MAX_RECIPIENTS + ")" }, 400);
    }
    const cleanRecipients: string[] = [];
    for (const r of recipients) {
      const email = String(r || "").trim().toLowerCase();
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email: " + email }, 400);
      }
      if (cleanRecipients.indexOf(email) < 0) cleanRecipients.push(email);
    }

    // ── Validate slug ────────────────────────────────────────────────────
    if (typeof link_slug !== "string" || !/^[A-Za-z0-9]{6,64}$/.test(link_slug)) {
      return json({ error: "Invalid link" }, 400);
    }

    // ── Resolve the link + authorize the caller (membership of the link's
    //    workspace). The workspace is taken from the DB row, never the client. ─
    const { data: link } = await supabaseAdmin
      .from("shared_links")
      .select("workspace_id, status")
      .eq("link_slug", link_slug)
      .single();
    if (!link) return json({ error: "Link not found" }, 404);
    if (link.status !== "active") return json({ error: "Link is not active" }, 400);

    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", link.workspace_id)
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const shareUrl = APP_BASE + "/share/" + link_slug;

    // ── Branding (from the link's workspace) ─────────────────────────────
    let logoUrl = "";
    let brandColor = "";
    let workspaceName = "";
    const { data: ws } = await supabaseAdmin.from("workspaces").select("logo_url, brand_color, name").eq("id", link.workspace_id).single();
    if (ws) {
      logoUrl = ws.logo_url || "";
      brandColor = ws.brand_color || "";
      workspaceName = ws.name || "";
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    // ── Sender identity from the authenticated user (never from the body) ─
    const fromNameRaw = (caller.user_metadata && (caller.user_metadata as Record<string, unknown>).full_name as string) || caller.email || "Someone";
    const fromEmail = caller.email && isValidEmail(caller.email) ? caller.email : undefined;

    const label = ITEM_LABELS[String(item_type)] || "link";
    const safeName = htmlEscape(String(fromNameRaw));
    const safeWsName = htmlEscape(workspaceName);
    const safeItemName = htmlEscape(String(item_name || "").trim());
    const headingText = safeName + " shared a " + label + " with you" + (safeWsName ? " on " + safeWsName : "");
    const subject = sanitizeEmailSubject((String(item_name || "").trim() ? String(item_name).trim() + " — " : "") + "Shared with you via Trakalog");

    const messageBlock = message && String(message).trim()
      ? '<p style="border-left:3px solid ' + (brandColor || '#ec4899') + ';padding:12px 16px;margin:20px 0;background:rgba(255,255,255,0.03);color:#d4d4d8;font-style:italic;border-radius:0 8px 8px 0;">' + htmlEscape(String(message)) + '</p>'
      : '';
    const itemLine = safeItemName
      ? '<p style="font-family:Arial,sans-serif;font-size:15px;color:#ffffff;margin:8px 0;"><strong>' + safeItemName + '</strong></p>'
      : '';
    const bodyContent = '<p>Hi,</p>' + itemLine + messageBlock;

    const htmlBody = buildEmail({
      workspaceName: workspaceName || undefined,
      workspaceLogoUrl: logoUrl || null,
      brandColor: brandColor || null,
      preheader: headingText,
      heading: headingText,
      body: bodyContent,
      ctaLabel: "Open " + label,
      ctaUrl: shareUrl,
    });

    // ── Send one email per recipient (no cross-exposure) ─────────────────
    let sent = 0;
    const failed: string[] = [];
    for (const to of cleanRecipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + RESEND_API_KEY },
          body: JSON.stringify({
            from: "Trakalog <noreply@trakalog.com>",
            reply_to: fromEmail,
            to: [to],
            subject,
            html: htmlBody,
          }),
        });
        if (res.ok) sent++;
        else {
          failed.push(to);
          const err = await res.json().catch(() => ({}));
          console.error("[send-shared-link] Resend failed for a recipient:", res.status, err?.message || "");
        }
      } catch (e) {
        failed.push(to);
        console.error("[send-shared-link] send error:", e instanceof Error ? e.message : String(e));
      }
    }

    if (sent === 0) {
      return json({ error: "Failed to send email", sent: 0, failed: failed.length }, 502);
    }
    return json({ success: true, sent, failed: failed.length }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
