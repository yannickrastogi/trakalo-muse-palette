import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Seat usage snapshot for a workspace, resolved server-side by the
 * `get_workspace_seats(_workspace_id)` RPC (jsonb). Viewers are always free;
 * only non-viewer members/invitations consume a seat.
 */
export interface WorkspaceSeats {
  plan: string;
  seats_included: number; // effective total (plan + purchased)
  seats_from_plan: number; // seats granted by the plan
  seats_purchased: number; // additional paid seat add-ons
  seats_used: number;
  seats_pending: number;
  seats_available: number;
  viewers: number;
  can_invite_active: boolean;
}

/** Substring raised by the DB seat-limit trigger — used to give a clean toast. */
export const SEAT_LIMIT_ERROR = "plan_limit_reached: seats";

/**
 * Reads workspace seat usage. `enabled` lets callers (e.g. a modal) defer the
 * fetch until it is actually open. Returns `refresh` to re-read after a
 * successful invite or role change.
 */
export function useWorkspaceSeats(enabled = true) {
  const { activeWorkspace } = useWorkspace();
  const [seats, setSeats] = useState<WorkspaceSeats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!wsId) {
      setSeats(null);
      return;
    }
    setLoading(true);
    // `get_workspace_seats` isn't in the generated types yet — cast like other
    // newer RPCs in this codebase. The Edge/DB layer stays the source of truth.
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)("get_workspace_seats", {
      _workspace_id: wsId,
    });

    if (!error && data && typeof data === "object" && !("error" in (data as object))) {
      setSeats(data as WorkspaceSeats);
    } else {
      setSeats(null);
    }
    setLoading(false);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (enabled) refresh();
    else setSeats(null);
  }, [enabled, refresh]);

  return { seats, loading, refresh };
}
