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
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Supabase configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract user_id from the JWT passed in the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create an auth-aware client to get the user, then a service role client for writes
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // 4. Insert into workspace_members
    const { error: memberError } = await supabase
      .from("workspace_members")
      .upsert({ user_id: userId, workspace_id: workspaceId }, { onConflict: "user_id,workspace_id" });

    if (memberError) {
      return new Response(JSON.stringify({ error: "Failed to add workspace member: " + memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Insert into user_roles
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, workspace_id: workspaceId, role: role }, { onConflict: "user_id,workspace_id,role" });

    if (roleError) {
      return new Response(JSON.stringify({ error: "Failed to assign role: " + roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Mark invitation as accepted
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update invitation: " + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, workspace_id: workspaceId }), {
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
