import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  X,
  Send,
  FileText,
  Eye,
  MessageSquare,
  Mail,
  Building2,
  User,
  Calendar,
  Music,
  ListMusic,
  Filter,
  ChevronDown,
  Play,
  Download,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreatePitchModal, type PitchEntry } from "@/components/CreatePitchModal";
import { useRole } from "@/contexts/RoleContext";
import { usePitches } from "@/contexts/PitchContext";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

type PitchStatus = "Draft" | "Sent" | "Opened" | "Responded";

const statusConfig: Record<PitchStatus, { color: string; icon: React.ElementType; dot: string }> = {
  Draft: { color: "bg-muted/60 text-muted-foreground", icon: FileText, dot: "bg-muted-foreground" },
  Sent: { color: "bg-primary/12 text-primary", icon: Send, dot: "bg-primary" },
  Opened: { color: "bg-brand-purple/12 text-brand-purple", icon: Eye, dot: "bg-brand-purple" },
  Responded: { color: "bg-emerald-500/12 text-emerald-400", icon: MessageSquare, dot: "bg-emerald-400" },
};

const allStatuses: PitchStatus[] = ["Draft", "Sent", "Opened", "Responded"];

// Demo pitches removed — now managed via PitchContext

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function Pitch() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { permissions } = useRole();
  const { pitches, addPitch } = usePitches();
  const { activeWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PitchStatus | "active" | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pitchStats, setPitchStats] = useState<Record<string, { views: number; plays: number; downloads: number }>>({});

  useEffect(function() {
    if (!activeWorkspace) return;

    async function fetchStats() {
      var { data: links } = await supabase
        .from("shared_links")
        .select("id, link_name")
        .eq("workspace_id", activeWorkspace!.id);

      if (!links || links.length === 0) return;

      var linkIds = links.map(function(l) { return l.id; });
      var { data: events } = await supabase
        .from("link_events")
        .select("link_id, event_type")
        .in("link_id", linkIds);

      var linkStatsMap: Record<string, { views: number; plays: number; downloads: number }> = {};
      (events || []).forEach(function(e: { link_id: string; event_type: string }) {
        if (!linkStatsMap[e.link_id]) linkStatsMap[e.link_id] = { views: 0, plays: 0, downloads: 0 };
        if (e.event_type === "view") linkStatsMap[e.link_id].views++;
        if (e.event_type === "play") linkStatsMap[e.link_id].plays++;
        if (e.event_type === "download") linkStatsMap[e.link_id].downloads++;
      });

      // Aggregate by link_name (matches pitch itemName)
      var byName: Record<string, { views: number; plays: number; downloads: number }> = {};
      links.forEach(function(l) {
        var s = linkStatsMap[l.id];
        if (!s) return;
        if (!byName[l.link_name]) byName[l.link_name] = { views: 0, plays: 0, downloads: 0 };
        byName[l.link_name].views += s.views;
        byName[l.link_name].plays += s.plays;
        byName[l.link_name].downloads += s.downloads;
      });

      setPitchStats(byName);
    }

    fetchStats();
  }, [activeWorkspace, pitches]);

  const stats = useMemo(() => {
    const total = pitches.length;
    const draft = pitches.filter((p) => p.status === "Draft").length;
    const sent = pitches.filter((p) => p.status === "Sent").length;
    const opened = pitches.filter((p) => p.status === "Opened").length;
    const responded = pitches.filter((p) => p.status === "Responded").length;
    const statCards: { label: string; value: number; sub: string; accent: boolean; filterKey: PitchStatus | "active" | null }[] = [
      { label: t("pitch.totalPitches"), value: total, sub: t("pitch.active", { count: sent + opened }), accent: false, filterKey: null },
      { label: t("pitch.drafts"), value: draft, sub: t("pitch.readyToSend"), accent: false, filterKey: "Draft" },
      { label: t("pitch.sentOpened"), value: sent + opened, sub: t("pitch.awaitingResponse"), accent: true, filterKey: "active" },
      { label: t("pitch.responded"), value: responded, sub: t("pitch.responseRate", { rate: Math.round((responded / Math.max(total, 1)) * 100) }), accent: true, filterKey: "Responded" },
    ];
    return { statCards, counts: { total, draft, sent, opened, responded } };
  }, [pitches]);

  const filtered = useMemo(() => {
    let list = pitches;
    if (statusFilter === "active") {
      list = list.filter((p) => p.status === "Sent" || p.status === "Opened");
    } else if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.itemName.toLowerCase().includes(q) ||
          p.recipientName.toLowerCase().includes(q) ||
          p.recipientCompany.toLowerCase().includes(q) ||
          p.recipientEmail.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pitches, search, statusFilter]);

  const handleCreate = (pitch: PitchEntry) => {
    addPitch(pitch);
  };

  return (
    <PageShell>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]"
      >
        {/* Header */}
        <motion.div
          variants={item}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {t("pitch.title")}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              {t("pitch.subtitle")}
            </p>
          </div>
          {permissions.canSendPitches && (
            <button
              onClick={() => setCreateOpen(true)}
              className="btn-brand flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 self-start min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> {t("pitch.createPitch")}
            </button>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.statCards.map((s, i) => {
            const isActive = statusFilter === s.filterKey;
            return (
              <motion.div
                key={s.label}
                variants={item}
                onClick={() => setStatusFilter(isActive ? null : s.filterKey)}
                className={`card-premium p-4 sm:p-5 relative overflow-hidden cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "ring-2 ring-primary/40 bg-primary/5"
                    : "hover:ring-1 hover:ring-border/60"
                }`}
              >
                {i === 0 && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-[40px] pointer-events-none" />
                )}
                <p className="text-xl sm:text-[28px] font-bold text-foreground tracking-tight leading-none">
                  {s.value}
                </p>
                <p className="text-2xs sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 font-medium">
                  {s.label}
                </p>
                <p className={`text-2xs mt-0.5 sm:mt-1 font-semibold ${s.accent ? "text-emerald-400/80" : "text-muted-foreground/50"}`}>
                  {s.sub}
                </p>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-brand-purple" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Filters & Search */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 max-w-md border border-border/50 focus-within:border-primary/30 transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder={t("pitch.searchPitches")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                !statusFilter ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t("pitch.all")}
            </button>
            {allStatuses.map((s) => {
              const cfg = statusConfig[s];
              const isActive = statusFilter === s || (statusFilter === "active" && (s === "Sent" || s === "Opened"));
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                    isActive ? cfg.color : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {s}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Pitch List */}
        <motion.div variants={item}>
          {filtered.length === 0 ? (
            <div className="card-premium py-20 text-center">
              <Send className="w-10 h-10 mx-auto mb-4 text-muted-foreground/15" />
              <p className="text-sm font-semibold text-foreground">{t("pitch.noPitches")}</p>
              <p className="text-xs mt-1.5 text-muted-foreground/70">
                {search || statusFilter ? t("pitch.adjustFilters") : t("pitch.createFirst")}
              </p>
            </div>
          ) : isMobile ? (
            <MobilePitchList
              pitches={filtered}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              pitchStats={pitchStats}
            />
          ) : (
            <DesktopPitchTable pitches={filtered} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} pitchStats={pitchStats} />
          )}
        </motion.div>
      </motion.div>

      <CreatePitchModal open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </PageShell>
  );
}

/* ─── Desktop Table ─── */
function DesktopPitchTable({
  pitches,
  expandedId,
  onToggle,
  pitchStats,
}: {
  pitches: PitchEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  pitchStats: Record<string, { views: number; plays: number; downloads: number }>;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track / Playlist</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Recipient</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Company</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Date</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Engagement</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody>
            {pitches.map((p) => {
              const cfg = statusConfig[p.status as keyof typeof statusConfig];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === p.id;
              return (
                <tr
                  key={p.id}
                  className="border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 cursor-pointer group/row"
                  onClick={() => onToggle(p.id)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/50">
                        <img src={covers[p.coverIdx]} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {p.type === "playlist" ? (
                            <ListMusic className="w-3 h-3 text-accent/60 shrink-0" />
                          ) : (
                            <Music className="w-3 h-3 text-primary/50 shrink-0" />
                          )}
                          <p className="font-semibold text-foreground truncate text-[13px] tracking-tight">{p.itemName}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{p.artist}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="text-foreground font-medium text-[13px]">{p.recipientName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      <span className="text-muted-foreground text-xs">{p.recipientCompany}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                      <span className="text-muted-foreground/70 text-xs font-mono">{p.recipientEmail}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-muted-foreground text-xs">{p.date}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {(() => {
                      const s = pitchStats[p.itemName];
                      if (!s || (s.views === 0 && s.plays === 0 && s.downloads === 0)) {
                        return <span className="text-2xs text-muted-foreground/40">—</span>;
                      }
                      return (
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-orange">
                            <Eye className="w-3 h-3" /> {s.views}
                          </span>
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-pink">
                            <Play className="w-3 h-3" /> {s.plays}
                          </span>
                          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-chart-5">
                            <Download className="w-3 h-3" /> {s.downloads}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground font-medium"
        style={{
          borderTop: "1px solid transparent",
          borderImage: "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1",
        }}
      >
        <span>{pitches.length} pitch{pitches.length !== 1 ? "es" : ""}</span>
        <span className="text-2xs text-muted-foreground/50">TRAKALOG Pitch</span>
      </div>
    </div>
  );
}

/* ─── Mobile List ─── */
function MobilePitchList({
  pitches,
  expandedId,
  onToggle,
  pitchStats,
}: {
  pitches: PitchEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  pitchStats: Record<string, { views: number; plays: number; downloads: number }>;
}) {
  return (
    <div className="space-y-2.5">
      {pitches.map((p) => {
        const cfg = statusConfig[p.status as keyof typeof statusConfig];
        const StatusIcon = cfg.icon;
        const isExpanded = expandedId === p.id;
        return (
          <motion.div
            key={p.id}
            layout
            className="card-premium overflow-hidden"
            onClick={() => onToggle(p.id)}
          >
            <div className="p-4 flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/50">
                <img src={covers[p.coverIdx]} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {p.type === "playlist" ? (
                    <ListMusic className="w-3 h-3 text-accent/60 shrink-0" />
                  ) : (
                    <Music className="w-3 h-3 text-primary/50 shrink-0" />
                  )}
                  <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">{p.itemName}</p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  → {p.recipientName} · {p.recipientCompany}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-2xs text-muted-foreground/60">{p.date}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold ${cfg.color}`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {p.status}
                  </span>
                  {(() => {
                    const s = pitchStats[p.itemName];
                    if (!s || (s.views === 0 && s.plays === 0 && s.downloads === 0)) return null;
                    return (
                      <>
                        <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-brand-orange">
                          <Eye className="w-2.5 h-2.5" /> {s.views}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-brand-pink">
                          <Play className="w-2.5 h-2.5" /> {s.plays}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-chart-5">
                          <Download className="w-2.5 h-2.5" /> {s.downloads}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground/40 shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border/40">
                    <div className="pt-3 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">Email</p>
                        <p className="text-xs text-foreground/80 font-mono mt-0.5">{p.recipientEmail}</p>
                      </div>
                      <div>
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">Type</p>
                        <p className="text-xs text-foreground/80 mt-0.5 capitalize">{p.type}</p>
                      </div>
                    </div>
                    {p.notes && (
                      <div>
                        <p className="text-2xs text-muted-foreground/50 uppercase tracking-widest font-semibold">Notes</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.notes}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
