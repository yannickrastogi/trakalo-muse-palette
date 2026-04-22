import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
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

    // Fetch profiles for all member user_ids
    const memberUserIds = (members || []).map((m) => m.user_id);
    const profileMap: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};
    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", memberUserIds);
      for (const p of profiles || []) {
        profileMap[p.id] = p;
      }
    }

    // Build TeamMember list
    const teamMembers: TeamMember[] = (members || []).map((m) => {
      const isCurrentUser = m.user_id === user.id;
      const dbRole = roleMap[m.user_id] || "viewer";
      const meta = user.user_metadata || {};
      const profile = profileMap[m.user_id];
      const memberAccessLevel = ((m as any).access_level as AccessLevel) || "viewer";
      const memberProfTitle = (m as any).professional_title as string | null;

      let firstName: string;
      let lastName: string;
      let email: string;
      if (isCurrentUser) {
        firstName = meta.first_name || meta.full_name?.split(" ")[0] || profile?.full_name?.split(" ")[0] || "You";
        lastName = meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || profile?.full_name?.split(" ").slice(1).join(" ") || "";
        email = user.email || profile?.email || "";
      } else if (profile) {
        firstName = profile.full_name?.split(" ")[0] || profile.email?.split("@")[0] || "Member";
        lastName = profile.full_name?.split(" ").slice(1).join(" ") || "";
        email = profile.email || "";
      } else {
        firstName = "Member";
        lastName = "";
        email = "";
      }

      return {
        id: m.user_id,
        firstName,
        lastName,
        email,
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

    // Fetch recent audit_logs
    const { data: auditData } = await supabase
      .from("audit_logs")
      .select("id, user_id, action, resource_type, resource_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch recent link_events for workspace tracks
    const trackIds = (tracks || []).map(t => t.id);
    let linkEventsData: any[] | null = null;
    if (trackIds.length > 0) {
      const { data } = await supabase
        .from("link_events")
        .select("id, event_type, visitor_email, track_id, created_at")
        .in("track_id", trackIds)
        .order("created_at", { ascending: false })
        .limit(50);
      linkEventsData = data;
    }

    // Map audit_logs to TeamActivity
    const auditActionMap: Record<string, { type: ActivityType; message: string }> = {
      "user.login": { type: "member", message: "logged in" },
      "track.saved_from_share": { type: "link", message: "saved a track from shared link" },
      "track.removed_from_share": { type: "link", message: "removed a track from catalog" },
    };

    const auditActivities: TeamActivity[] = (auditData || [])
      .filter(a => auditActionMap[a.action])
      .map(a => {
        const mapped = auditActionMap[a.action];
        const member = teamMembers.find(m => m.id === a.user_id);
        const userName = member ? `${member.firstName} ${member.lastName}`.trim() : "User";
        return {
          id: a.id,
          type: mapped.type,
          message: mapped.message,
          user: userName,
          date: a.created_at || "",
        };
      });

    // Map link_events to TeamActivity
    const linkEventMap: Record<string, { type: ActivityType; message: string }> = {
      play: { type: "recipient_played", message: "played a track" },
      download: { type: "recipient_downloaded", message: "downloaded a track" },
      open: { type: "recipient_opened", message: "opened a shared link" },
    };

    const linkActivities: TeamActivity[] = (linkEventsData || [])
      .filter(e => linkEventMap[e.event_type])
      .map(e => {
        const mapped = linkEventMap[e.event_type];
        return {
          id: e.id,
          type: mapped.type,
          message: mapped.message,
          user: e.visitor_email || "Anonymous",
          date: e.created_at || "",
        };
      });

    // Combine, sort by date desc, limit to 50
    const allActivities = [...auditActivities, ...linkActivities]
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 50);

    // Model workspace as a single team
    const team: Team = {
      id: activeWorkspace.id,
      workspace_id: activeWorkspace.id,
      name: activeWorkspace.name,
      createdAt: activeWorkspace.created_at ? activeWorkspace.created_at.split("T")[0] : "",
      members: teamMembers,
      sharedTrackIds: (tracks || []).map(t => t.id),
      activities: allActivities,
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

      if (activeWorkspace && user && !memberId.startsWith("pending-")) {
        const { error } = await supabase.rpc("remove_workspace_member", {
          _user_id: user.id,
          _member_user_id: memberId,
          _workspace_id: activeWorkspace.id,
        });

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

      if (activeWorkspace && user && !memberId.startsWith("pending-")) {
        const dbRole = uiRoleToDb[role] || "viewer";
        const { error } = await supabase.rpc("update_member_role", {
          _user_id: user.id,
          _member_user_id: memberId,
          _workspace_id: activeWorkspace.id,
          _access_level: dbRole,
          _professional_title: null,
        });
        if (error) console.error("Error updating role:", error);
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

      if (activeWorkspace && user && !memberId.startsWith("pending-")) {
        const { error } = await supabase.rpc("update_member_role", {
          _user_id: user.id,
          _member_user_id: memberId,
          _workspace_id: activeWorkspace.id,
          _access_level: newAccessLevel,
          _professional_title: newProfessionalTitle,
        });

        if (error) {
          console.error("Error updating member access:", error);
          await fetchTeam();
        }
      }
    },
    [activeWorkspace, fetchTeam]
  );

  return (
    <TeamContext.Provider value={useMemo(() => ({ teams, createTeam, deleteTeam, renameTeam, addMember, removeMember, updateMemberRole, updateMemberAccess }), [teams, createTeam, deleteTeam, renameTeam, addMember, removeMember, updateMemberRole, updateMemberAccess])}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeams must be used within TeamProvider");
  return ctx;
}
