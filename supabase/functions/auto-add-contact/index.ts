import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { workspace_id, email, first_name, last_name, role, company } = await req.json();

    if (!workspace_id || !email || !first_name) {
      return new Response(JSON.stringify({ error: "workspace_id, email, and first_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if contact with this email already exists in this workspace
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, action: "already_exists", id: existing.id }), {
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
