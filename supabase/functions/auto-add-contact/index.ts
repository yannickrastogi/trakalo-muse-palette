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

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: rateLimitOk } = await supabase.rpc("check_rate_limit", { _key: "auto-contact:" + ip, _max_requests: 30, _window_seconds: 3600 });
  if (rateLimitOk === false) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { workspace_id, email, first_name, last_name, role, company, pro, ipi, publisher, city, country } = await req.json();

    // Normalize email (lowercase + trim) to align with case-insensitive dedup & unique index lower(email)
    const normEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
    // Escape LIKE wildcards (_ and % are common-ish in emails) for an exact case-insensitive match
    const emailPattern = typeof normEmail === "string" ? normEmail.replace(/([%_\\])/g, "\\$1") : normEmail;

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
    // Validate optional country input (must be a non-empty trimmed string ≤ 100 chars; otherwise null)
    const cleanCountry = typeof country === "string" && country.trim().length > 0 && country.trim().length <= 100
      ? country.trim() : null;
    const cleanCity = typeof city === "string" && city.trim().length > 0 && city.trim().length <= 100
      ? city.trim() : null;

    const { data: existing } = await supabase
      .from("contacts")
      .select("id, pro, ipi, publisher, city, country")
      .eq("workspace_id", workspace_id)
      .ilike("email", emailPattern)
      .maybeSingle();

    if (existing) {
      // Update empty fields with new values
      const updates: Record<string, string> = {};
      if (!existing.pro && pro) updates.pro = pro;
      if (!existing.ipi && ipi) updates.ipi = ipi;
      if (!existing.publisher && publisher) updates.publisher = publisher;
      if (!existing.city && cleanCity) updates.city = cleanCity;
      if (!existing.country && cleanCountry) updates.country = cleanCountry;
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
        email: normEmail,
        first_name,
        last_name: last_name || null,
        role: role || null,
        company: company || null,
        pro: pro || null,
        ipi: ipi || null,
        publisher: publisher || null,
        city: cleanCity,
        country: cleanCountry,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("auto-add-contact: contacts insert failed (code=" + (insertError.code || "unknown") + ")");
      return new Response(JSON.stringify({ error: "Failed to save contact" }), {
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
