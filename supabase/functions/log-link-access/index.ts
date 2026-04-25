import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const visitor_ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const supabaseRl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseRl.rpc("check_rate_limit", { _key: "log-access:" + visitor_ip, _max_requests: 120, _window_seconds: 60 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { slug, name, email, role, company } = await req.json();

    if (!slug || !name || !email) {
      return new Response(JSON.stringify({ error: "slug, name, and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the shared link by slug (include track title for notification)
    const { data: link, error: linkError } = await supabase
      .from("shared_links")
      .select("id, workspace_id, track_id, link_name")
      .eq("link_slug", slug)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split name into first/last for contacts table
    var nameParts = name.trim().split(" ");
    var firstName = nameParts[0] || "";
    var lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    // Insert into link_downloads
    var { error: dlError } = await supabase
      .from("link_downloads")
      .insert({
        link_id: link.id,
        downloader_name: name,
        downloader_email: email,
        organization: company || null,
        role: role || null,
        downloaded_at: new Date().toISOString(),
        visitor_ip,
      });

    if (dlError) {
      console.error("Error inserting link_downloads:", dlError);
    }

    // Upsert into contacts (only if email doesn't already exist in this workspace)
    if (email) {
      var { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", link.workspace_id)
        .eq("email", email)
        .maybeSingle();

      if (!existing) {
        var { error: contactError } = await supabase
          .from("contacts")
          .insert({
            workspace_id: link.workspace_id,
            first_name: firstName,
            last_name: lastName || null,
            email: email,
            company: company || null,
            role: role || null,
          });

        if (contactError) {
          console.error("Error inserting contact:", contactError);
        }
      }
    }

    // Send notification email to workspace owner (fire-and-forget)
    try {
      const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", link.workspace_id).maybeSingle();
      if (ws?.owner_id) {
        // Get track title if available
        let trackTitle = link.link_name || "";
        if (link.track_id && !trackTitle) {
          const { data: track } = await supabase.from("tracks").select("title").eq("id", link.track_id).maybeSingle();
          if (track?.title) trackTitle = track.title;
        }
        fetch(supabaseUrl + "/functions/v1/send-notification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + serviceRoleKey },
          body: JSON.stringify({
            event_type: "link_activity",
            user_id: ws.owner_id,
            data: { visitor_name: name, visitor_email: email, track_title: trackTitle, link_slug: slug },
          }),
        }).catch((e) => console.error("Notification email error:", e));
      }
    } catch (e) {
      console.error("Notification lookup error:", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
