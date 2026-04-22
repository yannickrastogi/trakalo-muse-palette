import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
const Onboarding = lazy(() => import("@/pages/Onboarding"));
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
  const creatingWorkspaceRef = useRef(false);

  const fetchWorkspaces = useCallback(async (opts?: { switchTo?: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      // Use RPC to bypass RLS issues with session
      const { data: wsData, error: wsError } = await supabase.rpc("get_user_workspaces", {
        _user_id: user.id,
      });

      if (wsError || !wsData || wsData.length === 0) {
        // Auto-create workspace for new users
        if (!creatingWorkspaceRef.current && user) {
          creatingWorkspaceRef.current = true;
          try {
            // DB-level guard: re-check workspaces exist before creating
            const { data: existingWs } = await supabase.rpc("get_user_workspaces", { _user_id: user.id });
            if (existingWs && existingWs.length > 0) {
              // Workspaces already exist (created by concurrent call), just use them
              creatingWorkspaceRef.current = false;
              await fetchWorkspaces();
              return;
            }

            const userName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "My");
            const { data: newWsId, error: createError } = await supabase.rpc("create_workspace_with_member", {
              _name: userName + "'s Workspace",
              _description: null,
              _user_id: user.id,
            });
            if (!createError && newWsId) {
              // Mark as personal workspace
              await supabase.rpc("mark_workspace_personal", { _user_id: user.id, _workspace_id: newWsId });

              // Deduplicate: if multiple personal workspaces were created, remove extras
              const { data: personalWsList } = await supabase
                .from("workspaces")
                .select("id, created_at")
                .eq("owner_id", user.id)
                .eq("is_personal", true)
                .order("created_at", { ascending: true }) as any;
              if (personalWsList && personalWsList.length > 1) {
                // Keep the oldest as the sole personal workspace (RPC handles dedup)
                await supabase.rpc("mark_workspace_personal", { _user_id: user.id, _workspace_id: personalWsList[0].id });
              }

              // Re-fetch to get the new workspace
              const { data: newWsData } = await supabase.rpc("get_user_workspaces", { _user_id: user.id });
              if (newWsData && newWsData.length > 0) {
                const mapped: Workspace[] = newWsData.map((ws: any) => ({
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
                  hero_image_url: ws.hero_image_url || null,
                  hero_position: ws.hero_position ?? null,
                  hero_focal_point: ws.hero_focal_point || null,
                  logo_url: ws.logo_url || null,
                  brand_color: ws.brand_color || null,
                  social_instagram: ws.social_instagram || null,
                  social_tiktok: ws.social_tiktok || null,
                  social_youtube: ws.social_youtube || null,
                  social_facebook: ws.social_facebook || null,
                  social_x: ws.social_x || null,
                  is_personal: !!ws.is_personal,
                }));
                setWorkspaces(mapped);
                setActiveId(mapped[0].id);
                localStorage.setItem("trakalog_active_workspace", mapped[0].id);
                return;
              }
            }
          } catch (err) {
          } finally {
            creatingWorkspaceRef.current = false;
          }
        }
        setWorkspaces([]);
        setActiveId(null);
        return;
      }

      const mapped: Workspace[] = wsData.map((ws: any) => ({
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
        hero_image_url: ws.hero_image_url || null,
        hero_position: ws.hero_position ?? null,
        logo_url: ws.logo_url || null,
        brand_color: ws.brand_color || null,
        is_personal: !!ws.is_personal,
      }));

      setWorkspaces(mapped);

      // If switchTo is specified (e.g. after creating a new workspace), use it
      if (opts?.switchTo && mapped.some((w) => w.id === opts.switchTo)) {
        setActiveId(opts.switchTo);
        localStorage.setItem("trakalog_active_workspace", opts.switchTo);
      } else if (!activeId || !mapped.some((w) => w.id === activeId)) {
        // Set active workspace: use stored preference or first workspace
        // Always prefer the user's personal workspace (is_personal = true)
        const personalWorkspace = mapped.find((w) => w.is_personal && w.owner_id === user.id) || null;
        const ownWorkspace = personalWorkspace;
        const stored = localStorage.getItem("trakalog_active_workspace");
        const justLoggedIn = localStorage.getItem("trakalog_just_logged_in");

        if (justLoggedIn) {
          // After login, always start on personal workspace
          localStorage.removeItem("trakalog_just_logged_in");
          if (ownWorkspace) {
            setActiveId(ownWorkspace.id);
            localStorage.setItem("trakalog_active_workspace", ownWorkspace.id);
          } else if (mapped.length > 0) {
            setActiveId(mapped[0].id);
            localStorage.setItem("trakalog_active_workspace", mapped[0].id);
          }
        } else if (stored && mapped.some((w) => w.id === stored)) {
          setActiveId(stored);
        } else if (ownWorkspace) {
          setActiveId(ownWorkspace.id);
          localStorage.setItem("trakalog_active_workspace", ownWorkspace.id);
        } else if (mapped.length > 0) {
          setActiveId(mapped[0].id);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching workspaces:", err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [user]);

  // Fetch workspaces when user becomes available
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
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

      // Persist to Supabase via SECURITY DEFINER RPC
      if (!user) return;
      const { error } = await supabase.rpc("update_workspace_settings", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _settings: newSettings as unknown as Record<string, unknown>,
      });

      if (error) {
        console.error("Error updating workspace settings:", error);
      }
    },
    [activeWorkspace, user]
  );

  // a) Auth still loading → spinner
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // b) Fetch in progress, waiting for result → spinner
  if (!hasFetched && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // c) Fetch completed with 0 workspaces → render onboarding inline
  if (hasFetched && workspaces.length === 0) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
        <Onboarding />
      </Suspense>
    );
  }

  // d) Workspaces exist but activeId not resolved yet → spinner
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
      value={useMemo(() => ({ activeWorkspace, workspaces, loading, switchWorkspace, updateWorkspaceSettings, createWorkspace, refreshWorkspaces }), [activeWorkspace, workspaces, loading, switchWorkspace, updateWorkspaceSettings, createWorkspace, refreshWorkspaces])}
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
