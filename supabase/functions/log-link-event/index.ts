import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getClientIp } from "../_shared/ip.ts";
import { isValidUUID, boundStr, LIMITS, readJsonBounded, InputError } from "../_shared/validation.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const visitor_ip = getClientIp(req);
  const supabaseRl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rateLimitOk } = await supabaseRl.rpc("check_rate_limit", { _key: "log-event:" + visitor_ip, _max_requests: 120, _window_seconds: 60 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await readJsonBounded(req);
    const slug = boundStr(body.slug, LIMITS.SLUG);
    const track_id = typeof body.track_id === "string" ? body.track_id : "";
    const visitor_email = boundStr(body.visitor_email, LIMITS.EMAIL) || null;
    const event_type = boundStr(body.event_type, LIMITS.SHORT_TEXT);

    if (!slug || !event_type) {
      return new Response(JSON.stringify({ error: "slug and event_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validEvents = ["play", "download", "view"];
    if (!validEvents.includes(event_type)) {
      return new Response(JSON.stringify({ error: "event_type must be play, download, or view" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (track_id && !isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Invalid track_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find the shared link by slug
    const { data: link, error: linkError } = await supabase
      .from("shared_links")
      .select("id")
      .eq("link_slug", slug)
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into link_events
    const { error: insertError } = await supabase
      .from("link_events")
      .insert({
        link_id: link.id,
        track_id: track_id || null,
        visitor_email: visitor_email || null,
        event_type: event_type,
        visitor_ip,
      });

    if (insertError) {
      console.error("log-link-event: link_events insert failed (code=" + (insertError.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to log event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof InputError) {
      console.error("log-link-event: rejected body (" + err.message + ")");
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("log-link-event: internal error");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
