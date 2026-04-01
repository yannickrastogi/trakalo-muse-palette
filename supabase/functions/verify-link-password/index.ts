import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

async function verifyPassword(password, stored) {
  const parts = stored.split(":");
  const saltHex = parts[0];
  const hashHex = parts[1];
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(function(b) { return parseInt(b, 16); }));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const hashHexComputed = Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
  return hashHexComputed === hashHex;
}

serve(async function(req) {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  const corsHeaders = getCorsHeaders(req);
  try {
    const body = await req.json();
    const slug = body.slug;
    const password = body.password;
    if (!slug || !password) {
      return new Response(JSON.stringify({ valid: false, error: "Slug and password are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const { data: rateLimitOk } = await supabaseAdmin.rpc("check_rate_limit", { _key: "verify-link-password:" + ip, _max_requests: 5, _window_seconds: 300 });
    if (rateLimitOk === false) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = await supabaseAdmin.from("shared_links").select("password_hash").eq("link_slug", slug).single();
    if (result.error || !result.data || !result.data.password_hash) {
      return new Response(JSON.stringify({ valid: false, error: "Link not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const valid = await verifyPassword(password, result.data.password_hash);
    return new Response(JSON.stringify({ valid: valid }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
