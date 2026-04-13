import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTeams, type TeamActivity, type ActivityType } from "@/contexts/TeamContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
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
  Bookmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type TimeFilter = "24h" | "7d" | "30d" | "1y" | "all";

interface EnrichedActivity extends TeamActivity {
  teamName: string;
  teamId: string;
}

const activityMeta: Record<ActivityType, { icon: LucideIcon; color: string; bg: string; badgeCls: string }> = {
  upload: { icon: Upload, color: "text-emerald-400", bg: "bg-emerald-400/10", badgeCls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  pitch: { icon: Send, color: "text-brand-orange", bg: "bg-brand-orange/10", badgeCls: "bg-brand-orange/10 text-brand-orange border-brand-orange/20" },
  link: { icon: Link2, color: "text-sky-400", bg: "bg-sky-400/10", badgeCls: "bg-sky-400/10 text-sky-400 border-sky-400/20" },
  member: { icon: UserPlus, color: "text-brand-pink", bg: "bg-brand-pink/10", badgeCls: "bg-brand-pink/10 text-brand-pink border-brand-pink/20" },
  status: { icon: RefreshCw, color: "text-amber-400", bg: "bg-amber-400/10", badgeCls: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  metadata: { icon: FileText, color: "text-violet-400", bg: "bg-violet-400/10", badgeCls: "bg-violet-400/10 text-violet-400 border-violet-400/20" },
  splits: { icon: PieChart, color: "text-teal-400", bg: "bg-teal-400/10", badgeCls: "bg-teal-400/10 text-teal-400 border-teal-400/20" },
  stems: { icon: Layers, color: "text-indigo-400", bg: "bg-indigo-400/10", badgeCls: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20" },
  lyrics: { icon: Music2, color: "text-rose-400", bg: "bg-rose-400/10", badgeCls: "bg-rose-400/10 text-rose-400 border-rose-400/20" },
  paperwork: { icon: FileCheck, color: "text-cyan-400", bg: "bg-cyan-400/10", badgeCls: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" },
  recipient_opened: { icon: Eye, color: "text-yellow-400", bg: "bg-yellow-400/10", badgeCls: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" },
  recipient_played: { icon: Play, color: "text-green-400", bg: "bg-green-400/10", badgeCls: "bg-green-400/10 text-green-400 border-green-400/20" },
  recipient_downloaded: { icon: Download, color: "text-blue-400", bg: "bg-blue-400/10", badgeCls: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  recipient_pack: { icon: Package, color: "text-orange-400", bg: "bg-orange-400/10", badgeCls: "bg-orange-400/10 text-orange-400 border-orange-400/20" },
  recipient_stems: { icon: Layers, color: "text-purple-400", bg: "bg-purple-400/10", badgeCls: "bg-purple-400/10 text-purple-400 border-purple-400/20" },
  recipient_saved: { icon: Bookmark, color: "text-brand-purple", bg: "bg-brand-purple/10", badgeCls: "bg-brand-purple/10 text-brand-purple border-brand-purple/20" },
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
  const { activeWorkspace } = useWorkspace();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [linkEventActivities, setLinkEventActivities] = useState<EnrichedActivity[]>([]);

  // Fetch link_events and convert to activities
  useEffect(function() {
    if (!activeWorkspace) return;

    async function fetchLinkEvents() {
      // Get shared_links for this workspace to filter events
      var { data: links } = await supabase
        .from("shared_links")
        .select("id, link_name")
        .eq("workspace_id", activeWorkspace!.id);

      if (!links || links.length === 0) {
        setLinkEventActivities([]);
        return;
      }

      var linkIds = links.map(function(l) { return l.id; });
      var linkNameMap: Record<string, string> = {};
      links.forEach(function(l) { linkNameMap[l.id] = l.link_name; });

      var { data: events } = await supabase
        .from("link_events")
        .select("id, event_type, visitor_email, created_at, link_id")
        .in("link_id", linkIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!events) {
        setLinkEventActivities([]);
        return;
      }

      var activities: EnrichedActivity[] = events.map(function(evt) {
        var typeMap: Record<string, ActivityType> = {
          play: "recipient_played",
          download: "recipient_downloaded",
          view: "recipient_opened",
          save: "recipient_saved" as ActivityType,
        };
        var messageMap: Record<string, string> = {
          play: "listened to your track",
          download: "downloaded your track",
          view: "viewed your shared link",
          save: "saved your track to their Trakalog",
        };
        var linkName = linkNameMap[evt.link_id] || "";
        return {
          id: evt.id,
          user: evt.visitor_email || "Anonymous visitor",
          message: messageMap[evt.event_type] + (linkName ? " \"" + linkName + "\"" : ""),
          type: typeMap[evt.event_type] || "recipient_opened",
          date: evt.created_at,
          teamName: "Shared Links",
          teamId: "__link_events__",
        };
      });

      setLinkEventActivities(activities);
    }

    fetchLinkEvents();
  }, [activeWorkspace]);

  // Merge all activities from all teams + link events
  const allActivities = useMemo<EnrichedActivity[]>(() => {
    const merged: EnrichedActivity[] = [];
    teams.forEach((team) => {
      team.activities.forEach((activity) => {
        merged.push({ ...activity, teamName: team.name, teamId: team.id });
      });
    });
    linkEventActivities.forEach(function(a) { merged.push(a); });
    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teams, linkEventActivities]);

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

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActivities.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return counts;
  }, [filteredActivities]);

  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredActivities.filter((a) => new Date(a.date) >= today).length;
  }, [filteredActivities]);

  const thisWeekCount = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return filteredActivities.filter((a) => new Date(a.date) >= weekAgo).length;
  }, [filteredActivities]);

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
    recipient_saved: "Saved to Trakalog",
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
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge className="bg-brand-orange/10 text-brand-orange border border-brand-orange/20 text-xs font-semibold px-3 py-1.5">
              {filteredActivities.length} {filteredActivities.length === 1 ? "event" : "events"}
            </Badge>
            <span className="text-2xs text-muted-foreground font-medium px-2 py-1 rounded-full bg-secondary/60 border border-border">
              {todayCount} today
            </span>
            <span className="text-2xs text-muted-foreground font-medium px-2 py-1 rounded-full bg-secondary/60 border border-border">
              {thisWeekCount} this week
            </span>
          </div>
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
                    ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
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
                  ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
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
                    ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
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
                {typeLabels[type] || type}{typeCounts[type] ? " (" + typeCounts[type] + ")" : ""}
              </button>
            );
          })}
        </motion.div>

        {/* Activity feed */}
        {filteredActivities.length === 0 ? (
          <motion.div variants={item} className="card-premium p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-brand-orange" />
            </div>
            <p className="text-sm text-foreground font-semibold">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">When your team takes action, it will show up here. Try adjusting your filters or check back later.</p>
          </motion.div>
        ) : (
          Object.entries(groupedActivities).map(([group, activities]) => (
            <motion.div key={group} variants={item} className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{group}</h3>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-2xs text-brand-orange font-semibold bg-brand-orange/10 rounded-full px-2 py-0.5">{activities.length}</span>
              </div>
              <div className="card-premium divide-y divide-border/40 overflow-hidden">
                {activities.map((activity) => {
                  const meta = activityMeta[activity.type];
                  const Icon = meta?.icon || Bell;
                  const colorClass = meta?.color || "text-muted-foreground";
                  const bgClass = meta?.bg || "bg-secondary";
                  const badgeCls = meta?.badgeCls || "bg-secondary text-muted-foreground border-border/60";

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-colors group"
                    >
                      <div className={`w-9 h-9 rounded-xl ${bgClass} flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
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
                      <Badge className={`text-2xs shrink-0 self-center border ${badgeCls}`}>
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
