import { createContext, useContext, useState, type ReactNode } from "react";

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

// Permission tiers
// Admin: full access
// Manager/A&R/Assistant: upload, create playlists, send pitches, manage catalog
// Producer/Songwriter/Musician/Mix Engineer/Mastering Engineer: upload, manage own tracks/catalog
// Publisher: same as Manager tier (can manage catalog)
// Viewer: read-only

export interface Permissions {
  canUploadTracks: boolean;
  canEditAllTracks: boolean;
  canEditOwnTracks: boolean;
  canCreatePlaylists: boolean;
  canEditPlaylists: boolean;
  canSendPitches: boolean;
  canManageTeam: boolean;
  canInviteMembers: boolean;
  canAccessSettings: boolean;
  canDeleteTracks: boolean;
  isReadOnly: boolean;
}

function getPermissions(role: AppRole): Permissions {
  switch (role) {
    case "Admin":
      return {
        canUploadTracks: true,
        canEditAllTracks: true,
        canEditOwnTracks: true,
        canCreatePlaylists: true,
        canEditPlaylists: true,
        canSendPitches: true,
        canManageTeam: true,
        canInviteMembers: true,
        canAccessSettings: true,
        canDeleteTracks: true,
        isReadOnly: false,
      };
    case "Manager":
    case "A&R":
    case "Assistant":
    case "Publisher":
      return {
        canUploadTracks: true,
        canEditAllTracks: true,
        canEditOwnTracks: true,
        canCreatePlaylists: true,
        canEditPlaylists: true,
        canSendPitches: true,
        canManageTeam: false,
        canInviteMembers: false,
        canAccessSettings: false,
        canDeleteTracks: false,
        isReadOnly: false,
      };
    case "Producer":
    case "Songwriter":
    case "Musician":
    case "Mix Engineer":
    case "Mastering Engineer":
      return {
        canUploadTracks: true,
        canEditAllTracks: false,
        canEditOwnTracks: true,
        canCreatePlaylists: false,
        canEditPlaylists: false,
        canSendPitches: false,
        canManageTeam: false,
        canInviteMembers: false,
        canAccessSettings: false,
        canDeleteTracks: false,
        isReadOnly: false,
      };
    case "Viewer":
      return {
        canUploadTracks: false,
        canEditAllTracks: false,
        canEditOwnTracks: false,
        canCreatePlaylists: false,
        canEditPlaylists: false,
        canSendPitches: false,
        canManageTeam: false,
        canInviteMembers: false,
        canAccessSettings: false,
        canDeleteTracks: false,
        isReadOnly: true,
      };
  }
}

interface RoleContextValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
  permissions: Permissions;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>("Admin");
  const permissions = getPermissions(role);

  return (
    <RoleContext.Provider value={{ role, setRole, permissions }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
