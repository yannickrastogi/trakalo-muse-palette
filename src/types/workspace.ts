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
  hero_image_url: string | null;
  hero_position: number | null;
  hero_focal_point: string | null;
  logo_url: string | null;
  brand_color: string | null;
  social_instagram: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  social_facebook: string | null;
  social_x: string | null;
  is_personal: boolean;
}

// ── Tenant-scoped entity base ──
// All major entities extend this to guarantee workspace isolation.
export interface WorkspaceScoped {
  workspace_id: string;
}
