import { supabase } from "@/integrations/supabase/client";

// Only definitive answers (true/false) are cached. A network/RPC failure yields
// `null` (indeterminate) and is never cached, so a later attempt can still resolve.
const cache = new Map<string, boolean>();

/**
 * Resolve whether an email is on the private-beta whitelist.
 *
 * @returns `true`  — whitelisted
 *          `false` — explicit refusal from the server
 *          `null`  — indeterminate (network/timeout/5xx). Callers MUST NOT treat
 *                    `null` as a refusal: it means "unknown", not "no".
 */
export async function isEmailWhitelisted(email: string): Promise<boolean | null> {
  const key = email.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  // One retry (~500ms apart) before giving up: a single transient failure should
  // not resolve to `null` if the RPC succeeds on a second try.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.rpc("is_email_whitelisted", { _email: key });
    if (!error) {
      const result = !!data;
      cache.set(key, result);
      return result;
    }
    console.error("Whitelist RPC error:", error);
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}
