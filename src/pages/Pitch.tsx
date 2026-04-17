import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
  Pause,
  Download,
  Users,
  Loader2,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreatePitchModal, type PitchEntry } from "@/components/CreatePitchModal";
import { useRole } from "@/contexts/RoleContext";
import { usePitches } from "@/contexts/PitchContext";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack } from "@/contexts/TrackContext";
import { useTeams } from "@/contexts/TeamContext";

import { DEFAULT_COVER } from "@/lib/constants";

type PitchStatus = "Draft" | "Sent" | "Opened" | "Responded";

const statusConfig: Record<PitchStatus, { color: string; icon: React.ElementType; dot: string }> = {
  Draft: { color: "bg-muted/60 text-muted-foreground", icon: FileText, dot: "bg-muted-foreground" },
  Sent: { color: "bg-primary/12 text-primary", icon: Send, dot: "bg-primary" },
  Opened: { color: "bg-brand-purple/12 text-brand-purple", icon: Eye, dot: "bg-brand-purple" },
  Responded: { color: "bg-emerald-500/12 text-emerald-400", icon: MessageSquare, dot: "bg-emerald-400" },
};

const statCardIcons = [Send, FileText, Eye, MessageSquare];

const allStatuses: PitchStatus[] = ["Draft", "Sent", "Opened", "Responded"];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

function getCoverForPitch(p: PitchEntry, tracks: { id: string; coverImage?: string }[]): string {
  if (p.trackUuid) {
    var match = tracks.find(function (t) { return t.id === p.trackUuid; });
    if (match && match.coverImage) return match.coverImage;
  }
  return DEFAULT_COVER;
}

export default function Pitch() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { permissions } = useRole();
  const { pitches, addPitch } = usePitches();
  const { activeWorkspace } = useWorkspace();
  const { tracks } = useTrack();
  const { teams } = useTeams();
  const isMultiMember = (teams?.length > 0 && teams[0]?.members?.length > 1) || false;
  const [senderProfiles, setSenderProfiles] = useState<Record<string, string>>({});
  const [pitchSentBy, setPitchSentBy] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PitchStatus | "active" | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pitchStats, setPitchStats] = useState<Record<string, { views: number; plays: number; downloads: number }>>({});
  const [linkMeta, setLinkMeta] = useState<Record<string, { trackId: string | null; playlistId: string | null }>>({});

  // Audio player state (same pattern as SmartAR)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  useEffect(function () {
    return function () {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // Fetch sent_by for pitches and resolve profile names
  useEffect(function () {
    if (!isMultiMember || !activeWorkspace) return;
    async function fetchSentBy() {
      var { data } = await supabase
        .from("pitches")
        .select("id, sent_by")
        .eq("workspace_id", activeWorkspace!.id);
      if (!data || data.length === 0) return;
      var byPitch: Record<string, string | null> = {};
      var userIds: string[] = [];
      data.forEach(function (row) {
        byPitch[row.id] = row.sent_by || null;
        if (row.sent_by && !userIds.includes(row.sent_by)) userIds.push(row.sent_by);
      });
      setPitchSentBy(byPitch);
      if (userIds.length === 0) return;
      var { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (!profiles) return;
      var map: Record<string, string> = {};
      profiles.forEach(function (p) {
        if (p.full_name) map[p.id] = p.full_name;
      });
      setSenderProfiles(map);
    }
    fetchSentBy();
  }, [isMultiMember, activeWorkspace, pitches]);

  var handlePlayTrack = useCallback(function (trackId: string) {
    if (playingTrackId === trackId) {
      if (audioRef.current) { audioRef.current.pause(); }
      setPlayingTrackId(null);
      setAudioProgress(0);
      setAudioDuration(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingTrackId(null);
    setAudioProgress(0);
    setAudioDuration(0);
    setLoadingAudioId(trackId);

    fetch(SUPABASE_URL + "/functions/v1/get-audio-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ track_id: trackId, quality: "preview" }),
    })
      .then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok || json.error) throw new Error(json.error || "Failed to get audio URL");
          return json;
        });
      })
      .then(function (data) {
        if (!data.url) {
          setLoadingAudioId(null);
          toast.error("Could not load audio preview");
          return;
        }
        var audio = new Audio(data.url);
        audioRef.current = audio;
        audio.addEventListener("loadedmetadata", function () { setAudioDuration(audio.duration); });
        audio.addEventListener("timeupdate", function () { setAudioProgress(audio.currentTime); });
        audio.addEventListener("ended", function () { setPlayingTrackId(null); setAudioProgress(0); setAudioDuration(0); });
        audio.addEventListener("error", function () {
          if (audioRef.current !== audio) return;
          setPlayingTrackId(null); setLoadingAudioId(null); setAudioProgress(0);
          toast.error("Error playing audio");
        });
        audio.play().then(function () {
          if (audioRef.current !== audio) return;
          setPlayingTrackId(trackId); setLoadingAudioId(null);
        }).catch(function () {
          if (audioRef.current !== audio) return;
          setLoadingAudioId(null);
          toast.error("Could not play audio");
        });
      })
      .catch(function () {
        setLoadingAudioId(null);
        toast.error("Could not load audio preview");
      });
  }, [playingTrackId]);

  useEffect(function() {
    if (!activeWorkspace) return;

    async function fetchStats() {
      var { data: links } = await supabase
        .from("shared_links")
        .select("id, link_name, track_id, playlist_id")
        .eq("workspace_id", activeWorkspace!.id);

      if (!links || links.length === 0) return;

      // Build link_name → track_id/playlist_id map
      var metaByName: Record<string, { trackId: string | null; playlistId: string | null }> = {};
      links.forEach(function(l) {
        if (!metaByName[l.link_name]) {
          metaByName[l.link_name] = { trackId: l.track_id, playlistId: l.playlist_id };
        }
      });
      setLinkMeta(metaByName);

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
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {t("pitch.title")}
              </h1>
            </div>
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
            const CardIcon = statCardIcons[i];
            return (
              <motion.div
                key={s.label}
                variants={item}
                onClick={() => setStatusFilter(isActive ? null : s.filterKey)}
                className={"card-premium p-4 sm:p-5 relative overflow-hidden cursor-pointer transition-all duration-200 " + (
                  isActive
                    ? "ring-2 ring-brand-orange/40 bg-brand-orange/5"
                    : "hover:ring-1 hover:ring-border/60"
                )}
              >
                <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange/8 to-brand-pink/8 flex items-center justify-center pointer-events-none">
                  <CardIcon className="w-3.5 h-3.5 text-brand-orange/40" />
                </div>
                <p className="text-xl sm:text-[28px] font-bold text-foreground tracking-tight leading-none">
                  {s.value}
                </p>
                <p className="text-2xs sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 font-medium">
                  {s.label}
                </p>
                <p className={"text-2xs mt-0.5 sm:mt-1 font-semibold " + (s.accent ? "text-brand-orange/80" : "text-muted-foreground/50")}>
                  {s.sub}
                </p>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Filters & Search */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 max-w-md border border-border/50 focus-brand transition-all">
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
              className={"px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] border " + (
                !statusFilter
                  ? "bg-brand-orange/10 text-brand-orange border-brand-orange/25"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60"
              )}
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
                  className={"flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] border " + (
                    isActive
                      ? cfg.color + " border-current/25"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <span className={"w-1.5 h-1.5 rounded-full " + cfg.dot} />
                  {s}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Pitch List */}
        <motion.div variants={item}>
          {pitches.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No pitches sent yet"
              description="Start pitching your tracks to A&R, labels, and music supervisors. Trakalog tracks every interaction."
              actionLabel="Create Pitch"
              onAction={() => setCreateOpen(true)}
              note="Your contacts are built automatically when people listen to your shared links."
            />
          ) : filtered.length === 0 ? (
            <div className="card-premium py-20 text-center">
              <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-4">
                <Send className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t("pitch.noPitches")}</p>
              <p className="text-xs mt-1.5 text-muted-foreground/70 max-w-sm mx-auto">
                {t("pitch.adjustFilters")}
              </p>
            </div>
          ) : isMobile ? (
            <MobilePitchList
              pitches={filtered}
              tracks={tracks}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              pitchStats={pitchStats}
              linkMeta={linkMeta}
              playingTrackId={playingTrackId}
              loadingAudioId={loadingAudioId}
              audioProgress={audioProgress}
              audioDuration={audioDuration}
              onPlayTrack={handlePlayTrack}
              isMultiMember={isMultiMember}
              pitchSentBy={pitchSentBy}
              senderProfiles={senderProfiles}
            />
          ) : (
            <DesktopPitchTable
              pitches={filtered}
              tracks={tracks}
              expandedId={expandedId}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              pitchStats={pitchStats}
              linkMeta={linkMeta}
              playingTrackId={playingTrackId}
              loadingAudioId={loadingAudioId}
              audioProgress={audioProgress}
              audioDuration={audioDuration}
              onPlayTrack={handlePlayTrack}
              isMultiMember={isMultiMember}
              pitchSentBy={pitchSentBy}
              senderProfiles={senderProfiles}
            />
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
  tracks,
  expandedId,
  onToggle,
  pitchStats,
  linkMeta,
  playingTrackId,
  loadingAudioId,
  audioProgress,
  audioDuration,
  onPlayTrack,
  isMultiMember,
  pitchSentBy,
  senderProfiles,
}: {
  pitches: PitchEntry[];
  tracks: { id: string; coverImage?: string }[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  pitchStats: Record<string, { views: number; plays: number; downloads: number }>;
  linkMeta: Record<string, { trackId: string | null; playlistId: string | null }>;
  playingTrackId: string | null;
  loadingAudioId: string | null;
  audioProgress: number;
  audioDuration: number;
  onPlayTrack: (trackId: string) => void;
  isMultiMember: boolean;
  pitchSentBy: Record<string, string | null>;
  senderProfiles: Record<string, string>;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Track / Playlist</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Recipient</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Engagement</th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {pitches.map((p) => {
              const cfg = statusConfig[p.status as keyof typeof statusConfig];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === p.id;
              const meta = linkMeta[p.itemName];
              const trackId = p.trackUuid || (meta && meta.trackId) || null;
              const playlistId = p.playlistUuid || (meta && meta.playlistId) || null;
              const isPlaying = trackId ? playingTrackId === trackId : false;
              const isLoadingAudio = trackId ? loadingAudioId === trackId : false;
              const progressPct = isPlaying && audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0;
              const coverUrl = getCoverForPitch(p, tracks);
              return (
                <tr
                  key={p.id}
                  className={"border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors duration-300 cursor-pointer group/row" + (isExpanded ? " bg-secondary/20" : "")}
                  onClick={() => onToggle(p.id)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {/* Play button / cover */}
                      <button
                        className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/50 group/play"
                        onClick={function (e) {
                          if (!trackId) return;
                          e.stopPropagation();
                          onPlayTrack(trackId);
                        }}
                      >
                        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                        {trackId && (isPlaying || isLoadingAudio) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            {isLoadingAudio && !isPlaying ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <Pause className="w-4 h-4 text-white" />
                            )}
                          </div>
                        )}
                        {trackId && !isPlaying && !isLoadingAudio && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/play:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {isPlaying && audioDuration > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                            <div className="h-full bg-brand-orange transition-all" style={{ width: progressPct + "%" }} />
                          </div>
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {p.type === "playlist" ? (
                            <ListMusic className="w-3 h-3 text-accent/60 shrink-0" />
                          ) : (
                            <Music className="w-3 h-3 text-primary/50 shrink-0" />
                          )}
                          {p.type === "track" && trackId ? (
                            <Link
                              to={"/track/" + trackId}
                              onClick={function (e) { e.stopPropagation(); }}
                              className="font-semibold text-foreground truncate text-[13px] tracking-tight hover:text-brand-orange transition-colors"
                            >
                              {p.itemName}
                            </Link>
                          ) : p.type === "playlist" && playlistId ? (
                            <Link
                              to={"/playlist/" + playlistId}
                              onClick={function (e) { e.stopPropagation(); }}
                              className="font-semibold text-foreground truncate text-[13px] tracking-tight hover:text-brand-orange transition-colors"
                            >
                              {p.itemName}
                            </Link>
                          ) : (
                            <p className="font-semibold text-foreground truncate text-[13px] tracking-tight">{p.itemName}</p>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{p.artist}</p>
                        {isMultiMember && pitchSentBy[p.id] && senderProfiles[pitchSentBy[p.id]!] && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sent by {senderProfiles[pitchSentBy[p.id]!]}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Merged Recipient column */}
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-foreground text-[13px]">{p.recipientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.recipientCompany} · {p.recipientEmail}</p>
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
                    <span className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold " + cfg.color}>
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

      {/* Expanded detail panels */}
      <AnimatePresence>
        {pitches.map((p) => {
          if (expandedId !== p.id) return null;
          return (
            <motion.div
              key={"detail-" + p.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border/30 bg-secondary/10"
            >
              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Email</p>
                  <p className="text-xs text-foreground/80 font-mono mt-0.5">{p.recipientEmail}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Company</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{p.recipientCompany}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Type</p>
                  <p className="text-xs text-foreground/80 mt-0.5 capitalize">{p.type}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Date</p>
                  <p className="text-xs text-foreground/80 mt-0.5">{p.date}</p>
                </div>
                {p.notes && (
                  <div className="col-span-2 md:col-span-4">
                    <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-semibold">Notes</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

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
  tracks,
  expandedId,
  onToggle,
  pitchStats,
  linkMeta,
  playingTrackId,
  loadingAudioId,
  audioProgress,
  audioDuration,
  onPlayTrack,
  isMultiMember,
  pitchSentBy,
  senderProfiles,
}: {
  pitches: PitchEntry[];
  tracks: { id: string; coverImage?: string }[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  pitchStats: Record<string, { views: number; plays: number; downloads: number }>;
  linkMeta: Record<string, { trackId: string | null; playlistId: string | null }>;
  playingTrackId: string | null;
  loadingAudioId: string | null;
  audioProgress: number;
  audioDuration: number;
  onPlayTrack: (trackId: string) => void;
  isMultiMember: boolean;
  pitchSentBy: Record<string, string | null>;
  senderProfiles: Record<string, string>;
}) {
  return (
    <div className="space-y-2.5">
      {pitches.map((p) => {
        const cfg = statusConfig[p.status as keyof typeof statusConfig];
        const StatusIcon = cfg.icon;
        const isExpanded = expandedId === p.id;
        const meta = linkMeta[p.itemName];
        const trackId = p.trackUuid || (meta && meta.trackId) || null;
        const playlistId = p.playlistUuid || (meta && meta.playlistId) || null;
        const isPlaying = trackId ? playingTrackId === trackId : false;
        const isLoadingAudio = trackId ? loadingAudioId === trackId : false;
        const progressPct = isPlaying && audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0;
        const coverUrl = getCoverForPitch(p, tracks);
        return (
          <motion.div
            key={p.id}
            layout
            className="card-premium overflow-hidden"
            onClick={() => onToggle(p.id)}
          >
            <div className="p-4 flex items-start gap-3">
              {/* Play button / cover */}
              <button
                className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/50"
                onClick={function (e) {
                  if (!trackId) return;
                  e.stopPropagation();
                  onPlayTrack(trackId);
                }}
              >
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                {trackId && (isPlaying || isLoadingAudio) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    {isLoadingAudio && !isPlaying ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Pause className="w-4 h-4 text-white" />
                    )}
                  </div>
                )}
                {trackId && !isPlaying && !isLoadingAudio && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                )}
                {isPlaying && audioDuration > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
                    <div className="h-full bg-brand-orange transition-all" style={{ width: progressPct + "%" }} />
                  </div>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {p.type === "playlist" ? (
                    <ListMusic className="w-3 h-3 text-accent/60 shrink-0" />
                  ) : (
                    <Music className="w-3 h-3 text-primary/50 shrink-0" />
                  )}
                  {p.type === "track" && trackId ? (
                    <Link
                      to={"/track/" + trackId}
                      onClick={function (e) { e.stopPropagation(); }}
                      className="font-semibold text-foreground text-[13px] tracking-tight truncate hover:text-brand-orange transition-colors"
                    >
                      {p.itemName}
                    </Link>
                  ) : p.type === "playlist" && playlistId ? (
                    <Link
                      to={"/playlist/" + playlistId}
                      onClick={function (e) { e.stopPropagation(); }}
                      className="font-semibold text-foreground text-[13px] tracking-tight truncate hover:text-brand-orange transition-colors"
                    >
                      {p.itemName}
                    </Link>
                  ) : (
                    <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">{p.itemName}</p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  → {p.recipientName} · {p.recipientCompany}
                </p>
                {isMultiMember && pitchSentBy[p.id] && senderProfiles[pitchSentBy[p.id]!] && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Sent by {senderProfiles[pitchSentBy[p.id]!]}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-2xs text-muted-foreground/60">{p.date}</span>
                  <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold " + cfg.color}>
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
              <ChevronDown className={"w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform " + (isExpanded ? "rotate-180" : "")} />
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
