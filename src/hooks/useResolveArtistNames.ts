import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * One resolved contact for an artist name. `matchedName` is the input name that
 * produced this row; `matchSource` says whether it came from an alias or a
 * direct contact (stage_name / full name) fallback. `contactWorkspaceId` may
 * differ from the active workspace when the match is one of the caller's own
 * contacts surfaced from another workspace they still belong to.
 */
export interface ResolvedArtistContact {
  matchedName: string;
  matchSource: "alias" | "contact";
  contactId: string;
  contactWorkspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  stageName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  pro: string[];
  ipi: string;
  publisher: string;
  city: string;
  country: string;
}

interface RawRow {
  matched_name: string | null;
  match_source: string | null;
  contact_id: string;
  contact_workspace_id: string;
  first_name: string | null;
  last_name: string | null;
  stage_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  pro: string[] | null;
  ipi: string | null;
  publisher: string | null;
  city: string | null;
  country: string | null;
}

/**
 * `resolve_artist_names` was created directly in production (no local migration
 * yet), so it is absent from the generated `Database` types. Cast the `rpc` call
 * through a narrow, explicit signature rather than reaching for `any`.
 */
type ResolveRpc = (
  fn: "resolve_artist_names",
  args: { _user_id: string; _workspace_id: string; _names: string[] },
) => PromiseLike<{ data: RawRow[] | null; error: { message: string } | null }>;

function mapRow(r: RawRow): ResolvedArtistContact {
  const first = r.first_name || "";
  const last = r.last_name || "";
  return {
    matchedName: r.matched_name || "",
    matchSource: r.match_source === "alias" ? "alias" : "contact",
    contactId: r.contact_id,
    contactWorkspaceId: r.contact_workspace_id,
    firstName: first,
    lastName: last,
    fullName: (first + " " + last).trim(),
    stageName: r.stage_name || "",
    email: r.email || "",
    phone: r.phone || "",
    company: r.company || "",
    role: r.role || "",
    pro: Array.isArray(r.pro) ? r.pro.filter(Boolean) : [],
    ipi: r.ipi || "",
    publisher: r.publisher || "",
    city: r.city || "",
    country: r.country || "",
  };
}

/**
 * Single entry point for resolving artist names to contacts at upload time.
 * Alias-first, then a direct fallback on contacts (stage_name / full name).
 * Scope: the caller's own aliases/contacts across every workspace they still
 * belong to, plus the current workspace — deduped per person, server-side.
 *
 * Returns a stable `resolve(names)` callback. The RPC already verifies the
 * caller's identity and workspace membership, so passing `_user_id` /
 * `_workspace_id` from context here is safe and enforced server-side.
 */
export function useResolveArtistNames(): (names: string[]) => Promise<ResolvedArtistContact[]> {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const userId = user?.id;
  const workspaceId = activeWorkspace?.id;

  return useCallback(
    async (names: string[]): Promise<ResolvedArtistContact[]> => {
      if (!userId || !workspaceId) return [];
      const cleaned = Array.from(
        new Set(names.map((n) => (n || "").trim()).filter(Boolean)),
      );
      if (cleaned.length === 0) return [];

      const { data, error } = await (supabase.rpc as unknown as ResolveRpc)("resolve_artist_names", {
        _user_id: userId,
        _workspace_id: workspaceId,
        _names: cleaned,
      });
      if (error || !data) return [];
      return data.map(mapRow);
    },
    [userId, workspaceId],
  );
}
