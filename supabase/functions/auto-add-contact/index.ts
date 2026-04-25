import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/validation.ts";

serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "auto-contact:" + ip, _max_requests: 30, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { workspace_id, email, first_name, last_name, role, company, pro, ipi, publisher } = await req.json();

    if (!workspace_id || !email || !first_name) {
      return new Response(JSON.stringify({ error: "workspace_id, email, and first_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUUID(workspace_id)) {
      return new Response(JSON.stringify({ error: "Invalid workspace_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that workspace_id is a real workspace
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspace_id)
      .single();

    if (wsError || !ws) {
      return new Response(JSON.stringify({ error: "Invalid workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if contact with this email already exists in this workspace
    const { data: existing } = await supabase
      .from("contacts")
      .select("id, pro, ipi, publisher")
      .eq("workspace_id", workspace_id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Update empty fields with new values
      const updates: Record<string, string> = {};
      if (!existing.pro && pro) updates.pro = pro;
      if (!existing.ipi && ipi) updates.ipi = ipi;
      if (!existing.publisher && publisher) updates.publisher = publisher;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from("contacts").update(updates).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ success: true, action: "updated", id: existing.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new contact
    const { data: inserted, error: insertError } = await supabase
      .from("contacts")
      .insert({
        workspace_id,
        email,
        first_name,
        last_name: last_name || null,
        role: role || null,
        company: company || null,
        pro: pro || null,
        ipi: ipi || null,
        publisher: publisher || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert contact error:", insertError.message);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, action: "created", id: inserted.id }), {
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
