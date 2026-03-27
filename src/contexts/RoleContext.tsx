import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type AccessLevel = "viewer" | "pitcher" | "editor" | "admin";

export type ProfessionalTitle =
  | "Producer"
  | "Songwriter"
  | "Musician"
  | "Mix Engineer"
  | "Mastering Engineer"
  | "Manager"
  | "Publisher"
  | "A&R"
  | "Assistant"
  | "Artist"
  | string;

// Keep old AppRole type for backward compatibility (UserMenu, etc.)
export type AppRole =
  | "Admin"
  | "Manager"
  | "A&R"
  | "Assistant"
  | "Producer"
  | "Songwriter"
  | "Musician"
  | "Mix Engineer"
  | "Mastering Engineer"
  | "Publisher"
  | "Viewer";

export interface Permissions {
  canViewTracks: boolean;
  canPlayTracks: boolean;
  canUploadTracks: boolean;
  canEditTracks: boolean;
  canDeleteTracks: boolean;
  canCreatePlaylists: boolean;
  canEditPlaylists: boolean;
  canSendPitches: boolean;
  canCreateSharedLinks: boolean;
  canManageSplits: boolean;
  canInviteMembers: boolean;
  canManageTeam: boolean;
  canEditBranding: boolean;
  canAccessSettings: boolean;
  // Legacy aliases
  canEditAllTracks: boolean;
  canEditOwnTracks: boolean;
  isReadOnly: boolean;
}

const accessPermissions: Record<AccessLevel, Permissions> = {
  viewer: {
    canViewTracks: true,
    canPlayTracks: true,
    canUploadTracks: false,
    canEditTracks: false,
    canDeleteTracks: false,
    canCreatePlaylists: false,
    canEditPlaylists: false,
    canSendPitches: false,
    canCreateSharedLinks: false,
    canManageSplits: false,
    canInviteMembers: false,
    canManageTeam: false,
    canEditBranding: false,
    canAccessSettings: false,
    canEditAllTracks: false,
    canEditOwnTracks: false,
    isReadOnly: true,
  },
  pitcher: {
    canViewTracks: true,
    canPlayTracks: true,
    canUploadTracks: true,
    canEditTracks: false,
    canDeleteTracks: false,
    canCreatePlaylists: true,
    canEditPlaylists: true,
    canSendPitches: true,
    canCreateSharedLinks: true,
    canManageSplits: false,
    canInviteMembers: false,
    canManageTeam: false,
    canEditBranding: false,
    canAccessSettings: false,
    canEditAllTracks: false,
    canEditOwnTracks: true,
    isReadOnly: false,
  },
  editor: {
    canViewTracks: true,
    canPlayTracks: true,
    canUploadTracks: true,
    canEditTracks: true,
    canDeleteTracks: false,
    canCreatePlaylists: true,
    canEditPlaylists: true,
    canSendPitches: true,
    canCreateSharedLinks: true,
    canManageSplits: false,
    canInviteMembers: false,
    canManageTeam: false,
    canEditBranding: false,
    canAccessSettings: false,
    canEditAllTracks: true,
    canEditOwnTracks: true,
    isReadOnly: false,
  },
  admin: {
    canViewTracks: true,
    canPlayTracks: true,
    canUploadTracks: true,
    canEditTracks: true,
    canDeleteTracks: true,
    canCreatePlaylists: true,
    canEditPlaylists: true,
    canSendPitches: true,
    canCreateSharedLinks: true,
    canManageSplits: true,
    canInviteMembers: true,
    canManageTeam: true,
    canEditBranding: true,
    canAccessSettings: true,
    canEditAllTracks: true,
    canEditOwnTracks: true,
    isReadOnly: false,
  },
};

function getPermissions(level: AccessLevel): Permissions {
  return accessPermissions[level] || accessPermissions.viewer;
}

interface RoleContextValue {
  accessLevel: AccessLevel;
  professionalTitle: string | null;
  permissions: Permissions;
  // Legacy — kept for UserMenu role switcher (testing)
  role: AppRole;
  setRole: (role: AppRole) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("admin");
  const [professionalTitle, setProfessionalTitle] = useState<string | null>(null);

  // Fetch access_level from workspace_members
  useEffect(() => {
    if (!user || !activeWorkspace) return;

    // Workspace owner is always admin
    if (activeWorkspace.owner_id === user.id) {
      setAccessLevel("admin");
      setProfessionalTitle(null);
      return;
    }

    supabase
      .from("workspace_members")
      .select("access_level, professional_title")
      .eq("user_id", user.id)
      .eq("workspace_id", activeWorkspace.id)
      .maybeSingle()
      .then(function (res) {
        if (res.data) {
          var level = res.data.access_level as AccessLevel;
          if (level && accessPermissions[level]) {
            setAccessLevel(level);
          } else {
            setAccessLevel("viewer");
          }
          setProfessionalTitle(res.data.professional_title || null);
        } else {
          setAccessLevel("viewer");
          setProfessionalTitle(null);
        }
      });
  }, [user, activeWorkspace]);

  const permissions = getPermissions(accessLevel);

  // Legacy role mapping for backward compat
  var legacyRoleMap: Record<AccessLevel, AppRole> = {
    admin: "Admin",
    editor: "Manager",
    pitcher: "Publisher",
    viewer: "Viewer",
  };
  var role = legacyRoleMap[accessLevel] || "Viewer";
  var setRole = useCallback(function (r: AppRole) {
    // Allow manual override for testing
    var levelMap: Record<string, AccessLevel> = {
      Admin: "admin",
      Manager: "editor",
      "A&R": "editor",
      Assistant: "pitcher",
      Publisher: "pitcher",
      Producer: "pitcher",
      Songwriter: "pitcher",
      Musician: "pitcher",
      "Mix Engineer": "pitcher",
      "Mastering Engineer": "pitcher",
      Viewer: "viewer",
    };
    setAccessLevel(levelMap[r] || "viewer");
  }, []);

  return (
    <RoleContext.Provider value={{ accessLevel, professionalTitle, permissions, role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
