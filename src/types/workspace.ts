// ── Multi-tenant workspace model ──
// Every major entity includes a workspace_id for tenant isolation.
// Designed for future Supabase migration (workspace_id → FK to workspaces table).

export type WorkspacePlan = "free" | "pro" | "enterprise";

export interface WorkspaceSettings {
  defaultLanguage: string;
  allowPublicLinks: boolean;
  requireApproval: boolean;
  maxMembers: number;
  storageQuotaMB: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: WorkspacePlan;
  created_at: string;
  settings: WorkspaceSettings;
}

// ── Tenant-scoped entity base ──
// All major entities extend this to guarantee workspace isolation.
export interface WorkspaceScoped {
  workspace_id: string;
}
