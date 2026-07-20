// Lightweight, privacy-preserving page-view tracking for public pages.
//
// Fail-silent by contract: every path is wrapped so a failure (storage blocked,
// network down, RPC error) NEVER throws, logs, blocks, or changes rendering.
// No PII is collected — only a random visitor/session id, path, referrer and
// UTM params. Public pages keep the "no native GoTrueClient" rule, so this hits
// the log_site_visit RPC over REST with the publishable key (never supabase.rpc).

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";

const VISITOR_KEY = "tk_vid";
const SESSION_KEY = "tk_sid";

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to manual */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getVisitorId(): string | null {
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
      vid = uuid();
      localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
  } catch {
    return null;
  }
}

function getSessionId(): string | null {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = uuid();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return null;
  }
}

// Don't track /admin paths, nor any logged-in Trakalog user (Supabase persists
// an "sb-<ref>-auth-token" in localStorage) — keeps the team's / platform
// admins' own browsing out of the public-traffic stats.
function shouldSkip(): boolean {
  try {
    const path = window.location.pathname || "";
    if (path === "/admin" || path.indexOf("/admin/") === 0) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) return true;
    }
  } catch {
    /* if we can't read storage, don't skip on that basis */
  }
  return false;
}

export function trackPageView(): void {
  try {
    if (shouldSkip()) return;

    const params = new URLSearchParams(window.location.search);
    const body = {
      _path: window.location.pathname,
      _referrer: document.referrer || null,
      _utm_source: params.get("utm_source"),
      _utm_medium: params.get("utm_medium"),
      _utm_campaign: params.get("utm_campaign"),
      _visitor_id: getVisitorId(),
      _session_id: getSessionId(),
    };

    // Fire-and-forget; never awaited, never surfaces errors.
    fetch(SUPABASE_URL + "/rest/v1/rpc/log_site_visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {
      /* fail-silent */
    });
  } catch {
    /* fail-silent — the page must behave exactly as if this never ran */
  }
}
