import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEngagement } from "@/contexts/EngagementContext";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { Link, useNavigate } from "react-router-dom";
import {
  Music,
  ListMusic,
  Users,
  Send,
  Clock,
  Upload,
  ArrowUpRight,
  MessageSquare,
  Star,
  TrendingUp,
  Headphones,
  Download,
  X,
  Search,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useRole } from "@/contexts/RoleContext";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5];


const activity = [
  { icon: Star, textKey: "Kira Nomura starred \"Velvet Hour\" master", time: "12m ago" },
  { icon: MessageSquare, textKey: "Dex left feedback on \"Ghost Protocol\" mix", time: "1h ago" },
  { icon: Upload, textKey: "You uploaded 3 stems to \"Burning Chrome\"", time: "3h ago" },
  { icon: Send, textKey: "\"Soft Landing\" pitched to Atlantic Records — A&R", time: "6h ago" },
  { icon: TrendingUp, textKey: "\"Paper Moons\" reached 10K pre-saves", time: "1d ago" },
];

const statusColors: Record<string, string> = {
  Available: "bg-emerald-500/12 text-emerald-400",
  "On Hold": "bg-brand-orange/12 text-brand-orange",
  Released: "bg-primary/12 text-primary",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export function DashboardContent() {
  const [showTracksPanel, setShowTracksPanel] = useState(false);
  const [tracksRange, setTracksRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1w");
  const [tracksSearch, setTracksSearch] = useState("");
  const [showPlaylistsPanel, setShowPlaylistsPanel] = useState(false);
  const [playlistsRange, setPlaylistsRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1w");
  const [playlistsSearch, setPlaylistsSearch] = useState("");
  const [showPlaysPanel, setShowPlaysPanel] = useState(false);
  const [playsRange, setPlaysRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1w");
  const [playsSearch, setPlaysSearch] = useState("");
  const [showDownloadsPanel, setShowDownloadsPanel] = useState(false);
  const [downloadsRange, setDownloadsRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1w");
  const [downloadsSearch, setDownloadsSearch] = useState("");
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { permissions } = useRole();
  const { getTotalStats } = useEngagement();
  const { tracks: allTracks } = useTrack();
  const { playlists: allPlaylists } = usePlaylists();
  const navigate = useNavigate();
  const engagementStats = getTotalStats();

  // Simulated upload dates for demo tracks (spread across recent dates)
  const trackUploadDates = useMemo(() => {
    const now = new Date();
    return allTracks.map((track, i) => {
      const d = new Date(now);
      // Spread tracks across different time periods for demo
      if (i < 2) d.setHours(d.getHours() - (i + 1) * 4); // today
      else if (i < 5) d.setDate(d.getDate() - (i - 1)); // this week
      else if (i < 9) d.setDate(d.getDate() - (i * 3)); // this month
      else d.setMonth(d.getMonth() - (i - 7)); // older
      return { ...track, uploadedAt: d };
    });
  }, [allTracks]);

  const filteredByRange = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (tracksRange === "all") cutoff.setTime(0);
    else if (tracksRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (tracksRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (tracksRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return trackUploadDates.filter((t) => {
      if (t.uploadedAt < cutoff) return false;
      if (tracksSearch) {
        const q = tracksSearch.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.artist.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [trackUploadDates, tracksRange, tracksSearch]);

  // Simulated creation dates for demo playlists
  const playlistDates = useMemo(() => {
    const now = new Date();
    return allPlaylists.map((pl, i) => {
      const d = new Date(now);
      if (i < 1) d.setHours(d.getHours() - 6);
      else if (i < 3) d.setDate(d.getDate() - (i + 1));
      else if (i < 6) d.setDate(d.getDate() - (i * 4));
      else d.setMonth(d.getMonth() - (i - 4));
      return { ...pl, createdAt: d };
    });
  }, [allPlaylists]);

  const filteredPlaylists = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (playlistsRange === "all") cutoff.setTime(0);
    else if (playlistsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (playlistsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (playlistsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return playlistDates.filter((pl) => {
      if (pl.createdAt < cutoff) return false;
      if (playlistsSearch) {
        const q = playlistsSearch.toLowerCase();
        if (!pl.name.toLowerCase().includes(q) && !(pl.description || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [playlistDates, playlistsRange, playlistsSearch]);

  const stats = [
    { id: "tracks", label: t("dashboard.totalTracks"), value: allTracks.length.toLocaleString(), icon: Music, change: t("dashboard.thisWeek"), accent: "from-brand-orange to-brand-pink", iconBg: "bg-brand-orange/10", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.06)", borderAccent: "hover:border-brand-orange/20", clickable: true },
    { id: "playlists", label: t("dashboard.playlists"), value: allPlaylists.length.toLocaleString(), icon: ListMusic, change: t("dashboard.new"), accent: "from-brand-pink to-brand-purple", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20", clickable: true },
    { id: "plays", label: "Total Plays", value: engagementStats.totalPlays.toLocaleString(), icon: Headphones, change: `${engagementStats.uniqueRecipients} recipients`, accent: "from-brand-pink to-brand-orange", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20" },
    { id: "downloads", label: "Downloads", value: engagementStats.totalDownloads.toLocaleString(), icon: Download, change: `across ${engagementStats.uniqueRecipients} contacts`, accent: "from-brand-purple to-brand-pink", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20" },
    { id: "collabs", label: t("dashboard.collaborators"), value: "126", icon: Users, change: t("dashboard.active"), accent: "from-brand-purple to-brand-orange", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20" },
    { id: "pitches", label: t("dashboard.pendingPitches"), value: "9", icon: Send, change: t("dashboard.dueToday"), accent: "from-brand-orange to-brand-purple", iconBg: "bg-brand-orange/8", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.04)", borderAccent: "hover:border-brand-orange/20" },
  ];

  const quickActions = [
    { label: t("dashboard.uploadTrack"), icon: Upload, primary: true, visible: permissions.canUploadTracks },
    { label: t("dashboard.newPlaylist"), icon: ListMusic, visible: permissions.canCreatePlaylists },
    { label: t("dashboard.inviteMember"), icon: Users, visible: permissions.canInviteMembers },
    { label: t("dashboard.newPitch"), icon: Send, visible: permissions.canSendPitches },
  ].filter((a) => a.visible);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1400px]">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t("dashboard.subtitle")}</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            onClick={stat.clickable ? () => {
              if (stat.id === "tracks") { setShowTracksPanel(!showTracksPanel); setShowPlaylistsPanel(false); }
              else if (stat.id === "playlists") { setShowPlaylistsPanel(!showPlaylistsPanel); setShowTracksPanel(false); }
            } : undefined}
            className={`card-premium p-4 sm:p-5 group relative overflow-hidden ${stat.clickable ? "cursor-pointer" : "cursor-default"} ${stat.borderAccent} ${stat.clickable && ((stat.id === "tracks" && showTracksPanel) || (stat.id === "playlists" && showPlaylistsPanel)) ? `border-brand-orange/40 ring-1 ring-brand-orange/20` : ""}`}
          >
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${stat.glowColor}, transparent 70%)` }}
            />
            <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${stat.accent} opacity-[0.15] group-hover:opacity-30 transition-opacity duration-500`} />

            <div className="flex items-center justify-between mb-2 sm:mb-3 relative">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${stat.iconBg} flex items-center justify-center transition-all duration-300`} style={{ boxShadow: `0 0 20px ${stat.glowColor}` }}>
                <stat.icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${stat.iconColor} transition-colors duration-300`} />
              </div>
              <ArrowUpRight className={`w-3.5 h-3.5 text-muted-foreground/20 group-hover:${stat.iconColor} transition-colors duration-300 opacity-0 group-hover:opacity-50 hidden sm:block`} />
            </div>
            <p className="text-xl sm:text-[28px] font-bold text-foreground tracking-tight leading-none relative">{stat.value}</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-1.5 sm:mt-2 relative gap-0.5">
              <p className="text-2xs sm:text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-2xs sm:text-xs text-emerald-400/80 font-medium">{stat.change}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Total Tracks Panel ─── */}
      <AnimatePresence>
        {showTracksPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="card-premium rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-brand-orange" />
                    <h3 className="text-sm font-bold text-foreground">
                      Catalog Tracks
                      <span className="ml-2 text-muted-foreground font-normal">· {allTracks.length} total</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                      {(["1d", "1w", "1m", "1y", "all"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setTracksRange(range)}
                          className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                            tracksRange === range
                              ? "bg-brand-orange/15 text-brand-orange"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowTracksPanel(false)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={tracksSearch}
                    onChange={(e) => setTracksSearch(e.target.value)}
                    placeholder="Search by title or artist…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              {/* Subtitle */}
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {filteredByRange.length} track{filteredByRange.length !== 1 ? "s" : ""} uploaded in the last {tracksRange === "1d" ? "24 hours" : tracksRange === "1w" ? "week" : tracksRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {/* Track list */}
              {filteredByRange.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No tracks uploaded in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredByRange.map((track, idx) => (
                    <div
                      key={track.id}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                      onClick={() => navigate(`/track/${track.id}`)}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      <img
                        src={track.coverImage || covers[track.coverIdx % covers.length]}
                        alt={track.title}
                        className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-orange transition-colors">{track.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      <span className="text-2xs text-muted-foreground hidden sm:inline">{track.genre}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
                      <span className="text-2xs text-muted-foreground/50 font-mono hidden sm:inline">{track.duration}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Footer */}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredByRange.length} of {allTracks.length} total tracks
                </span>
                <Link to="/tracks" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                  View full catalog →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Playlists Panel ─── */}
      <AnimatePresence>
        {showPlaylistsPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="card-premium rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-brand-pink" />
                    <h3 className="text-sm font-bold text-foreground">
                      Playlists
                      <span className="ml-2 text-muted-foreground font-normal">· {allPlaylists.length} total</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                      {(["1d", "1w", "1m", "1y", "all"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setPlaylistsRange(range)}
                          className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                            playlistsRange === range
                              ? "bg-brand-pink/15 text-brand-pink"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowPlaylistsPanel(false)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={playlistsSearch}
                    onChange={(e) => setPlaylistsSearch(e.target.value)}
                    placeholder="Search by name or description…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              {/* Subtitle */}
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {filteredPlaylists.length} playlist{filteredPlaylists.length !== 1 ? "s" : ""} created in the last {playlistsRange === "all" ? "all time" : playlistsRange === "1d" ? "24 hours" : playlistsRange === "1w" ? "week" : playlistsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {/* Playlist list */}
              {filteredPlaylists.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No playlists created in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredPlaylists.map((pl, idx) => (
                    <div
                      key={pl.id}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                      onClick={() => navigate(`/playlists/${pl.id}`)}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      {pl.coverImage ? (
                        <img src={pl.coverImage} alt={pl.name} className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 ring-1 ring-border/50">
                          <ListMusic className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-pink transition-colors">{pl.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{pl.description || "No description"}</p>
                      </div>
                      <span className="text-2xs text-muted-foreground hidden sm:inline">{pl.genre || "—"}</span>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-pink/12 text-brand-pink">
                        {pl.tracks} tracks
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Footer */}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredPlaylists.length} of {allPlaylists.length} total playlists
                </span>
                <Link to="/playlists" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                  View all playlists →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        {/* Right column */}
        <div className="space-y-5 sm:space-y-6">
          {/* Quick actions */}
          <motion.div variants={item} className="space-y-3 sm:space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">{t("dashboard.quickActions")}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-[13px] group min-h-[72px] ${
                    action.primary
                      ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange hover:bg-brand-orange/12 hover:border-brand-orange/40 gradient-border"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-pink/20 hover:bg-secondary/40"
                  }`}
                  style={{ boxShadow: "var(--shadow-inner-glow)" }}
                >
                  <action.icon className="w-[18px] h-[18px] transition-colors" />
                  <span className="text-[11px] font-semibold tracking-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Activity */}
          <motion.div variants={item} className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">{t("dashboard.activity")}</h2>
              <button className="text-xs gradient-text hover:opacity-80 transition-opacity font-semibold">{t("dashboard.seeAll")}</button>
            </div>
            <div className="card-premium divide-y divide-border/60 overflow-hidden">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground/85 leading-relaxed">{a.textKey}</p>
                    <p className="text-2xs text-muted-foreground mt-1 font-medium">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
