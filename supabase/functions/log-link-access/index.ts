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

    // Find the shared link by slug
    const { data: link, error: linkError } = await supabase
      .from("shared_links")
      .select("id, workspace_id")
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
