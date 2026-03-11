import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch workspaces the user belongs to
  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      setLoading(false);
      return;
    }

    const fetchWorkspaces = async () => {
      setLoading(true);
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
        }));

        setWorkspaces(mapped);

        // Set active workspace: use stored preference or first workspace
        const stored = localStorage.getItem("trakalog_active_workspace");
        if (stored && mapped.some((w) => w.id === stored)) {
          setActiveId(stored);
        } else if (mapped.length > 0) {
          setActiveId(mapped[0].id);
        }
      } catch (err) {
        console.error("Unexpected error fetching workspaces:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || null;

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveId(workspaceId);
    localStorage.setItem("trakalog_active_workspace", workspaceId);
  }, []);

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

  // Don't render children until we have an active workspace
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No workspace found.</p>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{ activeWorkspace, workspaces, loading, switchWorkspace, updateWorkspaceSettings }}
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

