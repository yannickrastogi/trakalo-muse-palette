import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Workspace } from "@/types/workspace";

// ── Mock data ──
const MOCK_USER_ID = "user-owner-001";

const mockWorkspaces: Workspace[] = [
  {
    id: "ws-nightfall",
    name: "Nightfall Records",
    slug: "nightfall-records",
    owner_id: MOCK_USER_ID,
    plan: "pro",
    created_at: "2025-09-12T00:00:00Z",
    settings: {
      defaultLanguage: "en",
      allowPublicLinks: true,
      requireApproval: true,
      maxMembers: 25,
      storageQuotaMB: 10240,
    },
  },
  {
    id: "ws-studio",
    name: "Studio Sessions",
    slug: "studio-sessions",
    owner_id: MOCK_USER_ID,
    plan: "free",
    created_at: "2026-01-10T00:00:00Z",
    settings: {
      defaultLanguage: "en",
      allowPublicLinks: false,
      requireApproval: false,
      maxMembers: 5,
      storageQuotaMB: 2048,
    },
  },
];

interface WorkspaceContextValue {
  /** Currently active workspace */
  activeWorkspace: Workspace;
  /** All workspaces the user belongs to */
  workspaces: Workspace[];
  /** Switch to a different workspace by id */
  switchWorkspace: (workspaceId: string) => void;
  /** Update settings on the active workspace */
  updateWorkspaceSettings: (updates: Partial<Workspace["settings"]>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces);
  const [activeId, setActiveId] = useState<string>(mockWorkspaces[0].id);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || workspaces[0];

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveId(workspaceId);
  }, []);

  const updateWorkspaceSettings = useCallback((updates: Partial<Workspace["settings"]>) => {
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeId ? { ...w, settings: { ...w.settings, ...updates } } : w
      )
    );
  }, [activeId]);

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, workspaces, switchWorkspace, updateWorkspaceSettings }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
