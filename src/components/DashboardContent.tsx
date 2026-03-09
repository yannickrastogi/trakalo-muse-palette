import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadTrackModal } from "@/components/UploadTrackModal";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import { CreatePitchModal } from "@/components/CreatePitchModal";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { useEngagement } from "@/contexts/EngagementContext";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { useTeams } from "@/contexts/TeamContext";
import { Link, useNavigate } from "react-router-dom";
import { useContacts } from "@/contexts/ContactsContext";
import { usePitches } from "@/contexts/PitchContext";
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
  Mail,
  Building2,
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
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [contactsRange, setContactsRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1w");
  const [contactsSearch, setContactsSearch] = useState("");
  const [showPitchesPanel, setShowPitchesPanel] = useState(false);
  const [pitchesSearch, setPitchesSearch] = useState("");
  const [pitchesStatusFilter, setPitchesStatusFilter] = useState<string>("all");
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { permissions } = useRole();
  const { getTotalStats, trackEngagement } = useEngagement();
  const { tracks: allTracks } = useTrack();
  const { playlists: allPlaylists, addPlaylist } = usePlaylists();
  const { contacts: allContacts } = useContacts();
  const { pitches: allPitches, addPitch } = usePitches();
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

  // Build per-recipient engagement data with simulated dates for plays/downloads
  const engagementEntries = useMemo(() => {
    const entries: { trackId: number; trackTitle: string; trackArtist: string; recipientName: string; recipientCompany: string; plays: number; downloads: number; lastActivity: Date; coverIdx: number }[] = [];
    trackEngagement.forEach((te) => {
      const track = allTracks.find((t) => t.id === te.trackId);
      te.recipients.forEach((r) => {
        entries.push({
          trackId: te.trackId,
          trackTitle: track?.title || `Track ${te.trackId}`,
          trackArtist: track?.artist || "Unknown",
          recipientName: r.recipientName,
          recipientCompany: r.recipientCompany,
          plays: r.plays,
          downloads: r.downloads,
          lastActivity: new Date(r.lastActivity),
          coverIdx: (te.trackId - 1) % 5,
        });
      });
    });
    return entries;
  }, [trackEngagement, allTracks]);

  const filteredPlays = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (playsRange === "all") cutoff.setTime(0);
    else if (playsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (playsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (playsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return engagementEntries
      .filter((e) => e.plays > 0 && e.lastActivity >= cutoff)
      .filter((e) => {
        if (!playsSearch) return true;
        const q = playsSearch.toLowerCase();
        return e.trackTitle.toLowerCase().includes(q) || e.trackArtist.toLowerCase().includes(q) || e.recipientName.toLowerCase().includes(q) || e.recipientCompany.toLowerCase().includes(q);
      })
      .sort((a, b) => b.plays - a.plays);
  }, [engagementEntries, playsRange, playsSearch]);

  const filteredDownloads = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (downloadsRange === "all") cutoff.setTime(0);
    else if (downloadsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (downloadsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (downloadsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return engagementEntries
      .filter((e) => e.downloads > 0 && e.lastActivity >= cutoff)
      .filter((e) => {
        if (!downloadsSearch) return true;
        const q = downloadsSearch.toLowerCase();
        return e.trackTitle.toLowerCase().includes(q) || e.trackArtist.toLowerCase().includes(q) || e.recipientName.toLowerCase().includes(q) || e.recipientCompany.toLowerCase().includes(q);
      })
      .sort((a, b) => b.downloads - a.downloads);
  }, [engagementEntries, downloadsRange, downloadsSearch]);

  const totalFilteredPlays = filteredPlays.reduce((sum, e) => sum + e.plays, 0);
  const totalFilteredDownloads = filteredDownloads.reduce((sum, e) => sum + e.downloads, 0);

  // Build contacts list directly from context (single source of truth)
  const contactEntries = useMemo(() => {
    return allContacts.map((c) => ({
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      company: c.organization,
      role: c.role,
      addedAt: new Date(c.firstInteraction),
    }));
  }, [allContacts]);

  const filteredContacts = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (contactsRange === "all") cutoff.setTime(0);
    else if (contactsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (contactsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (contactsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return contactEntries
      .filter((c) => c.addedAt >= cutoff)
      .filter((c) => {
        if (!contactsSearch) return true;
        const q = contactsSearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.role.toLowerCase().includes(q);
      })
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  }, [contactEntries, contactsRange, contactsSearch]);

  const stats = [
    { id: "tracks", label: t("dashboard.totalTracks"), value: allTracks.length.toLocaleString(), icon: Music, change: t("dashboard.thisWeek"), accent: "from-brand-orange to-brand-pink", iconBg: "bg-brand-orange/10", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.06)", borderAccent: "hover:border-brand-orange/20", clickable: true },
    { id: "playlists", label: t("dashboard.playlists"), value: allPlaylists.length.toLocaleString(), icon: ListMusic, change: t("dashboard.new"), accent: "from-brand-pink to-brand-purple", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20", clickable: true },
    { id: "plays", label: "Total Plays", value: engagementStats.totalPlays.toLocaleString(), icon: Headphones, change: `${engagementStats.uniqueRecipients} recipients`, accent: "from-brand-pink to-brand-orange", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20", clickable: true },
    { id: "downloads", label: "Downloads", value: engagementStats.totalDownloads.toLocaleString(), icon: Download, change: `across ${engagementStats.uniqueRecipients} contacts`, accent: "from-brand-purple to-brand-pink", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20", clickable: true },
    { id: "contacts", label: t("nav.contacts"), value: contactEntries.length.toLocaleString(), icon: Users, change: `+${filteredContacts.length} recent`, accent: "from-brand-purple to-brand-orange", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20", clickable: true },
    { id: "pitches", label: t("pitch.title"), value: allPitches.length.toLocaleString(), icon: Send, change: `${allPitches.filter(p => p.status === "Sent" || p.status === "Opened").length} active`, accent: "from-brand-orange to-brand-purple", iconBg: "bg-brand-orange/8", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.04)", borderAccent: "hover:border-brand-orange/20", clickable: true },
  ];

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const { createTeam } = useTeams();

  const quickActions = [
    { label: t("dashboard.uploadTrack"), icon: Upload, primary: true, visible: permissions.canUploadTracks, onClick: () => setShowUploadModal(true) },
    { label: t("dashboard.newPlaylist"), icon: ListMusic, visible: permissions.canCreatePlaylists, onClick: () => setShowPlaylistModal(true) },
    { label: t("dashboard.inviteMember"), icon: Users, visible: permissions.canInviteMembers, onClick: () => setShowInviteModal(true) },
    { label: "Create Team", icon: Users, visible: permissions.canInviteMembers, onClick: () => setShowCreateTeamModal(true) },
    { label: t("dashboard.newPitch"), icon: Send, visible: permissions.canSendPitches, onClick: () => setShowPitchModal(true) },
  ].filter((a) => a.visible);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1400px]">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t("dashboard.subtitle")}</p>
      </motion.div>

      {/* Stats — 3×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            onClick={stat.clickable ? () => {
              const closeAll = () => { setShowTracksPanel(false); setShowPlaylistsPanel(false); setShowPlaysPanel(false); setShowDownloadsPanel(false); setShowContactsPanel(false); setShowPitchesPanel(false); };
              if (stat.id === "tracks") { const next = !showTracksPanel; closeAll(); setShowTracksPanel(next); }
              else if (stat.id === "playlists") { const next = !showPlaylistsPanel; closeAll(); setShowPlaylistsPanel(next); }
              else if (stat.id === "plays") { const next = !showPlaysPanel; closeAll(); setShowPlaysPanel(next); }
              else if (stat.id === "downloads") { const next = !showDownloadsPanel; closeAll(); setShowDownloadsPanel(next); }
              else if (stat.id === "contacts") { const next = !showContactsPanel; closeAll(); setShowContactsPanel(next); }
              else if (stat.id === "pitches") { const next = !showPitchesPanel; closeAll(); setShowPitchesPanel(next); }
            } : undefined}
            className={`card-premium p-5 sm:p-7 group relative overflow-hidden ${stat.clickable ? "cursor-pointer" : "cursor-default"} ${stat.borderAccent} ${stat.clickable && ((stat.id === "tracks" && showTracksPanel) || (stat.id === "playlists" && showPlaylistsPanel) || (stat.id === "plays" && showPlaysPanel) || (stat.id === "downloads" && showDownloadsPanel) || (stat.id === "contacts" && showContactsPanel) || (stat.id === "pitches" && showPitchesPanel)) ? `border-brand-orange/40 ring-1 ring-brand-orange/20` : ""}`}
          >
            <div
              className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-50 group-hover:opacity-90 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${stat.glowColor}, transparent 70%)` }}
            />
            <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${stat.accent} opacity-[0.15] group-hover:opacity-30 transition-opacity duration-500`} />

            <div className="flex items-center justify-between mb-4 relative">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${stat.iconBg} flex items-center justify-center transition-all duration-300`} style={{ boxShadow: `0 0 24px ${stat.glowColor}` }}>
                <stat.icon className={`w-5 h-5 sm:w-[22px] sm:h-[22px] ${stat.iconColor} transition-colors duration-300`} />
              </div>
              <ArrowUpRight className={`w-4 h-4 text-muted-foreground/20 group-hover:${stat.iconColor} transition-colors duration-300 opacity-0 group-hover:opacity-50`} />
            </div>
            <p className="text-2xl sm:text-[34px] font-bold text-foreground tracking-tight leading-none relative">{stat.value}</p>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 relative">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-xs sm:text-sm text-emerald-400/80 font-medium">{stat.change}</p>
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

      {/* ─── Total Plays Panel ─── */}
      <AnimatePresence>
        {showPlaysPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="card-premium rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-brand-pink" />
                    <h3 className="text-sm font-bold text-foreground">
                      Total Plays
                      <span className="ml-2 text-muted-foreground font-normal">· {engagementStats.totalPlays} total</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                      {(["1d", "1w", "1m", "1y", "all"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setPlaysRange(range)}
                          className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                            playsRange === range
                              ? "bg-brand-pink/15 text-brand-pink"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowPlaysPanel(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={playsSearch}
                    onChange={(e) => setPlaysSearch(e.target.value)}
                    placeholder="Search by track, artist, or recipient…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {totalFilteredPlays} play{totalFilteredPlays !== 1 ? "s" : ""} across {filteredPlays.length} recipient{filteredPlays.length !== 1 ? "s" : ""} in the last {playsRange === "all" ? "all time" : playsRange === "1d" ? "24 hours" : playsRange === "1w" ? "week" : playsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {filteredPlays.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No plays recorded in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredPlays.map((entry, idx) => (
                    <div
                      key={`${entry.trackId}-${entry.recipientName}-${idx}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                      onClick={() => navigate(`/track/${entry.trackId}`)}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      <img src={covers[entry.coverIdx]} alt={entry.trackTitle} className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-pink transition-colors">{entry.trackTitle}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{entry.trackArtist}</p>
                      </div>
                      <div className="hidden sm:block text-right min-w-[80px]">
                        <p className="text-[11px] text-foreground/70 truncate">{entry.recipientName}</p>
                        <p className="text-2xs text-muted-foreground truncate">{entry.recipientCompany}</p>
                      </div>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-pink/12 text-brand-pink">
                        {entry.plays} plays
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredPlays.length} entries · {totalFilteredPlays} total plays
                </span>
                <Link to="/tracks" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                  View catalog →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Total Downloads Panel ─── */}
      <AnimatePresence>
        {showDownloadsPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="card-premium rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-brand-purple" />
                    <h3 className="text-sm font-bold text-foreground">
                      Downloads
                      <span className="ml-2 text-muted-foreground font-normal">· {engagementStats.totalDownloads} total</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                      {(["1d", "1w", "1m", "1y", "all"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setDownloadsRange(range)}
                          className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                            downloadsRange === range
                              ? "bg-brand-purple/15 text-brand-purple"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowDownloadsPanel(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={downloadsSearch}
                    onChange={(e) => setDownloadsSearch(e.target.value)}
                    placeholder="Search by track, artist, or recipient…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {totalFilteredDownloads} download{totalFilteredDownloads !== 1 ? "s" : ""} across {filteredDownloads.length} recipient{filteredDownloads.length !== 1 ? "s" : ""} in the last {downloadsRange === "all" ? "all time" : downloadsRange === "1d" ? "24 hours" : downloadsRange === "1w" ? "week" : downloadsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {filteredDownloads.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No downloads recorded in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredDownloads.map((entry, idx) => (
                    <div
                      key={`${entry.trackId}-${entry.recipientName}-${idx}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                      onClick={() => navigate(`/track/${entry.trackId}`)}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      <img src={covers[entry.coverIdx]} alt={entry.trackTitle} className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-purple transition-colors">{entry.trackTitle}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{entry.trackArtist}</p>
                      </div>
                      <div className="hidden sm:block text-right min-w-[80px]">
                        <p className="text-[11px] text-foreground/70 truncate">{entry.recipientName}</p>
                        <p className="text-2xs text-muted-foreground truncate">{entry.recipientCompany}</p>
                      </div>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-purple/12 text-brand-purple">
                        {entry.downloads} dl
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredDownloads.length} entries · {totalFilteredDownloads} total downloads
                </span>
                <Link to="/tracks" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                  View catalog →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Contacts Panel ─── */}
      <AnimatePresence>
        {showContactsPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="card-premium rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-purple" />
                    <h3 className="text-sm font-bold text-foreground">
                      Contacts
                      <span className="ml-2 text-muted-foreground font-normal">· {contactEntries.length} total</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                      {(["1d", "1w", "1m", "1y", "all"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setContactsRange(range)}
                          className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                            contactsRange === range
                              ? "bg-brand-purple/15 text-brand-purple"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowContactsPanel(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={contactsSearch}
                    onChange={(e) => setContactsSearch(e.target.value)}
                    placeholder="Search by name, email, company, or role…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""} collected in the last {contactsRange === "all" ? "all time" : contactsRange === "1d" ? "24 hours" : contactsRange === "1w" ? "week" : contactsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {filteredContacts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No contacts collected in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredContacts.map((contact, idx) => (
                    <div
                      key={contact.email}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                      onClick={() => navigate("/contacts")}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      <div className="w-9 h-9 rounded-full bg-brand-purple/10 flex items-center justify-center shrink-0 ring-1 ring-border/50">
                        <span className="text-xs font-bold text-brand-purple">
                          {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-purple transition-colors">{contact.name}</p>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                          <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 min-w-[100px]">
                        <Building2 className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] text-foreground/70 truncate">{contact.company}</span>
                      </div>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-purple/12 text-brand-purple">
                        {contact.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredContacts.length} of {contactEntries.length} total contacts
                </span>
                <Link to="/contacts" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                  View all contacts →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Pitches Panel ─── */}
      <AnimatePresence>
        {showPitchesPanel && (() => {
          const pitchStatuses = ["all", "Draft", "Sent", "Opened", "Responded"] as const;
          const filteredPitches = allPitches.filter((p) => {
            if (pitchesStatusFilter !== "all" && p.status !== pitchesStatusFilter) return false;
            if (pitchesSearch) {
              const q = pitchesSearch.toLowerCase();
              return p.itemName.toLowerCase().includes(q) || p.recipientName.toLowerCase().includes(q) || p.recipientCompany.toLowerCase().includes(q) || (p.recipientEmail || "").toLowerCase().includes(q);
            }
            return true;
          });
          const pitchStatusColors: Record<string, string> = {
            Draft: "bg-muted text-muted-foreground",
            Sent: "bg-blue-500/12 text-blue-400",
            Opened: "bg-brand-orange/12 text-brand-orange",
            Responded: "bg-emerald-500/12 text-emerald-400",
          };
          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="card-premium rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-brand-orange" />
                      <h3 className="text-sm font-bold text-foreground">
                        Pitches
                        <span className="ml-2 text-muted-foreground font-normal">· {allPitches.length} total</span>
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                        {pitchStatuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => setPitchesStatusFilter(s)}
                            className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-all ${
                              pitchesStatusFilter === s
                                ? "bg-brand-orange/15 text-brand-orange"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {s === "all" ? "ALL" : s.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setShowPitchesPanel(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={pitchesSearch}
                      onChange={(e) => setPitchesSearch(e.target.value)}
                      placeholder="Search by track, recipient, or company…"
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                  <p className="text-2xs text-muted-foreground font-medium">
                    {filteredPitches.length} pitch{filteredPitches.length !== 1 ? "es" : ""}{pitchesStatusFilter !== "all" ? ` with status "${pitchesStatusFilter}"` : ""}
                  </p>
                </div>
                {filteredPitches.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">No pitches found</div>
                ) : (
                  <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                    {filteredPitches.map((pitch) => (
                      <div
                        key={pitch.id}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                        onClick={() => navigate("/pitch")}
                      >
                        <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0 ring-1 ring-border/50">
                          <Send className="w-3.5 h-3.5 text-brand-orange" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-orange transition-colors">
                            {pitch.itemName}
                            <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">by {pitch.artist}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            → {pitch.recipientName} · {pitch.recipientCompany}
                          </p>
                        </div>
                        <div className="hidden sm:block text-right min-w-[70px]">
                          <p className="text-2xs text-muted-foreground">{pitch.date}</p>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${pitchStatusColors[pitch.status] || "bg-muted text-muted-foreground"}`}>
                          {pitch.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-2xs text-muted-foreground">
                    Showing {filteredPitches.length} of {allPitches.length} total pitches
                  </span>
                  <Link to="/pitch" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                    View all pitches →
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Quick actions */}
        <motion.div variants={item} className="space-y-3 sm:space-y-4">
          <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">{t("dashboard.quickActions")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
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
            <button onClick={() => navigate("/notifications")} className="text-xs gradient-text hover:opacity-80 transition-opacity font-semibold">{t("dashboard.seeAll")}</button>
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

      {/* Modals */}
      <UploadTrackModal open={showUploadModal} onOpenChange={setShowUploadModal} />
      <CreatePlaylistModal open={showPlaylistModal} onOpenChange={setShowPlaylistModal} onCreate={(data) => { addPlaylist(data); setShowPlaylistModal(false); }} />
      <InviteMemberModal open={showInviteModal} onOpenChange={setShowInviteModal} onInvite={() => setShowInviteModal(false)} />
      <CreatePitchModal open={showPitchModal} onOpenChange={setShowPitchModal} onCreate={(pitch) => { addPitch(pitch); setShowPitchModal(false); }} />
      <CreateTeamModal open={showCreateTeamModal} onOpenChange={setShowCreateTeamModal} onCreate={(name) => { createTeam(name); setShowCreateTeamModal(false); }} />
    </motion.div>
  );
}
