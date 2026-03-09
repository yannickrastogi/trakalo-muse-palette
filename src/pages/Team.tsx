import { useState } from "react";
import { motion } from "framer-motion";
import { TeamSharedCatalog } from "@/components/TeamSharedCatalog";
import {
  Plus, Search, Mail, Shield, Eye, Headphones, UserCog, MoreHorizontal,
  Calendar, PenTool, BookOpen, Briefcase, UserCheck, Sliders, Disc3,
  Music, Clock, CheckCircle2, XCircle, Users, ArrowLeft, Trash2, UserPlus,
  Upload, Send, ExternalLink, Activity, BarChart3,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteMemberModal, type InvitePayload } from "@/components/InviteMemberModal";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { useTeams, type Team, type TeamRole, type ActivityType } from "@/contexts/TeamContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES: TeamRole[] = ["Admin", "Producer", "Songwriter", "Musician", "Mix Engineer", "Mastering Engineer", "Manager", "Publisher", "A&R", "Assistant", "Viewer"];

const roleIcons: Record<string, React.ElementType> = {
  Admin: Shield,
  Producer: Headphones,
  Songwriter: PenTool,
  Musician: Music,
  "Mix Engineer": Sliders,
  "Mastering Engineer": Disc3,
  Manager: UserCog,
  Publisher: BookOpen,
  "A&R": Briefcase,
  Assistant: UserCheck,
  Viewer: Eye,
};

const roleColors: Record<string, string> = {
  Admin: "from-brand-orange to-brand-pink",
  Producer: "from-brand-purple to-[hsl(200,70%,50%)]",
  Songwriter: "from-brand-pink to-brand-orange",
  Musician: "from-brand-purple to-brand-pink",
  "Mix Engineer": "from-[hsl(180,60%,45%)] to-brand-purple",
  "Mastering Engineer": "from-brand-orange to-[hsl(180,60%,45%)]",
  Manager: "from-brand-pink to-brand-purple",
  Publisher: "from-[hsl(200,70%,50%)] to-brand-purple",
  "A&R": "from-brand-orange to-brand-purple",
  Assistant: "from-brand-pink to-[hsl(200,70%,50%)]",
  Viewer: "from-muted-foreground/40 to-muted-foreground/20",
};

const activityIcons: Record<ActivityType, React.ElementType> = {
  upload: Upload,
  pitch: Send,
  link: ExternalLink,
  member: UserPlus,
  status: Activity,
};

const activityColors: Record<ActivityType, string> = {
  upload: "bg-brand-orange/12 text-brand-orange",
  pitch: "bg-brand-purple/12 text-brand-purple",
  link: "bg-primary/12 text-primary",
  member: "bg-emerald-500/12 text-emerald-400",
  status: "bg-brand-pink/12 text-brand-pink",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

function getInitials(first: string, last: string) {
  return ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-brand-orange/12 text-brand-orange" },
  active: { icon: CheckCircle2, color: "bg-emerald-500/12 text-emerald-400" },
  expired: { icon: XCircle, color: "bg-destructive/12 text-destructive" },
};

export default function Team() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { permissions } = useRole();
  const { teams, createTeam, addMember, removeMember, updateMemberRole, deleteTeam } = useTeams();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showSharedCatalog, setShowSharedCatalog] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const handleCreateTeam = (name: string) => {
    const team = createTeam(name);
    setSelectedTeamId(team.id);
    toast.success(t("createTeam.created", { name }));
  };

  const handleInvite = (payload: InvitePayload) => {
    if (!selectedTeamId) return;
    addMember(selectedTeamId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      role: payload.role as TeamRole,
    });
    toast.success(t("inviteMember.inviteSent", { email: payload.email }));
  };

  const handleRemoveMember = (memberId: string) => {
    if (!selectedTeamId) return;
    removeMember(selectedTeamId, memberId);
    toast.success(t("team.memberRemoved"));
  };

  const handleRoleChange = (memberId: string, role: TeamRole) => {
    if (!selectedTeamId) return;
    updateMemberRole(selectedTeamId, memberId, role);
    toast.success(t("team.roleUpdated"));
  };

  // ─── TEAMS LIST VIEW ───
  if (!selectedTeam) {
    return (
      <PageShell>
        <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px]">
          {/* Header */}
          <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("team.title")}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                {t("team.teamsSubtitle", { count: teams.length })}
              </p>
            </div>
            {permissions.canInviteMembers && (
              <button
                onClick={() => setCreateTeamOpen(true)}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5" /> {t("team.createTeam")}
              </button>
            )}
          </motion.div>

          {/* Teams grid */}
          {teams.length === 0 ? (
            <motion.div variants={item} className="card-premium p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
                <Users className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-base">{t("team.noTeams")}</h3>
                <p className="text-muted-foreground text-sm mt-1">{t("team.noTeamsDesc")}</p>
              </div>
              <button
                onClick={() => setCreateTeamOpen(true)}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[44px] mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> {t("team.createTeam")}
              </button>
            </motion.div>
          ) : (
            <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const adminCount = team.members.filter((m) => m.role === "Admin").length;
                const pendingCount = team.members.filter((m) => m.status === "pending").length;
                return (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className="card-premium p-5 text-left hover:border-brand-orange/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <span className="text-2xs text-muted-foreground">{formatDate(team.createdAt)}</span>
                    </div>
                    <h3 className="text-foreground font-bold text-[15px] mt-3 group-hover:text-brand-orange transition-colors">
                      {team.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-2xs text-muted-foreground">
                        {t("team.membersCount", { count: team.members.length })}
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-2xs bg-brand-orange/12 text-brand-orange px-2 py-0.5 rounded-full font-semibold">
                          {t("team.pendingCount", { count: pendingCount })}
                        </span>
                      )}
                    </div>
                    {/* Member avatars */}
                    <div className="flex -space-x-2 mt-3">
                      {team.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} className="w-7 h-7 border-2 border-card">
                          <AvatarFallback className={`bg-gradient-to-br ${roleColors[m.role]} text-primary-foreground text-[9px] font-bold`}>
                            {getInitials(m.firstName, m.lastName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {team.members.length > 5 && (
                        <Avatar className="w-7 h-7 border-2 border-card">
                          <AvatarFallback className="bg-secondary text-muted-foreground text-[9px] font-bold">
                            +{team.members.length - 5}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        <CreateTeamModal open={createTeamOpen} onOpenChange={setCreateTeamOpen} onCreate={handleCreateTeam} />
      </PageShell>
    );
  }

  // ─── TEAM DETAIL VIEW ───
  const filteredMembers = selectedTeam.members.filter(
    (m) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedTeamId(null); setSearch(""); }}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{selectedTeam.name}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                {t("team.subtitle", { count: selectedTeam.members.length })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            {permissions.canInviteMembers && (
              <button
                onClick={() => setInviteOpen(true)}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 min-h-[44px]"
              >
                <UserPlus className="w-3.5 h-3.5" /> {t("team.inviteMember")}
              </button>
            )}
          </div>
        </motion.div>

        {/* ─── Team Dashboard ─── */}
        <motion.div variants={item} className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {/* Shared Tracks */}
          <div className="card-premium p-4 rounded-xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-orange/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/12 flex items-center justify-center">
                <Music className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Shared Tracks</p>
                <p className="text-xl font-bold text-foreground">{selectedTeam.sharedTrackCount}</p>
              </div>
            </div>
          </div>
          {/* Members */}
          <div className="card-premium p-4 rounded-xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-purple/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-purple/12 flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-purple" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Members</p>
                <p className="text-xl font-bold text-foreground">{selectedTeam.members.length}</p>
              </div>
            </div>
          </div>
          {/* Pitches */}
          <div className="card-premium p-4 rounded-xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-pink/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-pink/12 flex items-center justify-center">
                <Send className="w-5 h-5 text-brand-pink" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Pitches Made</p>
                <p className="text-xl font-bold text-foreground">{selectedTeam.activities.filter((a) => a.type === "pitch").length}</p>
              </div>
            </div>
          </div>
          {/* Links */}
          <div className="card-premium p-4 rounded-xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-primary/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Links Created</p>
                <p className="text-xl font-bold text-foreground">{selectedTeam.activities.filter((a) => a.type === "link").length}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Activity Feed ─── */}
        <motion.div variants={item} className="card-premium rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">Team Activity</h3>
            </div>
            <span className="text-2xs text-muted-foreground">{selectedTeam.activities.length} events</span>
          </div>
          {selectedTeam.activities.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No activity yet</div>
          ) : (
            <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
              {selectedTeam.activities.map((activity) => {
                const Icon = activityIcons[activity.type];
                const colorClass = activityColors[activity.type];
                const d = new Date(activity.date);
                const timeStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={activity.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground">
                        <span className="font-semibold">{activity.user}</span>{" "}
                        <span className="text-muted-foreground">{activity.message}</span>
                      </p>
                      <p className="text-2xs text-muted-foreground/60 mt-0.5">{timeStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Role stat pills */}
        <motion.div variants={item} className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const Icon = roleIcons[role];
            const count = selectedTeam.members.filter((m) => m.role === role).length;
            if (count === 0) return null;
            return (
              <div key={role} className="card-premium flex items-center gap-2.5 px-4 py-2.5 rounded-xl">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${roleColors[role]} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{t(`team.role_${role.toLowerCase()}`)}</p>
                  <p className="text-sm font-bold text-foreground">{count}</p>
                </div>
              </div>
            );
          })}
        </motion.div>


        {/* Search */}
        <motion.div variants={item}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("team.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus-brand min-h-[44px]"
            />
          </div>
        </motion.div>

        {/* Members list */}
        <motion.div variants={item}>
          {isMobile ? (
            <div className="space-y-2.5">
              {filteredMembers.map((m) => {
                const RoleIcon = roleIcons[m.role];
                const cfg = statusConfig[m.status];
                const StatusIcon = cfg.icon;
                const isOwner = m.firstName === "You";
                return (
                  <div key={m.id} className="card-premium p-4 flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className={`bg-gradient-to-br ${roleColors[m.role]} text-primary-foreground text-2xs font-bold`}>
                        {getInitials(m.firstName, m.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div>
                        <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" /> {m.email}
                        </p>
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-2xs gap-1 border-border bg-secondary/50 text-secondary-foreground">
                          <RoleIcon className="w-3 h-3" /> {t(`team.role_${m.role.toLowerCase()}`)}
                        </Badge>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {m.status === "active" ? t("team.active") : m.status === "pending" ? t("team.invited") : t("team.expired")}
                        </span>
                      </div>
                      <p className="text-2xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {t("team.joined")} {formatDate(m.joinedAt)}
                      </p>
                    </div>
                    {!isOwner && permissions.canManageTeam && (
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.member")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">{t("team.email")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.role")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("team.dateJoined")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.status")}</th>
                      <th className="px-5 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => {
                      const RoleIcon = roleIcons[m.role];
                      const cfg = statusConfig[m.status];
                      const StatusIcon = cfg.icon;
                      const isOwner = m.firstName === "You";
                      return (
                        <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className={`bg-gradient-to-br ${roleColors[m.role]} text-primary-foreground text-2xs font-bold`}>
                                  {getInitials(m.firstName, m.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground text-[13px] tracking-tight">
                                {m.firstName} {m.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{m.email}</td>
                          <td className="px-5 py-3.5">
                            {isOwner || !permissions.canManageTeam ? (
                              <Badge variant="outline" className="text-2xs gap-1 border-border bg-secondary/50 text-secondary-foreground font-medium">
                                <RoleIcon className="w-3 h-3" /> {t(`team.role_${m.role.toLowerCase()}`)}
                              </Badge>
                            ) : (
                              <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as TeamRole)}>
                                <SelectTrigger className="h-7 w-auto min-w-[130px] bg-secondary/50 border-border text-2xs gap-1">
                                  <RoleIcon className="w-3 h-3 shrink-0" />
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  {ROLES.map((r) => (
                                    <SelectItem key={r} value={r} className="text-2xs">
                                      {t(`team.role_${r.toLowerCase()}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{formatDate(m.joinedAt)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {m.status === "active" ? t("team.active") : m.status === "pending" ? t("team.invited") : t("team.expired")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {!isOwner && permissions.canManageTeam && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredMembers.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">{t("team.noResults")}</div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInvite} />
    </PageShell>
  );
}
