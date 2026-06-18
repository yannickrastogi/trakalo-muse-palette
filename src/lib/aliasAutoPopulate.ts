// Auto-populate Artist Aliases from saved splits.
//
// When a split row carries a distinct `stage_name`, we infer that the user has
// implicitly mapped a real name → stage name pair. We create the matching alias
// silently so the Artist Aliases tab stays in sync without a manual step.
//
// Fire-and-forget: callers MUST NOT await this for UX-critical work, and we
// never raise a toast. A failed RPC is logged to the console only.

import { supabase } from "@/integrations/supabase/client";

export interface SplitLike {
  name?: string | null;
  email?: string | null;
  stage_name?: string | null;
}

interface AliasAutoPopulateArgs {
  splits: SplitLike[];
  workspaceId: string;
  userId: string;
}

/**
 * Side-effect: for each split with a non-empty stage_name, find/create the
 * matching alias linking it to the split's contact. Does its own freshest
 * reads of contacts & aliases so callers don't have to thread React state.
 */
export async function autoPopulateAliasesFromSplits(args: AliasAutoPopulateArgs): Promise<void> {
  const { splits, workspaceId, userId } = args;
  if (!workspaceId || !userId) return;

  // Only splits that contribute a stage_name distinct from the full name.
  const candidates = splits.filter((s) => {
    const stage = (s.stage_name || "").trim();
    if (!stage) return false;
    const name = (s.name || "").trim();
    if (!name) return false;
    return stage.toLowerCase() !== name.toLowerCase();
  });
  if (candidates.length === 0) return;

  try {
    // Pull the latest contacts & aliases — splits save typically upserted
    // contacts a few ms ago, so we want a fresh read here.
    const [contactsRes, aliasesRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email, stage_name")
        .eq("workspace_id", workspaceId),
      supabase
        .from("artist_aliases")
        .select("id, alias_name, contact_ids")
        .eq("workspace_id", workspaceId),
    ]);

    const contacts = (contactsRes.data || []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      stage_name: string | null;
    }>;
    const aliases = (aliasesRes.data || []) as Array<{
      id: string;
      alias_name: string;
      contact_ids: string[] | null;
    }>;

    for (const split of candidates) {
      const stage = (split.stage_name || "").trim();
      const name = (split.name || "").trim();
      const email = (split.email || "").trim().toLowerCase();

      // Prefer email-based matching; fall back to first/last name comparison.
      let contact = email
        ? contacts.find((c) => (c.email || "").toLowerCase() === email)
        : undefined;
      if (!contact) {
        const parts = name.split(/\s+/);
        const first = (parts[0] || "").toLowerCase();
        const last = parts.slice(1).join(" ").toLowerCase();
        contact = contacts.find(
          (c) =>
            (c.first_name || "").toLowerCase() === first &&
            (c.last_name || "").toLowerCase() === last,
        );
      }
      if (!contact) continue;

      const stageLower = stage.toLowerCase();
      const existing = aliases.find(
        (a) =>
          a.alias_name.trim().toLowerCase() === stageLower &&
          Array.isArray(a.contact_ids) &&
          a.contact_ids.includes(contact!.id),
      );
      if (existing) continue;

      try {
        const { error } = await supabase.rpc("upsert_artist_alias", {
          _user_id: userId,
          _workspace_id: workspaceId,
          _alias_id: null,
          _alias_name: stage,
          _contact_ids: [contact.id],
        });
        if (error) {
          console.warn("[aliasAutoPopulate] upsert_artist_alias error for", stage, ":", error.message);
        }
      } catch (err) {
        console.warn("[aliasAutoPopulate] failed for", stage, ":", err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn("[aliasAutoPopulate] failed to read context:", err instanceof Error ? err.message : err);
  }
}
