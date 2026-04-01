import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkspaceScoped } from "@/types/workspace";
import type { AccessLevel } from "@/contexts/RoleContext";

export type TeamRole = "Admin" | "Manager" | "A&R" | "Assistant" | "Producer" | "Songwriter" | "Musician" | "Mix Engineer" | "Mastering Engineer" | "Publisher" | "Viewer";

export type ActivityType = "upload" | "pitch" | "link" | "member" | "status" | "metadata" | "splits" | "stems" | "lyrics" | "paperwork" | "recipient_opened" | "recipient_played" | "recipient_downloaded" | "recipient_pack" | "recipient_stems";

export interface TeamActivity {
  id: string;
  type: ActivityType;
  message: string;
  user: string;
  date: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TeamRole;
  accessLevel: AccessLevel;
  professionalTitle: string | null;
  joinedAt: string;
  status: "active" | "pending" | "expired";
}

export interface Team extends WorkspaceScoped {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
  sharedTrackIds: number[];
  activities: TeamActivity[];
}

interface TeamContextValue {
  teams: Team[];
  createTeam: (name: string) => Team;
  deleteTeam: (teamId: string) => void;
  renameTeam: (teamId: string, name: string) => void;
  addMember: (teamId: string, member: Omit<TeamMember, "id" | "joinedAt" | "status">) => void;
  removeMember: (teamId: string, memberId: string) => void;
  updateMemberRole: (teamId: string, memberId: string, role: TeamRole) => void;
  updateMemberAccess: (teamId: string, memberId: string, accessLevel: AccessLevel, professionalTitle: string | null) => void;
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

const dbRoleToUi: Record<string, TeamRole> = {
  admin: "Admin",
  manager: "Manager",
  a_r: "A&R",
  assistant: "Assistant",
  producer: "Producer",
  songwriter: "Songwriter",
  musician: "Musician",
  mix_engineer: "Mix Engineer",
  mastering_engineer: "Mastering Engineer",
  publisher: "Publisher",
  viewer: "Viewer",
};

const uiRoleToDb: Record<string, string> = Object.fromEntries(
  Object.entries(dbRoleToUi).map(([k, v]) => [v, k])
);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);

  const fetchTeam = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setTeams([]);
      return;
    }

    // Fetch workspace members with access_level and professional_title
    const { data: members, error: mErr } = await supabase
      .from("workspace_members")
      .select("id, user_id, joined_at, access_level, professional_title")
      .eq("workspace_id", activeWorkspace.id);

    if (mErr) {
      console.error("Error fetching workspace members:", mErr);
      setTeams([]);
      return;
    }

    // Also fetch legacy roles for backward compat display
    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("workspace_id", activeWorkspace.id);

    if (rErr) {
      console.error("Error fetching user roles:", rErr);
    }

    const roleMap: Record<string, string> = {};
    for (const r of roles || []) {
      roleMap[r.user_id] = r.role;
    }

    // Build TeamMember list
    const teamMembers: TeamMember[] = (members || []).map((m) => {
      const isCurrentUser = m.user_id === user.id;
      const dbRole = roleMap[m.user_id] || "viewer";
      const meta = user.user_metadata || {};
      const memberAccessLevel = ((m as any).access_level as AccessLevel) || "viewer";
      const memberProfTitle = (m as any).professional_title as string | null;

      return {
        id: m.user_id,
        firstName: isCurrentUser ? (meta.first_name || meta.full_name?.split(" ")[0] || "You") : "Member",
        lastName: isCurrentUser ? (meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || "") : m.user_id.slice(0, 8),
        email: isCurrentUser ? (user.email || "") : "",
        role: dbRoleToUi[dbRole] || "Viewer",
        accessLevel: memberAccessLevel,
        professionalTitle: memberProfTitle || null,
        joinedAt: m.joined_at ? m.joined_at.split("T")[0] : "",
        status: "active" as const,
      };
    });

    // Fetch tracks for this workspace
    const { data: tracks, error: tErr } = await supabase
      .from("tracks")
      .select("id")
      .eq("workspace_id", activeWorkspace.id);

    if (tErr) {
      console.error("Error fetching workspace tracks:", tErr);
    }

    // Model workspace as a single team
    const team: Team = {
      id: activeWorkspace.id,
      workspace_id: activeWorkspace.id,
      name: activeWorkspace.name,
      createdAt: activeWorkspace.created_at ? activeWorkspace.created_at.split("T")[0] : "",
      members: teamMembers,
      sharedTrackIds: (tracks || []).map(t => t.id),
      activities: [],
    };

    setTeams([team]);
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const createTeam = useCallback(
    (name: string): Team => {
      const newTeam: Team = {
        id: "team-" + Date.now(),
        workspace_id: activeWorkspace.id,
        name,
        createdAt: new Date().toISOString().split("T")[0],
        sharedTrackIds: [],
        activities: [],
        members: [
          {
            id: user?.id || "owner",
            firstName: "You",
            lastName: "(Owner)",
            email: user?.email || "",
            role: "Admin",
            accessLevel: "admin",
            professionalTitle: null,
            joinedAt: new Date().toISOString().split("T")[0],
            status: "active",
          },
        ],
      };
      setTeams((prev) => [newTeam, ...prev]);
      return newTeam;
    },
    [activeWorkspace, user]
  );

  const deleteTeam = useCallback((teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }, []);

  const renameTeam = useCallback((teamId: string, name: string) => {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)));
  }, []);

  const addMember = useCallback(
    async (teamId: string, member: Omit<TeamMember, "id" | "joinedAt" | "status">) => {
      if (!activeWorkspace) return;

      const newMember: TeamMember = {
        ...member,
        id: "pending-" + Date.now(),
        joinedAt: new Date().toISOString().split("T")[0],
        status: "pending",
      };

      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, members: [...t.members, newMember] } : t
        )
      );
    },
    [activeWorkspace]
  );

  const removeMember = useCallback(
    async (teamId: string, memberId: string) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== memberId) } : t
        )
      );

      if (activeWorkspace && !memberId.startsWith("pending-")) {
        const { error } = await supabase
          .from("workspace_members")
          .delete()
          .eq("user_id", memberId)
          .eq("workspace_id", activeWorkspace.id);

        if (error) {
          console.error("Error removing member:", error);
          await fetchTeam();
        }
      }
    },
    [activeWorkspace, fetchTeam]
  );

  // Legacy: update role in user_roles table
  const updateMemberRole = useCallback(
    async (teamId: string, memberId: string, role: TeamRole) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, role } : m)) }
            : t
        )
      );

      if (activeWorkspace && !memberId.startsWith("pending-")) {
        const dbRole = uiRoleToDb[role] || "viewer";
        const { data: existing } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", memberId)
          .eq("workspace_id", activeWorkspace.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("user_roles")
            .update({ role: dbRole })
            .eq("id", existing.id);
          if (error) console.error("Error updating role:", error);
        } else {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: memberId, workspace_id: activeWorkspace.id, role: dbRole });
          if (error) console.error("Error inserting role:", error);
        }
      }
    },
    [activeWorkspace]
  );

  // New: update access_level and professional_title in workspace_members
  const updateMemberAccess = useCallback(
    async (teamId: string, memberId: string, newAccessLevel: AccessLevel, newProfessionalTitle: string | null) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? {
                ...t,
                members: t.members.map((m) =>
                  m.id === memberId
                    ? { ...m, accessLevel: newAccessLevel, professionalTitle: newProfessionalTitle }
                    : m
                ),
              }
            : t
        )
      );

      if (activeWorkspace && !memberId.startsWith("pending-")) {
        const { error } = await supabase
          .from("workspace_members")
          .update({
            access_level: newAccessLevel,
            professional_title: newProfessionalTitle,
          })
          .eq("user_id", memberId)
          .eq("workspace_id", activeWorkspace.id);

        if (error) {
          console.error("Error updating member access:", error);
          await fetchTeam();
        }
      }
    },
    [activeWorkspace, fetchTeam]
  );

  return (
    <TeamContext.Provider value={{ teams, createTeam, deleteTeam, renameTeam, addMember, removeMember, updateMemberRole, updateMemberAccess }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeams must be used within TeamProvider");
  return ctx;
}
