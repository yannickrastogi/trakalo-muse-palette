// Edge function: proxy-stream a workspace EPK PDF behind a branded
// app.trakalog.com/epk/:workspaceSlug URL so the visitor never sees the raw
// Supabase storage URL. Edge runtime streams the body without the ~4.5MB
// serverless response cap.
export const config = { runtime: "edge" };

const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
// Only this host may be proxied (SSRF allowlist) — EPK uploads always live here.
const SUPABASE_HOST = "xhmeitivkclbeziqavxw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik";

// "kassidy-music" -> "Kassidy Music"
function prettify(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  const parts = pathname.split("/").filter(Boolean);
  const slug = decodeURIComponent(parts[parts.length - 1] || "").trim();
  if (!slug || slug === "epk") {
    return new Response("Not found", { status: 404 });
  }

  // Resolve the EPK URL via the anon-executable SECURITY DEFINER RPC.
  let epkUrl = "";
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_workspace_epk_by_slug", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ _workspace_slug: slug }),
    });
    if (r.ok) {
      const data = await r.json();
      // RPC returns epk_url (scalar text) — tolerate array/object shapes too.
      if (typeof data === "string") epkUrl = data;
      else if (Array.isArray(data)) {
        const first = data[0];
        epkUrl = typeof first === "string" ? first : first?.epk_url || "";
      } else if (data && typeof data === "object") {
        epkUrl = data.epk_url || "";
      }
    }
  } catch {
    /* fall through to 404 */
  }

  // SSRF guard: epk_url is set by a workspace owner and could be any string, so
  // only ever proxy an https URL on the expected Supabase storage host. This
  // blocks the proxy from being turned into an open relay to internal/arbitrary
  // hosts. EPK uploads always land in the Supabase `branding` bucket.
  let parsed: URL;
  try {
    parsed = new URL(epkUrl);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== SUPABASE_HOST) {
    return new Response("Not found", { status: 404 });
  }

  // Proxy-stream the PDF so the browser address bar stays on trakalog.com.
  // redirect: "manual" so a 3xx can't bounce the fetch to an off-host target.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let pdfRes: Response;
  try {
    pdfRes = await fetch(epkUrl, { redirect: "manual", signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return new Response("Bad gateway", { status: 502 });
  }
  clearTimeout(timer);
  if (!pdfRes.ok || !pdfRes.body) {
    return new Response("Not found", { status: 404 });
  }

  // Strict allowlist on the filename so nothing (';', control chars, unicode)
  // can break out of the Content-Disposition header value.
  const safeName = (prettify(slug).replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Workspace") + " EPK.pdf";
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'inline; filename="' + safeName + '"');
  headers.set("Cache-Control", "public, max-age=300");
  const len = pdfRes.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(pdfRes.body, { status: 200, headers });
}
