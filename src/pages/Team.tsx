import React, { useState } from "react";
import { motion } from "framer-motion";
import { TeamSharedCatalog } from "@/components/TeamSharedCatalog";
import { SendApprovalSettings } from "@/components/SendApprovalSettings";
import {
  Plus, Search, Mail, Shield, Eye, Headphones, UserCog, MoreHorizontal,
  Calendar, PenTool, BookOpen, Briefcase, UserCheck, Sliders, Disc3,
  Music, Clock, CheckCircle2, XCircle, Users, Trash2, UserPlus,
  Upload, Send, ExternalLink, Activity, BarChart3, FileText, SplitSquareVertical,
  Layers, Type, Play, Download, Package, Bell, Edit3,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteMemberModal, type InvitePayload } from "@/components/InviteMemberModal";
import { toast } from "sonner";
import { useRole, type AccessLevel } from "@/contexts/RoleContext";
import { useTeams, type TeamRole, type ActivityType } from "@/contexts/TeamContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCESS_LEVELS: AccessLevel[] = ["viewer", "pitcher", "editor", "admin"];

const accessLevelLabels: Record<AccessLevel, string> = {
  viewer: "Viewer",
  pitcher: "Pitcher",
  editor: "Editor",
  admin: "Admin",
};

const accessLevelColors: Record<AccessLevel, string> = {
  admin: "bg-brand-orange/12 text-brand-orange",
  editor: "bg-brand-purple/12 text-brand-purple",
  pitcher: "bg-brand-pink/12 text-brand-pink",
  viewer: "bg-muted-foreground/12 text-muted-foreground",
};

const accessLevelIcons: Record<AccessLevel, React.ElementType> = {
  admin: Shield,
  editor: Edit3,
  pitcher: Send,
  viewer: Eye,
};

const PROFESSIONAL_TITLES = [
  "Producer", "Songwriter", "Musician", "Mix Engineer", "Mastering Engineer",
  "Manager", "Publisher", "A&R", "Assistant", "Artist",
];

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

// Map access levels to gradient colors for avatars
const accessGradients: Record<AccessLevel, string> = {
  admin: "from-brand-orange to-brand-pink",
  editor: "from-brand-purple to-brand-pink",
  pitcher: "from-brand-pink to-brand-orange",
  viewer: "from-muted-foreground/40 to-muted-foreground/20",
};

const activityIcons: Record<ActivityType, React.ElementType> = {
  upload: Upload,
  pitch: Send,
  link: ExternalLink,
  member: UserPlus,
  status: Activity,
  metadata: PenTool,
  splits: SplitSquareVertical,
  stems: Layers,
  lyrics: Type,
  paperwork: FileText,
  recipient_opened: Eye,
  recipient_played: Play,
  recipient_downloaded: Download,
  recipient_pack: Package,
  recipient_stems: Layers,
};

const activityColors: Record<ActivityType, string> = {
  upload: "bg-brand-orange/12 text-brand-orange",
  pitch: "bg-brand-purple/12 text-brand-purple",
  link: "bg-primary/12 text-primary",
  member: "bg-emerald-500/12 text-emerald-400",
  status: "bg-brand-pink/12 text-brand-pink",
  metadata: "bg-[hsl(200,70%,50%)]/12 text-[hsl(200,70%,50%)]",
  splits: "bg-brand-orange/12 text-brand-orange",
  stems: "bg-[hsl(180,60%,45%)]/12 text-[hsl(180,60%,45%)]",
  lyrics: "bg-brand-purple/12 text-brand-purple",
  paperwork: "bg-muted-foreground/12 text-muted-foreground",
  recipient_opened: "bg-amber-500/12 text-amber-400",
  recipient_played: "bg-emerald-500/12 text-emerald-400",
  recipient_downloaded: "bg-[hsl(200,70%,50%)]/12 text-[hsl(200,70%,50%)]",
  recipient_pack: "bg-brand-purple/12 text-brand-purple",
  recipient_stems: "bg-[hsl(180,60%,45%)]/12 text-[hsl(180,60%,45%)]",
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

function formatDateSmart(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return diffDays + " days ago";
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
  const { teams, addMember, removeMember, updateMemberAccess } = useTeams();
  const { activeWorkspace } = useWorkspace();

  const [showSharedCatalog, setShowSharedCatalog] = useState(false);
  const [activityRange, setActivityRange] = useState<"1d" | "1w" | "1m" | "1y">("1w");
  const [activitySearch, setActivitySearch] = useState("");
  const membersRef = React.useRef<HTMLDivElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Use the first team of the active workspace (the workspace IS the team)
  const selectedTeam = teams[0] || null;
  const selectedTeamId = selectedTeam?.id || null;

  const handleInvite = (payload: InvitePayload) => {
    toast.success(t("inviteMember.inviteSent", { email: payload.email }));
  };

  const handleRemoveMember = (memberId: string) => {
    if (!selectedTeamId) return;
    removeMember(selectedTeamId, memberId);
    toast.success(t("team.memberRemoved"));
  };

  const handleAccessLevelChange = (memberId: string, newLevel: AccessLevel, currentTitle: string | null) => {
    if (!selectedTeamId) return;
    updateMemberAccess(selectedTeamId, memberId, newLevel, currentTitle);
    toast.success(t("team.roleUpdated"));
  };

  const handleProfessionalTitleChange = (memberId: string, currentLevel: AccessLevel, newTitle: string | null) => {
    if (!selectedTeamId) return;
    updateMemberAccess(selectedTeamId, memberId, currentLevel, newTitle);
    toast.success(t("team.roleUpdated"));
  };

  const filteredMembers = selectedTeam
    ? selectedTeam.members.filter(
        (m) =>
          (m.firstName + " " + m.lastName).toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase()) ||
          accessLevelLabels[m.accessLevel].toLowerCase().includes(search.toLowerCase()) ||
          (m.professionalTitle || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-brand-orange" />
              {t("team.title")}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {t("team.subtitle", { count: selectedTeam?.members.length || 0, workspace: activeWorkspace.name })}
            </p>
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

        {!selectedTeam ? (
          <motion.div variants={item} className="card-premium p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
              <Users className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold text-base">{t("team.noTeams")}</h3>
              <p className="text-muted-foreground text-sm mt-1">{t("team.noTeamsDesc")}</p>
            </div>
          </motion.div>
        ) : (
        <>
        {/* ─── Shared Catalog View ─── */}
        {showSharedCatalog ? (
          <TeamSharedCatalog
            teamName={selectedTeam.name}
            sharedTrackIds={selectedTeam.sharedTrackIds}
            onBack={() => setShowSharedCatalog(false)}
          />
        ) : (
        <>
        {/* ─── Dashboard Cards ─── */}
        <motion.div variants={item} className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {/* Team's Catalog */}
          <button
            onClick={() => setShowSharedCatalog(true)}
            className="card-premium p-4 rounded-xl relative overflow-hidden text-left hover:border-brand-orange/30 transition-colors group"
          >
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-orange/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/12 flex items-center justify-center">
                <Music className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Catalog</p>
                <p className="text-xl font-bold text-foreground group-hover:text-brand-orange transition-colors">{selectedTeam.sharedTrackIds.length}</p>
              </div>
            </div>
          </button>
          {/* Members */}
          <button
            onClick={() => membersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="card-premium p-4 rounded-xl relative overflow-hidden text-left hover:border-brand-purple/30 transition-colors group"
          >
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-purple/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-purple/12 flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-purple" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{t("team.members")}</p>
                <p className="text-xl font-bold text-foreground group-hover:text-brand-purple transition-colors">{selectedTeam.members.length}</p>
              </div>
            </div>
          </button>
          {/* Activity */}
          <button
            onClick={() => {
              var el = document.getElementById("team-activity-feed");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="card-premium p-4 rounded-xl relative overflow-hidden text-left hover:border-brand-pink/30 transition-colors group"
          >
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-brand-pink/8 blur-xl" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-pink/12 flex items-center justify-center">
                <Activity className="w-5 h-5 text-brand-pink" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{t("team.activity")}</p>
                <p className="text-xl font-bold text-foreground group-hover:text-brand-pink transition-colors">{selectedTeam.activities.length}</p>
              </div>
            </div>
          </button>
        </motion.div>

        {/* ─── Activity Feed ─── */}
        <motion.div variants={item} id="team-activity-feed" className="card-premium rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">{t("team.teamActivity")}</h3>
              </div>
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                {(["1d", "1w", "1m", "1y"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setActivityRange(range)}
                    className={"px-2.5 py-1 rounded-md text-2xs font-semibold transition-all " + (
                      activityRange === range
                        ? "bg-brand-pink/15 text-brand-pink"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range === "1d" ? "1D" : range === "1w" ? "1W" : range === "1m" ? "1M" : "1Y"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search activity… e.g. track name, pitched, stems, status"
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </div>
          {(() => {
            var now = new Date();
            var cutoff = new Date(now);
            if (activityRange === "1d") cutoff.setDate(now.getDate() - 1);
            else if (activityRange === "1w") cutoff.setDate(now.getDate() - 7);
            else if (activityRange === "1m") cutoff.setMonth(now.getMonth() - 1);
            else cutoff.setFullYear(now.getFullYear() - 1);
            var q = activitySearch.toLowerCase().trim();
            var filtered = selectedTeam.activities.filter(function (a) {
              if (new Date(a.date) < cutoff) return false;
              if (q && !a.message.toLowerCase().includes(q) && !a.user.toLowerCase().includes(q) && !a.type.toLowerCase().includes(q)) return false;
              return true;
            });
            return filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                {q ? "No matching activity" : "No activity in this period"}
              </div>
            ) : (
              <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
                {filtered.map(function (activity) {
                  var Icon = activityIcons[activity.type];
                  var colorClass = activityColors[activity.type];
                  var d = new Date(activity.date);
                  var timeStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  return (
                    <div key={activity.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
                      <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 " + colorClass}>
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
            );
          })()}
        </motion.div>

        {/* Send Approvals Section */}
        {permissions.canManageTeam && (
          <motion.div variants={item} className="card-premium p-5 rounded-xl">
            <SendApprovalSettings teamId={selectedTeamId!} />
          </motion.div>
        )}

        {/* Access level stat pills */}
        <motion.div variants={item} className="flex flex-wrap gap-2">
          {ACCESS_LEVELS.map(function (level) {
            var Icon = accessLevelIcons[level];
            var count = selectedTeam.members.filter(function (m) { return m.accessLevel === level; }).length;
            if (count === 0) return null;
            return (
              <div key={level} className="card-premium flex items-center gap-2.5 px-4 py-2.5 rounded-xl">
                <div className={"w-7 h-7 rounded-lg flex items-center justify-center " + accessLevelColors[level]}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{accessLevelLabels[level]}</p>
                  <p className="text-sm font-bold text-foreground">{count}</p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Search */}
        <motion.div variants={item} ref={membersRef}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={function (e) { setSearch(e.target.value); }}
              placeholder={t("team.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus-brand min-h-[44px]"
            />
          </div>
        </motion.div>

        {/* Members list */}
        <motion.div variants={item}>
          {isMobile ? (
            <div className="space-y-2.5">
              {filteredMembers.map(function (m) {
                var AccessIcon = accessLevelIcons[m.accessLevel];
                var cfg = statusConfig[m.status];
                var StatusIcon = cfg.icon;
                var isOwner = m.id === activeWorkspace.owner_id;
                return (
                  <div key={m.id} className="card-premium p-4 flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className={"bg-gradient-to-br " + accessGradients[m.accessLevel] + " text-primary-foreground text-2xs font-bold"}>
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
                        <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider " + accessLevelColors[m.accessLevel]}>
                          <AccessIcon className="w-3 h-3" /> {accessLevelLabels[m.accessLevel]}
                        </span>
                        {m.professionalTitle && (
                          <span className="text-xs text-muted-foreground">{m.professionalTitle}</span>
                        )}
                        <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold " + cfg.color}>
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
                        onClick={function () { handleRemoveMember(m.id); }}
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
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.role")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("team.dateJoined")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.status")}</th>
                      <th className="px-5 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map(function (m) {
                      var AccessIcon = accessLevelIcons[m.accessLevel];
                      var cfg = statusConfig[m.status];
                      var StatusIcon = cfg.icon;
                      var isOwner = m.id === activeWorkspace.owner_id;
                      return (
                        <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className={"bg-gradient-to-br " + accessGradients[m.accessLevel] + " text-primary-foreground text-2xs font-bold"}>
                                  {getInitials(m.firstName, m.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">
                                  {m.firstName} {m.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {isOwner || !permissions.canManageTeam ? (
                              <div>
                                <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider " + accessLevelColors[m.accessLevel]}>
                                  <AccessIcon className="w-3 h-3" /> {accessLevelLabels[m.accessLevel]}
                                </span>
                                {m.professionalTitle && (
                                  <p className="text-xs text-muted-foreground mt-1">{m.professionalTitle}</p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <Select value={m.accessLevel} onValueChange={function (v) { handleAccessLevelChange(m.id, v as AccessLevel, m.professionalTitle); }}>
                                  <SelectTrigger className="h-7 w-auto min-w-[120px] bg-secondary/50 border-border text-2xs gap-1">
                                    <AccessIcon className="w-3 h-3 shrink-0" />
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border">
                                    {ACCESS_LEVELS.map(function (level) {
                                      var LvlIcon = accessLevelIcons[level];
                                      return (
                                        <SelectItem key={level} value={level} className="text-2xs">
                                          <span className="flex items-center gap-1.5">
                                            <LvlIcon className="w-3 h-3" /> {accessLevelLabels[level]}
                                          </span>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                <Select value={m.professionalTitle || "__none__"} onValueChange={function (v) { handleProfessionalTitleChange(m.id, m.accessLevel, v === "__none__" ? null : v); }}>
                                  <SelectTrigger className="h-6 w-auto min-w-[120px] bg-transparent border-border/50 text-2xs text-muted-foreground gap-1">
                                    <SelectValue placeholder="Title (optional)" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border">
                                    <SelectItem value="__none__" className="text-2xs text-muted-foreground">
                                      No title
                                    </SelectItem>
                                    {PROFESSIONAL_TITLES.map(function (title) {
                                      return (
                                        <SelectItem key={title} value={title} className="text-2xs">
                                          {title}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{formatDate(m.joinedAt)}</td>
                          <td className="px-5 py-3.5">
                            <span className={"inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold " + cfg.color}>
                              <StatusIcon className="w-3 h-3" />
                              {m.status === "active" ? t("team.active") : m.status === "pending" ? t("team.invited") : t("team.expired")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {!isOwner && permissions.canManageTeam && (
                              <button
                                onClick={function () { handleRemoveMember(m.id); }}
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
              {/* Table Footer */}
              <div
                className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground font-medium"
                style={{
                  borderTop: "1px solid transparent",
                  borderImage: "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1",
                }}
              >
                <span>{filteredMembers.length + " member" + (filteredMembers.length !== 1 ? "s" : "")}</span>
                <span className="text-2xs text-muted-foreground/50">TRAKALOG</span>
              </div>
            </div>
          )}
        </motion.div>
        </>
        )}
        </>
        )}
      </motion.div>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInvite} preselectedTeamId={selectedTeamId || undefined} />
    </PageShell>
  );
}
