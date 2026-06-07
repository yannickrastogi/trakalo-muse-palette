import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors, rejectInvalidOrigin } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const originRes = rejectInvalidOrigin(req);
  if (originRes) return originRes;
  const corsHeaders = getCorsHeaders(req);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase configuration missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseRl = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: rateLimitOk } = await supabaseRl.rpc("check_rate_limit", { _key: "accept-inv:" + ip, _max_requests: 10, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { token, user_id } = await req.json();

    if (!token || !user_id) {
      return new Response(JSON.stringify({ error: "token and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUUID(user_id)) {
      return new Response(JSON.stringify({ error: "Invalid user_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user_id;
    const supabase = supabaseRl;

    // 1. Find the invitation by token
    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify the invitation is still pending
    if (invitation.status !== "pending") {
      return new Response(JSON.stringify({ error: "This invitation has already been " + invitation.status }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This invitation has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = invitation.workspace_id;
    const role = invitation.role;
    const accessLevel = invitation.access_level || "viewer";
    const professionalTitle = invitation.professional_title || null;

    // 4. Insert into workspace_members
    const memberData: Record<string, unknown> = { user_id: userId, workspace_id: workspaceId, access_level: accessLevel };
    if (professionalTitle) memberData.professional_title = professionalTitle;
    const { error: memberError } = await supabase
      .from("workspace_members")
      .upsert(memberData, { onConflict: "user_id,workspace_id" });

    if (memberError) {
      console.error("accept-invitation: workspace_members upsert failed (code=" + (memberError.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to join workspace" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Mark invitation as accepted
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("accept-invitation: invitations update failed (code=" + (updateError.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to update invitation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. P1-07 (BUG-02): whitelist the auth user's REAL email so they can log
    // back in even when the invitation was sent to a different email than the
    // one they used at signup. Without this, the user accepts the invite once
    // but is then trapped in the login loop because `is_email_whitelisted` is
    // checked against auth.email, not invitation.email.
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const authEmail = authUser?.user?.email?.toLowerCase().trim();
      if (authEmail) {
        const { error: whitelistErr } = await supabase
          .from("whitelisted_emails")
          .upsert({ email: authEmail }, { onConflict: "email" });
        if (whitelistErr) {
          console.error("accept-invitation: whitelist upsert failed (code=" + (whitelistErr.code || "unknown") + ")");
        }
      } else {
        console.error("accept-invitation: could not resolve auth email for user " + userId);
      }
    } catch (whitelistEx) {
      console.error("accept-invitation: whitelist lookup threw", whitelistEx);
    }

    // Send notification to workspace owner (fire-and-forget)
    try {
      const { data: ws } = await supabase.from("workspaces").select("owner_id, name").eq("id", workspaceId).maybeSingle();
      if (ws?.owner_id && ws.owner_id !== userId) {
        const { data: memberProfile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
        fetch(SUPABASE_URL + "/functions/v1/send-notification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
          body: JSON.stringify({
            event_type: "new_member",
            user_id: ws.owner_id,
            data: { member_name: memberProfile?.full_name || invitation.email, member_email: memberProfile?.email || invitation.email, workspace_name: ws.name },
          }),
        }).catch(() => console.error("accept-invitation: notification email dispatch failed"));
      }
    } catch {
      console.error("accept-invitation: notification lookup failed");
    }

    return new Response(JSON.stringify({ success: true, workspace_id: workspaceId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
