export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "x";

const PLATFORM_DOMAINS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be", "www.youtu.be", "m.youtube.com", "music.youtube.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  youtube: "youtube.com",
  facebook: "facebook.com",
  x: "x.com",
};

const HANDLE_RE = /^[A-Za-z0-9._-]+$/;

function buildCanonical(platform: SocialPlatform, handle: string): string {
  switch (platform) {
    case "instagram": return "https://instagram.com/" + handle;
    case "tiktok": return "https://tiktok.com/@" + handle;
    case "x": return "https://x.com/" + handle;
    case "youtube": return "https://youtube.com/@" + handle;
    case "facebook": return "https://facebook.com/" + handle;
  }
}

/**
 * Render-time normalization. Returns a safe URL or null if the value cannot
 * be coerced into a platform URL. Falls back to handle parsing when the
 * hostname does not match the expected platform domain.
 */
export function normalizeSocialUrl(value: string, platform: SocialPlatform): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { return null; }
    const host = parsed.hostname.toLowerCase();
    if (PLATFORM_DOMAINS[platform].includes(host)) return parsed.toString();
    const seg = parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
    const handle = seg.replace(/^@/, "");
    if (handle && HANDLE_RE.test(handle)) return buildCanonical(platform, handle);
    if (typeof console !== "undefined") console.warn("[social] dropping unrecognized URL for " + platform + ": " + host);
    return null;
  }

  const handle = trimmed.replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return null;
  return buildCanonical(platform, handle);
}

/**
 * Save-time validation. Stricter than normalizeSocialUrl: rejects URLs whose
 * hostname does not match the expected platform domain so the user can fix
 * the input before saving.
 */
export function validateSocialInput(
  value: string,
  platform: SocialPlatform
): { ok: true } | { ok: false; reason: string } {
  const trimmed = (value || "").trim();
  if (!trimmed) return { ok: true };

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { return { ok: false, reason: "Not a valid URL." }; }
    const host = parsed.hostname.toLowerCase();
    if (PLATFORM_DOMAINS[platform].includes(host)) return { ok: true };
    return { ok: false, reason: "This " + platformDisplayName(platform) + " URL doesn't look right \u2014 please enter your handle or a full " + PLATFORM_LABEL[platform] + " URL." };
  }

  const handle = trimmed.replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, reason: "Handle contains unsupported characters. Use letters, numbers, '.', '_' or '-'." };
  }
  return { ok: true };
}

export function platformDisplayName(platform: SocialPlatform): string {
  switch (platform) {
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube": return "YouTube";
    case "facebook": return "Facebook";
    case "x": return "X";
  }
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) return true;
  return HEX_COLOR_RE.test(value);
}
