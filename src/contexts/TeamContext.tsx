import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { WorkspaceScoped } from "@/types/workspace";

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
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

// Demo data
const demoTeams: Team[] = [
  {
    id: "team-1",
    workspace_id: "ws-nightfall",
    name: "Nightfall Records",
    createdAt: "2025-09-12",
    sharedTrackIds: [1, 2, 3, 4, 5, 6, 7, 8],
    activities: [
      { id: "a-1", type: "upload", message: "added \"Midnight Run\" to the catalog", user: "Dex Moraes", date: "2026-03-09T14:30:00" },
      { id: "a-18", type: "recipient_opened", message: "Atlantic Records opened playlist \"Summer Selects\"", user: "Notification", date: "2026-03-09T12:05:00" },
      { id: "a-19", type: "recipient_played", message: "Atlantic Records played \"Velvet Skies\" from playlist \"Summer Selects\"", user: "Notification", date: "2026-03-09T12:08:00" },
      { id: "a-20", type: "recipient_downloaded", message: "Atlantic Records downloaded \"Velvet Skies\"", user: "Notification", date: "2026-03-09T12:12:00" },
      { id: "a-2", type: "pitch", message: "pitched \"Velvet Skies\" to Atlantic Records", user: "You", date: "2026-03-08T11:15:00" },
      { id: "a-21", type: "recipient_pack", message: "Interscope Records downloaded Trakalog Pack for \"Echoes\"", user: "Notification", date: "2026-03-08T09:30:00" },
      { id: "a-22", type: "recipient_stems", message: "Interscope Records downloaded stems for \"Echoes\"", user: "Notification", date: "2026-03-08T09:45:00" },
      { id: "a-3", type: "link", message: "created and shared a link for \"Neon Dreams\"", user: "Marco Silva", date: "2026-03-07T16:45:00" },
      { id: "a-23", type: "recipient_opened", message: "Sony Music opened shared link for \"Neon Dreams\"", user: "Notification", date: "2026-03-07T18:20:00" },
      { id: "a-24", type: "recipient_played", message: "Sony Music played \"Neon Dreams\"", user: "Notification", date: "2026-03-07T18:22:00" },
      { id: "a-4", type: "status", message: "modified status on \"Golden Hour\" to Released", user: "You", date: "2026-03-06T09:20:00" },
      { id: "a-5", type: "member", message: "invited AYA as Publisher", user: "You", date: "2026-03-05T10:00:00" },
      { id: "a-6", type: "stems", message: "added stems on \"Midnight Run\"", user: "Tony Maserati", date: "2026-03-04T13:10:00" },
      { id: "a-7", type: "pitch", message: "pitched \"Echoes\" to Interscope Records", user: "You", date: "2026-03-03T15:30:00" },
      { id: "a-8", type: "link", message: "created and shared a link for \"Velvet Skies\"", user: "Dex Moraes", date: "2026-03-02T11:00:00" },
      { id: "a-9", type: "metadata", message: "modified metadata on \"Velvet Skies\"", user: "Marco Silva", date: "2026-03-01T09:45:00" },
      { id: "a-13", type: "splits", message: "added splits on \"Midnight Run\"", user: "You", date: "2026-02-28T15:00:00" },
      { id: "a-14", type: "lyrics", message: "added lyrics on \"Golden Hour\"", user: "Dex Moraes", date: "2026-02-27T11:30:00" },
      { id: "a-15", type: "paperwork", message: "uploaded paperwork for \"Echoes\"", user: "Emily Lazar", date: "2026-02-26T14:20:00" },
      { id: "a-16", type: "metadata", message: "added metadata on \"Neon Dreams\"", user: "You", date: "2026-02-25T10:10:00" },
      { id: "a-17", type: "splits", message: "modified splits on \"Velvet Skies\"", user: "Marco Silva", date: "2026-02-24T16:00:00" },
    ],
    members: [
      { id: "m-0", firstName: "You", lastName: "(Owner)", email: "you@trakalog.com", role: "Admin", joinedAt: "2025-09-12", status: "active" },
      { id: "m-1", firstName: "Dex", lastName: "Moraes", email: "dex@dexmoraes.com", role: "Producer", joinedAt: "2024-11-03", status: "active" },
      { id: "m-2", firstName: "Marco", lastName: "Silva", email: "marco@studiosilva.io", role: "Songwriter", joinedAt: "2025-02-22", status: "active" },
      { id: "m-3", firstName: "Tony", lastName: "Maserati", email: "tony@maseratimix.com", role: "Mix Engineer", joinedAt: "2025-03-15", status: "active" },
      { id: "m-4", firstName: "Emily", lastName: "Lazar", email: "emily@thelodge.nyc", role: "Mastering Engineer", joinedAt: "2025-04-02", status: "active" },
      { id: "m-5", firstName: "AYA", lastName: "", email: "aya@songbird.pub", role: "Publisher", joinedAt: "2025-08-05", status: "pending" },
    ],
  },
  {
    id: "team-2",
    workspace_id: "ws-nightfall",
    name: "Studio Sessions",
    createdAt: "2026-01-10",
    sharedTrackIds: [3, 5, 11],
    activities: [
      { id: "a-10", type: "upload", message: "uploaded \"Sakura Drift\" to the catalog", user: "Nao Kimura", date: "2026-03-08T10:00:00" },
      { id: "a-11", type: "status", message: "changed \"Tokyo Nights\" status to On Hold", user: "Jun Tanaka", date: "2026-03-06T14:20:00" },
      { id: "a-12", type: "link", message: "created a share link for \"Sakura Drift\"", user: "You", date: "2026-03-05T09:30:00" },
    ],
    members: [
      { id: "m-10", firstName: "You", lastName: "(Owner)", email: "you@trakalog.com", role: "Admin", joinedAt: "2026-01-10", status: "active" },
      { id: "m-11", firstName: "Nao", lastName: "Kimura", email: "nao@naokimura.com", role: "Musician", joinedAt: "2026-01-15", status: "active" },
      { id: "m-12", firstName: "Jun", lastName: "Tanaka", email: "jun@tanaka.jp", role: "A&R", joinedAt: "2026-02-01", status: "active" },
    ],
  },
];

let nextId = 100;

export function TeamProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [allTeams, setAllTeams] = useState<Team[]>(demoTeams);

  const teams = useMemo(
    () => allTeams.filter((t) => t.workspace_id === activeWorkspace.id),
    [allTeams, activeWorkspace.id]
  );

  const createTeam = (name: string): Team => {
    const newTeam: Team = {
      id: `team-${++nextId}`,
      name,
      createdAt: new Date().toISOString().split("T")[0],
      sharedTrackIds: [],
      activities: [],
      members: [
        {
          id: `m-${++nextId}`,
          firstName: "You",
          lastName: "(Owner)",
          email: "you@trakalog.com",
          role: "Admin",
          joinedAt: new Date().toISOString().split("T")[0],
          status: "active",
        },
      ],
    };
    setTeams((prev) => [newTeam, ...prev]);
    return newTeam;
  };

  const deleteTeam = (teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const renameTeam = (teamId: string, name: string) => {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)));
  };

  const addMember = (teamId: string, member: Omit<TeamMember, "id" | "joinedAt" | "status">) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              members: [
                ...t.members,
                {
                  ...member,
                  id: `m-${++nextId}`,
                  joinedAt: new Date().toISOString().split("T")[0],
                  status: "pending" as const,
                },
              ],
            }
          : t
      )
    );
  };

  const removeMember = (teamId: string, memberId: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== memberId) } : t
      )
    );
  };

  const updateMemberRole = (teamId: string, memberId: string, role: TeamRole) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, role } : m)) }
          : t
      )
    );
  };

  return (
    <TeamContext.Provider value={{ teams, createTeam, deleteTeam, renameTeam, addMember, removeMember, updateMemberRole }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeams must be used within TeamProvider");
  return ctx;
}
