import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, boolean>();

export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const key = email.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const { data, error } = await supabase.rpc("is_email_whitelisted", { _email: key });
  if (error) {
    console.error("Whitelist RPC error:", error);
    return false;
  }

  const result = !!data;
  cache.set(key, result);
  return result;
}
