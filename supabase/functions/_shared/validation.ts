export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function sanitizeEmailSubject(str: string): string {
  if (!str) return '';
  return str.replace(/[\r\n]/g, '').substring(0, 200);
}

// ── Input bounds for public (anon) Edge Functions ──────────────────────────
// Untrusted callers hold the public anon key, so every anon endpoint must cap
// the size of what it accepts. Field-level caps below; whole-body caps in
// readJsonBounded(). Keep messages generic to the client; log details server-side.

export const LIMITS = {
  SLUG: 128,          // link_slug is a short opaque token
  EMAIL: 254,         // RFC 5321
  NAME: 200,          // display / author / visitor names
  SHORT_TEXT: 200,    // role, company, quality, event flags, …
  STORAGE_PATH: 512,  // storage keys (mirrors isValidStoragePath cap)
  TOKEN: 512,         // opaque signature / access tokens
} as const;

// Thrown by readJsonBounded on an oversized / malformed / too-deep body.
// Callers map this to a 400 (never a 500).
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

// Cap an untrusted value to a trimmed string of at most `max` chars.
// Non-strings collapse to "". Use for every visitor-supplied string field.
export function boundStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Reject over-deep / over-wide JSON. Anon bodies here are flat key→string maps,
// so any real nesting or large array is abusive.
function assertShape(v: unknown, maxDepth: number, maxArray: number, depth = 0): void {
  if (v === null || typeof v !== "object") return;
  if (depth >= maxDepth) throw new InputError("JSON nesting too deep");
  if (Array.isArray(v)) {
    if (v.length > maxArray) throw new InputError("Array too large");
    for (const item of v) assertShape(item, maxDepth, maxArray, depth + 1);
    return;
  }
  for (const key in v as Record<string, unknown>) {
    assertShape((v as Record<string, unknown>)[key], maxDepth, maxArray, depth + 1);
  }
}

// Read + parse a JSON request body with hard whole-body bounds: total byte size,
// nesting depth, and per-array element count. Throws InputError (→ 400) on
// violation or invalid JSON. Individual string fields must still be capped with
// boundStr(). Defaults are generous for the flat bodies these endpoints use.
export async function readJsonBounded(
  req: Request,
  opts: { maxBytes?: number; maxDepth?: number; maxArray?: number } = {},
): Promise<Record<string, unknown>> {
  const maxBytes = opts.maxBytes ?? 16_384;
  const maxDepth = opts.maxDepth ?? 6;
  const maxArray = opts.maxArray ?? 500;
  const raw = await req.text();
  if (raw.length > maxBytes) throw new InputError("Payload too large");
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    throw new InputError("Invalid JSON body");
  }
  assertShape(parsed, maxDepth, maxArray);
  return (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};
}
