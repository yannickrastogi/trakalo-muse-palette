import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidEmail } from "../_shared/email-template.ts";

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
    const { slug, name: rawName, email: rawEmail, role, company, city, country } = await req.json();

    if (!slug || !rawName || !rawEmail) {
      return new Response(JSON.stringify({ error: "slug, name, and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap visitor-supplied identity to 200 chars and validate email format before
    // any DB write (public endpoint — untrusted input).
    const name = typeof rawName === "string" ? rawName.trim().slice(0, 200) : "";
    const email = typeof rawEmail === "string" ? rawEmail.trim().slice(0, 200) : "";
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "slug, name, and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional location inputs (trimmed, ≤ 100 chars, otherwise null)
    const cleanCity = typeof city === "string" && city.trim().length > 0 && city.trim().length <= 100
      ? city.trim() : null;
    const cleanCountry = typeof country === "string" && country.trim().length > 0 && country.trim().length <= 100
      ? country.trim() : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the shared link by slug (include track title for notification)
    const { data: link, error: linkError } = await supabase
      .from("shared_links")
      .select("id, workspace_id, track_id, link_name, status, expires_at")
      .eq("link_slug", slug)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only log access for a live link — never write download/contact rows for an
    // inactive or expired link (a public endpoint should not accept stale slugs).
    if (link.status !== "active") {
      return new Response(JSON.stringify({ error: "Link is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link has expired" }), {
        status: 403,
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
      console.error("log-link-access: link_downloads insert failed (code=" + (dlError.code || "unknown") + ")");
    }

    // Upsert into contacts: insert if new, fill missing city/country if contact already exists
    if (email) {
      var { data: existing } = await supabase
        .from("contacts")
        .select("id, city, country")
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
            city: cleanCity,
            country: cleanCountry,
          });

        if (contactError) {
          console.error("log-link-access: contact insert failed (code=" + (contactError.code || "unknown") + ")");
        }
      } else {
        // Enrich existing contact with newly-provided location if their record was empty.
        // Don't overwrite existing values (the contact may have manually-curated info).
        const updates: Record<string, string> = {};
        if (!existing.city && cleanCity) updates.city = cleanCity;
        if (!existing.country && cleanCountry) updates.country = cleanCountry;
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from("contacts").update(updates).eq("id", existing.id);
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
        }).catch(() => console.error("log-link-access: notification email dispatch failed"));
      }
    } catch {
      console.error("log-link-access: notification lookup failed");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("log-link-access: internal error (" + (err instanceof Error ? err.name : "unknown") + ")");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
