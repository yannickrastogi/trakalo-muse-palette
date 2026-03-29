import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Workspace, WorkspaceSettings } from "@/types/workspace";

interface WorkspaceContextValue {
  /** Currently active workspace */
  activeWorkspace: Workspace;
  /** All workspaces the user belongs to */
  workspaces: Workspace[];
  /** Whether workspaces are still loading */
  loading: boolean;
  /** Switch to a different workspace by id */
  switchWorkspace: (workspaceId: string) => void;
  /** Update settings on the active workspace */
  updateWorkspaceSettings: (updates: Partial<WorkspaceSettings>) => void;
  /** Create a new workspace and switch to it */
  createWorkspace: (name: string, description?: string) => Promise<string | null>;
  /** Re-fetch all workspaces from DB */
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, session, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const autoCreateAttemptedRef = useRef(false);
  const autoCreatedWorkspaceRef = useRef<Workspace | null>(null);
  const isFetchingRef = useRef(false);

  const fetchWorkspaces = useCallback(async (opts?: { switchTo?: string }) => {
    if (!user) return;
    // Skip re-fetch if workspace was just auto-created (RLS blocks reads)
    if (autoCreatedWorkspaceRef.current) {
      console.log("[WS] Skipping fetch — workspace was auto-created");
      setLoading(false);
      return;
    }
    if (isFetchingRef.current) {
      console.log("[WS] Already fetching, skipping");
      return;
    }
    isFetchingRef.current = true;
    setLoading(true);
    try {
      // Get workspace IDs the user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id);

      if (memberError) {
        console.error("Error fetching memberships:", memberError);
        return;
      }

      if (!memberships || memberships.length === 0) {
        console.log("[WS] fetchWorkspaces: memberships empty, setting hasFetched=true");
        // Auto-create workspace for new users
        if (!autoCreateAttemptedRef.current) {
          autoCreateAttemptedRef.current = true;
          const wsName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "My") + "'s Workspace";
          console.log("[WS] Auto-creating workspace for:", user.email);
          try {
            const { data, error } = await supabase.rpc("create_workspace_with_member", {
              _name: wsName,
              _description: null,
              _user_id: user.id,
            });
            if (error) {
              console.error("[WS] Auto-create RPC failed:", error);
            } else {
              console.log("[WS] Auto-created workspace:", data);
              // Build workspace object directly — don't re-fetch (RLS/auth.uid() issue)
              const newWorkspace: Workspace = {
                id: data as string,
                name: wsName,
                slug: "",
                owner_id: user.id,
                plan: "free",
                created_at: new Date().toISOString(),
                settings: {
                  defaultLanguage: "en",
                  allowPublicLinks: true,
                  requireApproval: false,
                  maxMembers: 5,
                  storageQuotaMB: 2048,
                },
                hero_image_url: null,
                hero_position: null,
                logo_url: null,
                brand_color: null,
              };
              autoCreatedWorkspaceRef.current = newWorkspace;
              setWorkspaces([newWorkspace]);
              setActiveId(newWorkspace.id);
              localStorage.setItem("trakalog_active_workspace", newWorkspace.id);
              return;
            }
          } catch (err) {
            console.error("[WS] Auto-create error:", err);
          }
        }
        setWorkspaces([]);
        setActiveId(null);
        return;
      }

      const workspaceIds = memberships.map((m) => m.workspace_id);

      // Fetch workspace details
      const { data: wsData, error: wsError } = await supabase
        .from("workspaces")
        .select("*")
        .in("id", workspaceIds);

      if (wsError) {
        console.error("Error fetching workspaces:", wsError);
        return;
      }

      const mapped: Workspace[] = (wsData || []).map((ws) => ({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        owner_id: ws.owner_id,
        plan: (ws.plan as Workspace["plan"]) || "free",
        created_at: ws.created_at,
        settings: (ws.settings as WorkspaceSettings) || {
          defaultLanguage: "en",
          allowPublicLinks: true,
          requireApproval: false,
          maxMembers: 5,
          storageQuotaMB: 2048,
        },
        hero_image_url: (ws as any).hero_image_url || null,
        hero_position: (ws as any).hero_position ?? null,
        logo_url: (ws as any).logo_url || null,
        brand_color: (ws as any).brand_color || null,
      }));

      setWorkspaces(mapped);

      // If switchTo is specified (e.g. after creating a new workspace), use it
      if (opts?.switchTo && mapped.some((w) => w.id === opts.switchTo)) {
        setActiveId(opts.switchTo);
        localStorage.setItem("trakalog_active_workspace", opts.switchTo);
      } else if (!activeId || !mapped.some((w) => w.id === activeId)) {
        // Set active workspace: use stored preference or first workspace
        const stored = localStorage.getItem("trakalog_active_workspace");
        if (stored && mapped.some((w) => w.id === stored)) {
          setActiveId(stored);
        } else if (mapped.length > 0) {
          setActiveId(mapped[0].id);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching workspaces:", err);
    } finally {
      setLoading(false);
      setHasFetched(true);
      isFetchingRef.current = false;
      console.log("[WS] fetchWorkspaces done, hasFetched=true, workspaces count:", workspaces.length);
    }
  }, [user]);

  // Fetch workspaces when user becomes available
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  const effectiveWorkspaces = workspaces.length > 0 ? workspaces : (autoCreatedWorkspaceRef.current ? [autoCreatedWorkspaceRef.current] : []);
  const effectiveActiveId = activeId || (autoCreatedWorkspaceRef.current?.id ?? null);
  const activeWorkspace = effectiveWorkspaces.find((w) => w.id === effectiveActiveId) || effectiveWorkspaces[0] || null;

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveId(workspaceId);
    localStorage.setItem("trakalog_active_workspace", workspaceId);
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.rpc("create_workspace_with_member", {
        _name: name,
        _description: description || null,
      });
      if (error) {
        console.error("Error creating workspace:", error);
        return null;
      }
      const newId = data as string;
      await fetchWorkspaces({ switchTo: newId });
      return newId;
    } catch (err) {
      console.error("Unexpected error creating workspace:", err);
      return null;
    }
  }, [fetchWorkspaces]);

  const refreshWorkspaces = useCallback(async () => {
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  const updateWorkspaceSettings = useCallback(
    async (updates: Partial<WorkspaceSettings>) => {
      if (!activeWorkspace) return;

      const newSettings = { ...activeWorkspace.settings, ...updates };

      // Update locally first for instant UI
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspace.id ? { ...w, settings: newSettings } : w
        )
      );

      // Persist to Supabase
      const { error } = await supabase
        .from("workspaces")
        .update({ settings: newSettings as unknown as Record<string, unknown> })
        .eq("id", activeWorkspace.id);

      if (error) {
        console.error("Error updating workspace settings:", error);
      }
    },
    [activeWorkspace]
  );

  // a) Auth still loading → spinner
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // b) Fetch in progress (session exists, waiting for result) → spinner
  if (!hasFetched && session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // c) Fetch completed with 0 workspaces → auto-create in progress, show spinner
  if (hasFetched && workspaces.length === 0 && !autoCreatedWorkspaceRef.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // d) No session (and not already redirected by c) → ProtectedRoute handles real redirect
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // e) Workspaces exist but activeId not resolved yet → spinner
  if (!activeWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // f) All good → render children

  return (
    <WorkspaceContext.Provider
      value={{ activeWorkspace, workspaces: effectiveWorkspaces, loading, switchWorkspace, updateWorkspaceSettings, createWorkspace, refreshWorkspaces }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

