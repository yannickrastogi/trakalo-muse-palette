const ALLOWED_ORIGINS = [
  "https://app.trakalog.com",
  "https://admin.trakalog.com",
  "https://trakalog.com",
  "https://www.trakalog.com",
  "http://localhost:8080",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}

// CSRF defense-in-depth: reject browser requests from unauthorized origins.
// - Origin header present → must be in allowlist (browsers always set Origin on cross-origin POSTs)
// - Origin header absent → server-to-server, mobile, scripted → allowed (other layers protect: rate-limit, RPC checks)
export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

export function rejectInvalidOrigin(req: Request): Response | null {
  if (isOriginAllowed(req)) return null;
  return new Response(JSON.stringify({ error: "Forbidden: invalid origin" }), {
    status: 403,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
