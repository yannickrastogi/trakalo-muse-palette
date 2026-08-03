import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Normalized shape returned by `get_contact_suggestions`. Snake_case DB columns
 * are mapped to camelCase; `pro`/`tags` stay arrays (text[]). `source` tells the
 * UI whether the row is a current-workspace contact ("workspace") or one of the
 * caller's own contacts surfaced from another workspace ("mine").
 */
export interface ContactSuggestion {
  id: string;
  workspaceId: string;
  createdBy: string;
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
  notes: string;
  tags: string[];
  source: "workspace" | "mine";
  updatedAt: string;
}

interface RawRow {
  id: string;
  workspace_id: string;
  created_by: string;
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
  notes: string | null;
  tags: string[] | null;
  source: string | null;
  updated_at: string | null;
}

/**
 * The RPC was created directly in production (no local migration yet), so it is
 * absent from the generated `Database` types. Cast the `rpc` call through a
 * narrow, explicit signature rather than reaching for `any`.
 */
type SuggestRpc = (
  fn: "get_contact_suggestions",
  args: { _user_id: string; _workspace_id: string; _query: string; _limit: number },
) => PromiseLike<{ data: RawRow[] | null; error: { message: string } | null }>;

function mapRow(r: RawRow): ContactSuggestion {
  const first = r.first_name || "";
  const last = r.last_name || "";
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    createdBy: r.created_by,
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
    notes: r.notes || "",
    tags: Array.isArray(r.tags) ? r.tags.filter(Boolean) : [],
    source: r.source === "mine" ? "mine" : "workspace",
    updatedAt: r.updated_at || "",
  };
}

interface Options {
  /** Max rows to request (default 8). */
  limit?: number;
  /** Disable the fetch entirely (e.g. studio-only fields). */
  enabled?: boolean;
  /** Minimum query length before querying (default 2). */
  minChars?: number;
  /** Debounce window in ms (default 200). */
  debounceMs?: number;
}

/**
 * Single entry point for cross-workspace contact autofill suggestions. Every
 * person-input field calls this hook so the suggestion logic (RPC, identity,
 * workspace scoping, debounce, stale-response guarding) lives in one place.
 *
 * The RPC already verifies the caller's identity and workspace membership and
 * returns: the caller's own contacts across every workspace they still belong
 * to, plus the current workspace's contacts, deduped by email (else name).
 */
export function useContactSuggestions(
  query: string,
  options?: Options,
): { suggestions: ContactSuggestion[]; loading: boolean } {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const limit = options?.limit ?? 8;
  const enabled = options?.enabled ?? true;
  const minChars = options?.minChars ?? 2;
  const debounceMs = options?.debounceMs ?? 200;

  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  // Monotonic request id — only the most recent in-flight response is applied,
  // so out-of-order RPC returns can never clobber a newer query's results.
  const reqIdRef = useRef(0);

  const trimmed = (query || "").trim();
  const userId = user?.id;
  const workspaceId = activeWorkspace?.id;

  useEffect(() => {
    if (!enabled || !userId || !workspaceId || trimmed.length < minChars) {
      reqIdRef.current++; // invalidate any in-flight request
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const handle = setTimeout(() => {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      (supabase.rpc as unknown as SuggestRpc)("get_contact_suggestions", {
        _user_id: userId,
        _workspace_id: workspaceId,
        _query: trimmed,
        _limit: limit,
      }).then(
        ({ data, error }) => {
          if (reqId !== reqIdRef.current) return; // stale response — drop it
          setSuggestions(error ? [] : (data ?? []).map(mapRow));
          setLoading(false);
        },
        () => {
          if (reqId !== reqIdRef.current) return;
          setSuggestions([]);
          setLoading(false);
        },
      );
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [enabled, userId, workspaceId, trimmed, limit, minChars, debounceMs]);

  return { suggestions, loading };
}
