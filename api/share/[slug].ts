import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhobWVpdGl2a2NsYmV6aXFhdnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjQ0OTcsImV4cCI6MjA4ODg0MDQ5N30.QPq57P0_fWu3hcNC2THDhdtRX7g2oTgrnw4Hb_iAqik";

// Clean branded fallback (the Trakalog logo) — NOT the app-preview.png UI
// screenshot, which made shared-link previews look like the catalog manager.
const DEFAULT_OG_IMAGE = "https://app.trakalog.com/trakalog-logo.png";
const APP_URL = "https://app.trakalog.com";

// Only accept absolute http(s) URLs for og:image so a malformed/hostile stored
// value can never inject a non-image scheme (javascript:, data:, …).
function safeUrl(u: unknown): string {
  return typeof u === "string" && (u.startsWith("https://") || u.startsWith("http://")) ? u : "";
}

// SECURITY DEFINER RPC via the anon key — the same slug-scoped RPCs the public
// SharedLinkPage uses. Direct REST reads on shared_links / tracks / playlists
// return nothing for anon (RLS: no anon SELECT policy), so these RPCs are the
// only anon-safe way to resolve a slug. 3.5s timeout so 2 sequential rounds
// stay well under the 10s function budget.
async function rpc(fn: string, body: Record<string, unknown>): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows : rows ? [rows] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.redirect(302, APP_URL);
  }

  const spaUrl = APP_URL + "/share/" + slug;

  let title = "Trakalog";
  let description = "Shared via Trakalog";
  let image = DEFAULT_OG_IMAGE;

  try {
    // Resolve the link and workspace branding in parallel (both slug-scoped RPCs).
    const [linkRows, brandRows] = await Promise.all([
      rpc("get_shared_link_by_slug", { _slug: slug }),
      rpc("get_workspace_branding_for_shared_link", { _slug: slug }),
    ]);

    const link = linkRows && linkRows.length > 0 ? linkRows[0] : null;
    const b = brandRows && brandRows.length > 0 ? brandRows[0] : null;

    const wsName: string = b?.name || "";
    const wsLogo = safeUrl(b?.logo_url);
    const wsHero = safeUrl(b?.hero_image_url);
    const brandedDesc = wsName ? "Shared via Trakalog · " + wsName : "Shared via Trakalog";
    const brandFallbackImage = wsLogo || wsHero || DEFAULT_OG_IMAGE;

    // Don't surface content previews for disabled / revoked / expired links.
    const linkActive =
      !!link &&
      link.status !== "disabled" &&
      link.status !== "revoked" &&
      link.status !== "expired" &&
      !(link.expires_at && new Date(link.expires_at) < new Date());

    if (linkActive) {
      description = brandedDesc;

      if (link.track_id) {
        const trackRows = await rpc("get_track_for_shared_link", { _slug: slug });
        const track = trackRows && trackRows.length > 0 ? trackRows[0] : null;
        if (track) {
          title = (track.title || "Track") + (track.artist ? " — " + track.artist : "");
          image = safeUrl(track.cover_url) || brandFallbackImage;
        } else {
          title = link.link_name || (wsName ? wsName + " · Track" : "Track");
          image = brandFallbackImage;
        }
      } else if (link.playlist_id) {
        // Playlist name is not anon-readable directly; the link's own name is the
        // reliable anon-safe title. og:image uses the first track's cover (via the
        // slug-scoped RPC) then the workspace branding.
        title = link.link_name || (wsName ? wsName + " · Playlist" : "Playlist");
        const plTracks = await rpc("get_playlist_tracks_for_shared_link", { _slug: slug });
        const firstCover = plTracks && plTracks.length > 0 ? safeUrl(plTracks[0]?.cover_url) : "";
        image = firstCover || brandFallbackImage;
      } else {
        title = (link.link_name || "Shared Content") + " — Trakalog";
        image = brandFallbackImage;
      }
    } else if (b) {
      // Unknown / inactive link but we still have workspace branding.
      description = brandedDesc;
      image = brandFallbackImage;
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
