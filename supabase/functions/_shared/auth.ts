import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Thrown by the helpers below; the Edge Function handler maps it to a Response.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

// Access-level hierarchy — identical to the SQL has_workspace_access_level().
const ACCESS_LEVELS: Record<string, number> = { viewer: 1, pitcher: 2, editor: 3, admin: 4 };

export interface AuthedUser {
  id: string;
  email?: string;
}

// Authenticate the CALLER from their "Authorization: Bearer <jwt>" header.
// Validates the JWT via GoTrue and returns the user. An anon/publishable key is
// NOT a user token (no `sub`) → getUser returns no user → 401. This is what stops
// unauthenticated callers (a valid anon key alone is never enough).
export async function getAuthedUser(req: Request): Promise<{ user: AuthedUser }> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError(401, "Unauthorized");

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await supabaseAnon.auth.getUser(jwt);
  if (error || !data?.user?.id) throw new HttpError(401, "Unauthorized");
  return { user: { id: data.user.id, email: data.user.email ?? undefined } };
}

// True if the user owns the workspace OR is a member with access_level >= minLevel.
// Uses the service_role `admin` client (passed in, never exposed to the client).
export async function assertWorkspaceMember(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string,
  minLevel: string = "viewer",
): Promise<boolean> {
  const min = ACCESS_LEVELS[minLevel] ?? 1;

  // Workspace owner is always effectively admin.
  const { data: ws } = await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle();
  if (ws && ws.owner_id === userId) return true;

  const { data: member } = await admin
    .from("workspace_members")
    .select("access_level")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  const level = member?.access_level ? (ACCESS_LEVELS[member.access_level as string] ?? 0) : 0;
  if (level >= min) return true;

  throw new HttpError(403, "Forbidden");
}

// Resolve a track's owning workspace id (or null if the track doesn't exist).
export async function resolveTrackWorkspace(admin: SupabaseClient, trackId: string): Promise<string | null> {
  const { data } = await admin.from("tracks").select("workspace_id").eq("id", trackId).maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}
