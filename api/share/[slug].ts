import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik";

// Clean branded fallback (the Trakalog logo) — NOT the app-preview.png UI
// screenshot, which made shared-link previews look like the catalog manager.
const DEFAULT_OG_IMAGE = "https://app.trakalog.com/trakalog-logo.png";
const APP_URL = "https://app.trakalog.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.redirect(302, APP_URL);
  }

  const spaUrl = APP_URL + "/share/" + slug;

  // Fetch shared link data
  let title = "Trakalog";
  let description = "Listen on Trakalog";
  let image = DEFAULT_OG_IMAGE;

  try {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      Accept: "application/vnd.pgrst.object+json",
    };

    const linkRes = await fetch(
      SUPABASE_URL + "/rest/v1/shared_links?select=link_name,share_type,track_id,playlist_id&link_slug=eq." + encodeURIComponent(slug),
      { headers }
    );

    if (linkRes.ok) {
      const link = await linkRes.json();

      if (link.track_id) {
        const trackRes = await fetch(
          SUPABASE_URL + "/rest/v1/tracks?select=title,artist,cover_url&id=eq." + link.track_id,
          { headers: { ...headers, Accept: "application/vnd.pgrst.object+json" } }
        );
        if (trackRes.ok) {
          const track = await trackRes.json();
          title = (track.title || "Track") + " — " + (track.artist || "Unknown Artist");
          description = "Listen to " + (track.title || "this track") + " on Trakalog";
          if (track.cover_url) image = track.cover_url;
        }
      } else if (link.playlist_id) {
        const plRes = await fetch(
          SUPABASE_URL + "/rest/v1/playlists?select=name,cover_url&id=eq." + link.playlist_id,
          { headers: { ...headers, Accept: "application/vnd.pgrst.object+json" } }
        );

        // Workspace branding (name + logo) via the SAME anon SECURITY DEFINER RPC
        // the public page uses. `workspaces` has no anon SELECT policy, so this
        // slug-scoped RPC is the only anon-safe way to reach the logo/name.
        let wsName = "";
        let wsLogo = "";
        try {
          const brandRes = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_workspace_branding_for_shared_link", {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ _slug: slug }),
          });
          if (brandRes.ok) {
            const rows = await brandRes.json();
            const b = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            if (b) { wsName = b.name || ""; wsLogo = b.logo_url || ""; }
          }
        } catch { /* branding is best-effort; fall back to defaults */ }

        if (plRes.ok) {
          const pl = await plRes.json();
          // og:title = the playlist name; og:description carries the workspace so
          // the preview reads as a branded playlist, not the app UI.
          title = pl.name || "Playlist";
          description = wsName ? (wsName + " · Playlist on Trakalog") : "Playlist on Trakalog";
          // og:image priority: the playlist's own artwork, then the workspace
          // logo (branded), then the clean default — never the UI screenshot.
          image = pl.cover_url || wsLogo || DEFAULT_OG_IMAGE;
        } else if (wsLogo || wsName) {
          title = wsName ? (wsName + " · Playlist") : "Playlist";
          description = wsName ? (wsName + " · Playlist on Trakalog") : "Playlist on Trakalog";
          image = wsLogo || DEFAULT_OG_IMAGE;
        }
      } else {
        title = (link.link_name || "Shared Content") + " — Trakalog";
      }
    }
  } catch {
    // Fallback to defaults on any error
  }

  // Escape HTML entities for safety
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:url" content="${esc(spaUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(spaUrl)}" />
</head>
<body>
<p>Redirecting to <a href="${esc(spaUrl)}">${esc(title)}</a>...</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).send(html);
}
