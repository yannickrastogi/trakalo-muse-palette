import { safeLocalStorage } from "./safeStorage";

// Per-comment "author secret" returned once by insert_track_comment_via_token.
// It is the ONLY proof that this browser authored a shared-link comment, so the
// visitor can later edit/delete it (the RPCs check sha256(secret) against the
// stored hash). We keep it client-side only, indexed by comment id.
//
// SECURITY: the secret is a bearer credential — never log it, never render it,
// never send it anywhere except the update/delete RPC bodies over HTTPS.

const STORE_KEY = "trakalog_comment_secrets";

function readAll(): Record<string, string> {
  const raw = safeLocalStorage.getItem(STORE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  try {
    safeLocalStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* stringify can't realistically throw here; swallow to stay non-fatal */
  }
}

// Persist the secret for a freshly-created comment. No-ops on missing input.
export function storeCommentSecret(commentId: string, secret: string): void {
  if (!commentId || typeof secret !== "string" || !secret) return;
  const map = readAll();
  map[commentId] = secret;
  writeAll(map);
}

// Returns the stored secret for a comment, or null if this browser didn't
// author it (or the secret was cleared).
export function getCommentSecret(commentId: string): string | null {
  if (!commentId) return null;
  const secret = readAll()[commentId];
  return typeof secret === "string" && secret ? secret : null;
}

// Whether this browser holds the secret for a comment — the sole gate for
// showing edit/delete controls.
export function hasCommentSecret(commentId: string): boolean {
  return getCommentSecret(commentId) !== null;
}

// Forget a comment's secret (after a successful delete, or when the server
// reports the secret is no longer valid).
export function removeCommentSecret(commentId: string): void {
  if (!commentId) return;
  const map = readAll();
  if (commentId in map) {
    delete map[commentId];
    writeAll(map);
  }
}
