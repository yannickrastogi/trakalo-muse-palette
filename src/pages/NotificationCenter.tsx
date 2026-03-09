import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTeams, type TeamActivity, type ActivityType } from "@/contexts/TeamContext";
import { PageShell } from "@/components/PageShell";
import {
  Upload,
  Send,
  Link2,
  UserPlus,
  RefreshCw,
  FileText,
  PieChart,
  Layers,
  Music2,
  FileCheck,
  Eye,
  Play,
  Download,
  Package,
  Bell,
  Filter,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type TimeFilter = "24h" | "7d" | "30d" | "1y" | "all";

interface EnrichedActivity extends TeamActivity {
  teamName: string;
  teamId: string;
}

const activityMeta: Record<ActivityType, { icon: LucideIcon; color: string }> = {
  upload: { icon: Upload, color: "text-emerald-400" },
  pitch: { icon: Send, color: "text-brand-orange" },
  link: { icon: Link2, color: "text-sky-400" },
  member: { icon: UserPlus, color: "text-brand-pink" },
  status: { icon: RefreshCw, color: "text-amber-400" },
  metadata: { icon: FileText, color: "text-violet-400" },
  splits: { icon: PieChart, color: "text-teal-400" },
  stems: { icon: Layers, color: "text-indigo-400" },
  lyrics: { icon: Music2, color: "text-rose-400" },
  paperwork: { icon: FileCheck, color: "text-cyan-400" },
  recipient_opened: { icon: Eye, color: "text-yellow-400" },
  recipient_played: { icon: Play, color: "text-green-400" },
  recipient_downloaded: { icon: Download, color: "text-blue-400" },
  recipient_pack: { icon: Package, color: "text-orange-400" },
  recipient_stems: { icon: Layers, color: "text-purple-400" },
};

const timeFilters: { key: TimeFilter; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "1y", label: "1 Year" },
  { key: "all", label: "All" },
];

function getTimeThreshold(filter: TimeFilter): Date {
  const now = new Date();
  switch (filter) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "all": return new Date(0);
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDay > 365 ? "numeric" : undefined });
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDay = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDay === 0) return "Today";
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return "This Week";
  if (diffDay < 30) return "This Month";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function NotificationCenter() {
  const { t } = useTranslation();
  const { teams } = useTeams();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Merge all activities from all teams
  const allActivities = useMemo<EnrichedActivity[]>(() => {
    const merged: EnrichedActivity[] = [];
    teams.forEach((team) => {
      team.activities.forEach((activity) => {
        merged.push({ ...activity, teamName: team.name, teamId: team.id });
      });
    });
    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teams]);

  // Apply filters
  const filteredActivities = useMemo(() => {
    const threshold = getTimeThreshold(timeFilter);
    return allActivities.filter((a) => {
      if (new Date(a.date) < threshold) return false;
      if (teamFilter !== "all" && a.teamId !== teamFilter) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      return true;
    });
  }, [allActivities, timeFilter, teamFilter, typeFilter]);

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, EnrichedActivity[]> = {};
    filteredActivities.forEach((a) => {
      const group = formatDateGroup(a.date);
      if (!groups[group]) groups[group] = [];
      groups[group].push(a);
    });
    return groups;
  }, [filteredActivities]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(allActivities.map((a) => a.type));
    return Array.from(types).sort();
  }, [allActivities]);

  const typeLabels: Record<string, string> = {
    upload: "Uploads",
    pitch: "Pitches",
    link: "Links",
    member: "Members",
    status: "Status",
    metadata: "Metadata",
    splits: "Splits",
    stems: "Stems",
    lyrics: "Lyrics",
    paperwork: "Paperwork",
    recipient_opened: "Opened",
    recipient_played: "Played",
    recipient_downloaded: "Downloaded",
    recipient_pack: "Pack Downloaded",
    recipient_stems: "Stems Downloaded",
  };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[1200px] space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-brand-orange" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Notification Center</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">All activity across your teams in real time</p>
            </div>
          </div>
          <Badge variant="secondary" className="self-start sm:self-auto text-xs font-semibold px-3 py-1.5">
            {filteredActivities.length} {filteredActivities.length === 1 ? "event" : "events"}
          </Badge>
        </motion.div>

        {/* Filters */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          {/* Time filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border">
            {timeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setTimeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeFilter === f.key
                    ? "bg-brand-orange text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Team filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border">
            <button
              onClick={() => setTeamFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                teamFilter === "all"
                  ? "bg-brand-orange text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Users className="w-3 h-3" />
              All Teams
            </button>
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setTeamFilter(team.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  teamFilter === team.id
                    ? "bg-brand-orange text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {team.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Type filter pills */}
        <motion.div variants={item} className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-2.5 py-1 rounded-full text-2xs font-semibold transition-all border ${
              typeFilter === "all"
                ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-orange/20"
            }`}
          >
            <Filter className="w-3 h-3 inline mr-1" />
            All Types
          </button>
          {uniqueTypes.map((type) => {
            const meta = activityMeta[type as ActivityType];
            const Icon = meta?.icon;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded-full text-2xs font-semibold transition-all border flex items-center gap-1 ${
                  typeFilter === type
                    ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-orange/20"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {typeLabels[type] || type}
              </button>
            );
          })}
        </motion.div>

        {/* Activity feed */}
        {filteredActivities.length === 0 ? (
          <motion.div variants={item} className="card-premium p-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No activity found for this period</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
          </motion.div>
        ) : (
          Object.entries(groupedActivities).map(([group, activities]) => (
            <motion.div key={group} variants={item} className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{group}</h3>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-2xs text-muted-foreground font-medium">{activities.length}</span>
              </div>
              <div className="card-premium divide-y divide-border/40 overflow-hidden">
                {activities.map((activity) => {
                  const meta = activityMeta[activity.type];
                  const Icon = meta?.icon || Bell;
                  const colorClass = meta?.color || "text-muted-foreground";

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 px-4 py-3.5 hover:bg-secondary/20 transition-colors group"
                    >
                      <div className={`w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
                        <Icon className={`w-4 h-4 ${colorClass}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground/90 leading-relaxed">
                          <span className="font-semibold text-foreground">{activity.user}</span>{" "}
                          {activity.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xs text-muted-foreground font-medium">{formatRelativeTime(activity.date)}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-2xs text-muted-foreground/70 font-medium">{activity.teamName}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-2xs shrink-0 self-center border-border/60 text-muted-foreground/70">
                        {typeLabels[activity.type] || activity.type}
                      </Badge>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </PageShell>
  );
}
