import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
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
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const fetchWorkspaces = useCallback(async (opts?: { switchTo?: string }) => {
    if (!user) return;
    // Don't show loading spinner if we already have data (re-fetch in background)
    if (workspaces.length === 0) setLoading(true);
    try {
      // Get workspace IDs the user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id);

      if (memberError) {
        console.error("Error fetching memberships:", memberError);
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setWorkspaces([]);
        setActiveId(null);
        setLoading(false);
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
        setLoading(false);
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
      hasFetchedRef.current = true;
    }
  }, [user]);

  // Fetch workspaces the user belongs to
  useEffect(() => {
    if (!user) {
      // Don't reset if we already have workspaces (tab switch revalidation)
      // Also stay in loading state if auth is still loading (initial page load)
      if (!authLoading && hasFetchedRef.current) setLoading(false);
      return;
    }

    fetchWorkspaces();
  }, [user]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || null;

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

  // a) Still loading auth or workspaces → spinner
  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // b) Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // c) No workspaces → redirect to onboarding
  if (workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  // d) Workspaces exist but activeId not resolved yet → spinner
  if (!activeWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{ activeWorkspace, workspaces, loading, switchWorkspace, updateWorkspaceSettings, createWorkspace, refreshWorkspaces }}
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

