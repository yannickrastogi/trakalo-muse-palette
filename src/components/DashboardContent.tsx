import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
  Headphones,
  Download,
  X,
  Search,
  Mail,
  Building2,
  LayoutDashboard,
  Sparkles,
  Radio,
  FileSpreadsheet,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { useSharedLinks } from "@/contexts/SharedLinksContext";
import { EmptyState } from "@/components/EmptyState";
import { WelcomeOnboarding } from "@/components/onboarding/WelcomeOnboarding";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { useOnboarding } from "@/contexts/OnboardingContext";

import { DEFAULT_COVER } from "@/lib/constants";


function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  const weeks = Math.floor(days / 7);
  return weeks + "w ago";
}

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
  const { tracks: allTracks, refreshTracks } = useTrack();
  const { playlists: allPlaylists, addPlaylist } = usePlaylists();
  const { contacts: allContacts } = useContacts();
  const { pitches: allPitches, addPitch } = usePitches();
  const navigate = useNavigate();
  const { completeStep } = useOnboarding();
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const engagementStats = getTotalStats();

  var autoSaveAttemptedRef = useRef(false);

  // Auto-save track to trakalog if pending
  useEffect(function() {
    var pendingSave = localStorage.getItem("trakalog_auto_save");
    if (!pendingSave || !activeWorkspace || !user) return;
    if (autoSaveAttemptedRef.current) return;
    autoSaveAttemptedRef.current = true;

    var doSave = async function() {
      var parsed: { slug?: string; track_id?: string; source_workspace_id?: string } | null = null;
      try {
        parsed = JSON.parse(pendingSave!);
      } catch (e) {
        // Old format: just a slug string
      }

      var trackId = parsed?.track_id;
      var sourceWorkspaceId = parsed?.source_workspace_id;
      var slug = parsed?.slug || pendingSave;

      // Fallback: if no track_id/source_workspace_id, look up from shared_links
      if (!trackId || !sourceWorkspaceId) {
        var { data: linkRow } = await supabase
          .from("shared_links")
          .select("track_id, workspace_id")
          .eq("slug", slug!)
          .maybeSingle();
        if (!linkRow) {
          localStorage.removeItem("trakalog_auto_save");
          return;
        }
        trackId = linkRow.track_id;
        sourceWorkspaceId = linkRow.workspace_id;
      }

      var { error } = await supabase.rpc("save_track_to_trakalog", {
        _track_id: trackId,
        _source_workspace_id: sourceWorkspaceId,
        _target_workspace_id: activeWorkspace.id,
        _user_id: user.id,
      });

      localStorage.removeItem("trakalog_auto_save");
      if (!error) {
        localStorage.setItem("trakalog_first_save_done", "true");
        supabase.rpc("write_audit_log", { _user_id: user.id, _workspace_id: activeWorkspace.id, _action: "track.saved_from_share", _entity_type: "track", _entity_id: trackId }).then(() => {}).catch(() => {});
        toast.success("Track saved to your Trakalog!");
        refreshTracks();
      } else if (error.code === "23505" || error.code === "409" || (error.message && error.message.toLowerCase().includes("already"))) {
        toast.success("Track already in your Trakalog");
      }
    };

    doSave();
  }, [activeWorkspace, user]);

  // Fetch link_events from Supabase
  const [linkEvents, setLinkEvents] = useState<{ event_type: string; visitor_email: string | null; created_at: string; track_id: string | null }[]>([]);
  useEffect(function() {
    if (!activeWorkspace) return;
    // Get track IDs for this workspace to filter events
    const workspaceTrackIds = allTracks.map(function(t) { return t.uuid; }).filter(Boolean);
    if (workspaceTrackIds.length === 0) {
      setLinkEvents([]);
      return;
    }
    supabase
      .from("link_events")
      .select("event_type, visitor_email, created_at, track_id")
      .in("track_id", workspaceTrackIds)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(function(res) {
        if (res.data) setLinkEvents(res.data);
      }).catch(function(err) { console.error("Error fetching link events:", err); });
  }, [activeWorkspace, allTracks]);

  const linkPlays = linkEvents.filter(function(e) { return e.event_type === "play"; });
  const linkDownloads = linkEvents.filter(function(e) { return e.event_type === "download"; });
  const playRecipients = new Set(linkPlays.filter(function(e) { return e.visitor_email; }).map(function(e) { return e.visitor_email; })).size;
  const downloadRecipients = new Set(linkDownloads.filter(function(e) { return e.visitor_email; }).map(function(e) { return e.visitor_email; })).size;

  // Compute "this week" counts
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const tracksThisWeek = allTracks.filter(function(t) { return t.createdAt && new Date(t.createdAt) >= oneWeekAgo; }).length;
  const contactsThisWeek = allContacts.filter(function(c) { return c.firstInteraction && new Date(c.firstInteraction) >= oneWeekAgo; }).length;

  // Build real activity feed
  const activityFeed = useMemo(function() {
    type ActivityItem = { icon: typeof Music; text: string; time: string; sortDate: Date };
    const items: ActivityItem[] = [];

    // Recent link events (plays/downloads)
    linkEvents.slice(0, 20).forEach(function(ev) {
      const track = ev.track_id ? allTracks.find(function(t) { return t.uuid === ev.track_id; }) : null;
      const trackName = track ? '"' + track.title + '"' : "a track";
      const who = ev.visitor_email || "Someone";
      if (ev.event_type === "play") {
        items.push({ icon: Headphones, text: who + " played " + trackName, time: timeAgo(ev.created_at), sortDate: new Date(ev.created_at) });
      } else if (ev.event_type === "download") {
        items.push({ icon: Download, text: who + " downloaded " + trackName, time: timeAgo(ev.created_at), sortDate: new Date(ev.created_at) });
      }
    });

    // Recent tracks uploaded
    allTracks.filter(function(t) { return t.createdAt; }).slice(0, 5).forEach(function(t) {
      items.push({ icon: Upload, text: 'You uploaded "' + t.title + '"', time: timeAgo(t.createdAt!), sortDate: new Date(t.createdAt!) });
    });

    // Recent pitches
    allPitches.slice(0, 5).forEach(function(p) {
      items.push({ icon: Send, text: '"' + p.itemName + '" pitched to ' + p.recipientCompany + " — " + p.recipientName, time: timeAgo(p.date), sortDate: new Date(p.date) });
    });

    items.sort(function(a, b) { return b.sortDate.getTime() - a.sortDate.getTime(); });
    return items.slice(0, 10);
  }, [linkEvents, allTracks, allPitches]);

  // Use real created_at from tracks
  const trackUploadDates = useMemo(() => {
    return allTracks.map((track) => ({
      ...track,
      uploadedAt: track.createdAt ? new Date(track.createdAt) : new Date(0),
    }));
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

  // Use real updated date from playlists (updated field is relative, use as-is for display)
  const playlistDates = useMemo(() => {
    return allPlaylists.map((pl) => ({
      ...pl,
      createdAt: new Date(), // playlists don't expose created_at; use current for range filtering
    }));
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
    const entries: { trackId: number; trackUuid: string; trackTitle: string; trackArtist: string; recipientName: string; recipientCompany: string; plays: number; downloads: number; lastActivity: Date; coverIdx: number; coverImage?: string }[] = [];
    trackEngagement.forEach((te) => {
      const track = allTracks.find((t) => t.id === te.trackId);
      if (!track) return;
      te.recipients.forEach((r) => {
        entries.push({
          trackId: te.trackId,
          trackUuid: track.uuid,
          trackTitle: track.title || "Track " + te.trackId,
          trackArtist: track.artist || "Unknown",
          recipientName: r.recipientName,
          recipientCompany: r.recipientCompany,
          plays: r.plays,
          downloads: r.downloads,
          lastActivity: new Date(r.lastActivity),
          coverIdx: (te.trackId - 1) % 5,
          coverImage: track.coverImage,
        });
      });
    });
    return entries;
  }, [trackEngagement, allTracks]);

  // Build enriched play/download event lists from real link_events
  const enrichedPlays = useMemo(function () {
    return linkPlays.map(function (ev) {
      var track = ev.track_id ? allTracks.find(function (t) { return t.uuid === ev.track_id; }) : null;
      return {
        id: ev.created_at + (ev.visitor_email || "") + (ev.track_id || ""),
        trackTitle: track ? track.title : "Unknown track",
        trackArtist: track ? track.artist : "",
        trackUuid: track ? track.uuid : null,
        coverImage: track ? track.coverImage : undefined,
        visitorEmail: ev.visitor_email || "Anonymous",
        date: new Date(ev.created_at),
      };
    });
  }, [linkPlays, allTracks]);

  const enrichedDownloads = useMemo(function () {
    return linkDownloads.map(function (ev) {
      var track = ev.track_id ? allTracks.find(function (t) { return t.uuid === ev.track_id; }) : null;
      return {
        id: ev.created_at + (ev.visitor_email || "") + (ev.track_id || ""),
        trackTitle: track ? track.title : "Unknown track",
        trackArtist: track ? track.artist : "",
        trackUuid: track ? track.uuid : null,
        coverImage: track ? track.coverImage : undefined,
        visitorEmail: ev.visitor_email || "Anonymous",
        date: new Date(ev.created_at),
      };
    });
  }, [linkDownloads, allTracks]);

  const filteredPlays = useMemo(function () {
    var now = new Date();
    var cutoff = new Date(now);
    if (playsRange === "all") cutoff.setTime(0);
    else if (playsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (playsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (playsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return enrichedPlays
      .filter(function (e) { return e.date >= cutoff; })
      .filter(function (e) {
        if (!playsSearch) return true;
        var q = playsSearch.toLowerCase();
        return e.trackTitle.toLowerCase().includes(q) || e.trackArtist.toLowerCase().includes(q) || e.visitorEmail.toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [enrichedPlays, playsRange, playsSearch]);

  const filteredDownloads = useMemo(function () {
    var now = new Date();
    var cutoff = new Date(now);
    if (downloadsRange === "all") cutoff.setTime(0);
    else if (downloadsRange === "1d") cutoff.setDate(now.getDate() - 1);
    else if (downloadsRange === "1w") cutoff.setDate(now.getDate() - 7);
    else if (downloadsRange === "1m") cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    return enrichedDownloads
      .filter(function (e) { return e.date >= cutoff; })
      .filter(function (e) {
        if (!downloadsSearch) return true;
        var q = downloadsSearch.toLowerCase();
        return e.trackTitle.toLowerCase().includes(q) || e.trackArtist.toLowerCase().includes(q) || e.visitorEmail.toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [enrichedDownloads, downloadsRange, downloadsSearch]);

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
    { id: "tracks", label: t("dashboard.totalTracks"), value: allTracks.length.toLocaleString(), icon: Music, change: "+" + tracksThisWeek + " " + t("common.thisWeek").toLowerCase(), changeColor: "text-brand-orange", accent: "from-brand-orange to-brand-pink", iconBg: "bg-brand-orange/10", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.06)", borderAccent: "hover:border-brand-orange/20", hoverRing: "hover:ring-1 hover:ring-brand-orange/20", clickable: true },
    { id: "playlists", label: t("dashboard.playlists"), value: allPlaylists.length.toLocaleString(), icon: ListMusic, change: allPlaylists.length + " total", changeColor: "text-brand-pink", accent: "from-brand-pink to-brand-purple", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20", hoverRing: "hover:ring-1 hover:ring-brand-pink/20", clickable: true },
    { id: "plays", label: t("dashboard.totalPlays"), value: (linkPlays.length || engagementStats.totalPlays).toLocaleString(), icon: Headphones, change: t("dashboard.recipients", { count: playRecipients || engagementStats.uniqueRecipients }), changeColor: "text-brand-pink", accent: "from-brand-pink to-brand-orange", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20", hoverRing: "hover:ring-1 hover:ring-brand-pink/20", clickable: true },
    { id: "downloads", label: t("dashboard.downloads"), value: (linkDownloads.length || engagementStats.totalDownloads).toLocaleString(), icon: Download, change: t("dashboard.acrossContacts", { count: downloadRecipients || engagementStats.uniqueRecipients }), changeColor: "text-brand-purple", accent: "from-brand-purple to-brand-pink", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20", hoverRing: "hover:ring-1 hover:ring-brand-purple/20", clickable: true },
    { id: "contacts", label: t("nav.contacts"), value: allContacts.length.toLocaleString(), icon: Users, change: t("dashboard.recent", { count: contactsThisWeek }), changeColor: "text-brand-purple", accent: "from-brand-purple to-brand-orange", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20", hoverRing: "hover:ring-1 hover:ring-brand-purple/20", clickable: true },
    { id: "pitches", label: t("pitch.title"), value: allPitches.length.toLocaleString(), icon: Send, change: t("pitch.active", { count: allPitches.filter(function(p) { return p.status === "Sent" || p.status === "Opened"; }).length }), changeColor: "text-brand-orange", accent: "from-brand-orange to-brand-purple", iconBg: "bg-brand-orange/8", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.04)", borderAccent: "hover:border-brand-orange/20", hoverRing: "hover:ring-1 hover:ring-brand-orange/20", clickable: true },
  ];

  const isFirstSaveUser = localStorage.getItem("trakalog_first_save_done") === "true";
  const [showWelcome, setShowWelcome] = useState(() => {
    return !isFirstSaveUser && localStorage.getItem("trakalog_onboarding_complete") !== "true";
  });

  const [runTour, setRunTour] = useState(false);
  const [checklistKey, setChecklistKey] = useState(0);

  // Handle show_checklist URL param from Guide page (mount-only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("show_checklist") === "true") {
      localStorage.setItem("trakalog_checklist_dismissed", "false");
      params.delete("show_checklist");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
      setChecklistKey((k) => k + 1);
    }
  }, []);

  // Launch tour — handles both replay (URL param) and first-time launch
  useEffect(() => {
    if (showWelcome) return;
    if (isFirstSaveUser) return;

    const params = new URLSearchParams(window.location.search);
    const isReplay = params.get("replay_tour") === "true";

    if (isReplay) {
      localStorage.removeItem("trakalog_tour_complete");
      params.delete("replay_tour");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
      const timer = setTimeout(() => setRunTour(true), 800);
      return () => clearTimeout(timer);
    }

    // Normal first-time launch
    if (localStorage.getItem("trakalog_tour_complete") === "true") return;
    if (localStorage.getItem("trakalog_onboarding_complete") !== "true") return;
    const timer = setTimeout(() => setRunTour(true), 800);
    return () => clearTimeout(timer);
  }, [showWelcome, isFirstSaveUser]);

  const [showSaveBanner, setShowSaveBanner] = useState(() => {
    return isFirstSaveUser && localStorage.getItem("trakalog_first_save_banner_dismissed") !== "true";
  });

  useEffect(() => {
    if (!showSaveBanner) return;
    const timer = setTimeout(() => {
      setShowSaveBanner(false);
      localStorage.setItem("trakalog_first_save_banner_dismissed", "true");
    }, 10000);
    return () => clearTimeout(timer);
  }, [showSaveBanner]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const { createTeam, teams } = useTeams();
  const { sharedLinks } = useSharedLinks();

  const quickActions = [
    { label: t("dashboard.uploadTrack"), icon: Upload, primary: true, visible: permissions.canUploadTracks, onClick: () => setShowUploadModal(true) },
    { label: t("dashboard.newPlaylist"), icon: ListMusic, visible: permissions.canCreatePlaylists, onClick: () => setShowPlaylistModal(true) },
    { label: t("dashboard.inviteMember"), icon: Users, visible: permissions.canInviteMembers, onClick: () => setShowInviteModal(true) },
    { label: t("dashboard.createTeam"), icon: Users, visible: permissions.canInviteMembers, onClick: () => setShowCreateTeamModal(true) },
    { label: t("dashboard.newPitch"), icon: Send, visible: permissions.canSendPitches, onClick: () => setShowPitchModal(true) },
    { label: t("nav.smartAR") || "Smart A&R", icon: Sparkles, visible: true, onClick: () => navigate("/smart-ar") },
    { label: t("radio.title") || "Radio", icon: Radio, visible: true, onClick: () => navigate("/radio") },
    { label: "Export Contacts", icon: FileSpreadsheet, visible: allContacts.length > 0, onClick: () => navigate("/contacts") },
  ].filter((a) => a.visible);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1400px]">
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
            <LayoutDashboard className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("dashboard.title")}</h1>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t("dashboard.subtitle", { date: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) })}</p>
      </motion.div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist
        key={checklistKey}
        user={user}
        workspace={activeWorkspace}
        tracks={allTracks}
        playlistCount={allPlaylists.length}
        contactCount={allContacts.length}
        pitchCount={allPitches.length}
        sharedLinkCount={sharedLinks.length}
        memberCount={teams?.[0]?.members?.length || 1}
        onUpload={() => setShowUploadModal(true)}
      />

      {/* Save-from-share banner */}
      {showSaveBanner && allTracks.length > 0 && (
        <motion.div
          variants={item}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-brand-orange/10 border border-brand-orange/20"
        >
          <p className="text-sm text-foreground">
            <span className="mr-1.5">🎵</span>
            Track saved to your catalog!{" "}
            <Link to="/tracks" className="font-semibold text-brand-orange hover:underline">
              Explore your Tracks to see it.
            </Link>
          </p>
          <button
            onClick={() => { setShowSaveBanner(false); localStorage.setItem("trakalog_first_save_banner_dismissed", "true"); }}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Dashboard Empty State */}
      {allTracks.length === 0 && !isFirstSaveUser && (
        <motion.div variants={item}>
          <EmptyState
            icon={LayoutDashboard}
            title="Welcome to your Dashboard"
            description="This is where you'll see your catalog stats, recent activity, and progress. Let's begin by uploading your first track."
            actionLabel="Upload Track"
            onAction={() => setShowUploadModal(true)}
          />
        </motion.div>
      )}

      {/* Stats — 3×2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            onClick={stat.clickable ? () => {
              const closeAll = () => { setShowTracksPanel(false); setShowPlaylistsPanel(false); setShowPlaysPanel(false); setShowDownloadsPanel(false); setShowContactsPanel(false); setShowPitchesPanel(false); };
              if (stat.id === "tracks") { closeAll(); navigate("/tracks"); }
              else if (stat.id === "playlists") { closeAll(); navigate("/playlists"); }
              else if (stat.id === "plays") { const next = !showPlaysPanel; closeAll(); setShowPlaysPanel(next); }
              else if (stat.id === "downloads") { const next = !showDownloadsPanel; closeAll(); setShowDownloadsPanel(next); }
              else if (stat.id === "contacts") { closeAll(); navigate("/contacts"); }
              else if (stat.id === "pitches") { closeAll(); navigate("/pitch"); }
            } : undefined}
            className={`card-premium p-5 sm:p-7 group relative overflow-hidden transition-all ${stat.clickable ? "cursor-pointer" : "cursor-default"} ${stat.borderAccent} ${stat.hoverRing} ${((stat.id === "plays" && showPlaysPanel) || (stat.id === "downloads" && showDownloadsPanel)) ? "border-brand-orange/40 ring-1 ring-brand-orange/20" : ""}`}
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
              <ArrowUpRight className={`w-4 h-4 text-muted-foreground/20 group-hover:${stat.iconColor} transition-colors duration-300 opacity-0 group-hover:opacity-70`} />
            </div>
            <p className="text-2xl sm:text-[34px] font-bold text-foreground tracking-tight leading-none relative">{stat.value}</p>
            <div className="flex items-center justify-between mt-2.5 sm:mt-3 relative">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-xs sm:text-sm ${stat.changeColor} font-medium`}>{stat.change}</p>
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
                      {t("catalog.title")}
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
                              ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25"
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
                    placeholder={t("common.search") + "..."}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                      onClick={() => navigate(`/track/${track.uuid}`)}
                    >
                      <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                      <img
                        src={track.coverImage || DEFAULT_COVER}
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
                <div className="flex items-center gap-3">
                  <Link to="/tracks" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                    {t("dashboard.viewAll")}
                  </Link>
                  <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
                </div>
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
                      {t("dashboard.playlists")}
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
                              ? "bg-brand-pink/10 text-brand-pink border border-brand-pink/25"
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
                    placeholder={t("common.search") + "..."}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                        <img src={pl.coverImage} alt={pl.name} loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
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
                <div className="flex items-center gap-3">
                  <Link to="/playlists" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                    {t("dashboard.viewAll")}
                  </Link>
                  <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
                </div>
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
                      {t("dashboard.totalPlays")}
                      <span className="ml-2 text-muted-foreground font-normal">· {linkPlays.length || engagementStats.totalPlays} total</span>
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
                              ? "bg-brand-pink/10 text-brand-pink border border-brand-pink/25"
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
                    placeholder={t("common.search") + "..."}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {filteredPlays.length} play{filteredPlays.length !== 1 ? "s" : ""} in the last {playsRange === "all" ? "all time" : playsRange === "1d" ? "24 hours" : playsRange === "1w" ? "week" : playsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {filteredPlays.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No plays recorded in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredPlays.map(function (entry, idx) {
                    return (
                      <div
                        key={entry.id + idx}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                        onClick={function () { if (entry.trackUuid) navigate("/track/" + entry.trackUuid); }}
                      >
                        <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                        <img src={entry.coverImage || DEFAULT_COVER} alt={entry.trackTitle} loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-pink transition-colors">{entry.trackTitle}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{entry.trackArtist}</p>
                        </div>
                        <div className="hidden sm:block text-right min-w-[100px]">
                          <p className="text-[11px] text-foreground/70 truncate">{entry.visitorEmail}</p>
                        </div>
                        <span className="text-2xs text-muted-foreground/60 shrink-0 whitespace-nowrap">
                          {timeAgo(entry.date.toISOString())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredPlays.length} of {linkPlays.length} total plays
                </span>
                <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
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
                      {t("dashboard.downloads")}
                      <span className="ml-2 text-muted-foreground font-normal">· {linkDownloads.length || engagementStats.totalDownloads} total</span>
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
                              ? "bg-brand-purple/10 text-brand-purple border border-brand-purple/25"
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
                    placeholder={t("common.search") + "..."}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                <p className="text-2xs text-muted-foreground font-medium">
                  {filteredDownloads.length} download{filteredDownloads.length !== 1 ? "s" : ""} in the last {downloadsRange === "all" ? "all time" : downloadsRange === "1d" ? "24 hours" : downloadsRange === "1w" ? "week" : downloadsRange === "1m" ? "month" : "year"}
                </p>
              </div>
              {filteredDownloads.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No downloads recorded in this period</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto">
                  {filteredDownloads.map(function (entry, idx) {
                    return (
                      <div
                        key={entry.id + idx}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/25 transition-colors cursor-pointer group/row"
                        onClick={function () { if (entry.trackUuid) navigate("/track/" + entry.trackUuid); }}
                      >
                        <span className="text-2xs font-mono text-muted-foreground/40 w-5 text-right shrink-0">{idx + 1}</span>
                        <img src={entry.coverImage || DEFAULT_COVER} alt={entry.trackTitle} loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-[13px] truncate group-hover/row:text-brand-purple transition-colors">{entry.trackTitle}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{entry.trackArtist}</p>
                        </div>
                        <div className="hidden sm:block text-right min-w-[100px]">
                          <p className="text-[11px] text-foreground/70 truncate">{entry.visitorEmail}</p>
                        </div>
                        <span className="text-2xs text-muted-foreground/60 shrink-0 whitespace-nowrap">
                          {timeAgo(entry.date.toISOString())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-2xs text-muted-foreground">
                  Showing {filteredDownloads.length} of {linkDownloads.length} total downloads
                </span>
                <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
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
                      {t("nav.contacts")}
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
                              ? "bg-brand-purple/10 text-brand-purple border border-brand-purple/25"
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
                    placeholder={t("common.search") + "..."}
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                <div className="flex items-center gap-3">
                  <Link to="/contacts" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                    {t("dashboard.viewAll")}
                  </Link>
                  <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
                </div>
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
                        {t("pitch.title")}
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
                                ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25"
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
                      placeholder={t("common.search") + "..."}
                      className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="px-5 py-2.5 border-b border-border/50 bg-secondary/20">
                  <p className="text-2xs text-muted-foreground font-medium">
                    {filteredPitches.length} pitch{filteredPitches.length !== 1 ? "es" : ""}{pitchesStatusFilter !== "all" ? ` with status "${pitchesStatusFilter}"` : ""}
                  </p>
                </div>
                {filteredPitches.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">{t("pitch.noPitches")}</div>
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
                  <div className="flex items-center gap-3">
                    <Link to="/pitch" className="text-2xs gradient-text font-semibold hover:opacity-80 transition-opacity">
                      {t("dashboard.viewAll")}
                    </Link>
                    <span className="text-2xs text-muted-foreground/30 font-semibold tracking-widest">TRAKALOG</span>
                  </div>
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
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 sm:pb-0 sm:grid sm:grid-cols-4 lg:grid-cols-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                {...(action.primary ? { "data-tour": "upload-button" } : {})}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-[13px] group min-h-[72px] shrink-0 w-[120px] sm:w-auto hover:scale-[1.02] ${
                  action.primary
                    ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange hover:bg-brand-orange/12 hover:border-brand-orange/40 gradient-border hover:shadow-[0_0_20px_rgba(var(--brand-orange-rgb,255,140,50),0.15)]"
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
            {activityFeed.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground text-sm">No recent activity</div>
            ) : activityFeed.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-secondary/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${a.icon === Upload ? "bg-emerald-400/10" : a.icon === Headphones ? "bg-brand-pink/10" : a.icon === Download ? "bg-brand-purple/10" : a.icon === Send ? "bg-brand-orange/10" : "bg-secondary"}`}>
                  <a.icon className={`w-3.5 h-3.5 ${a.icon === Upload ? "text-emerald-400" : a.icon === Headphones ? "text-brand-pink" : a.icon === Download ? "text-brand-purple" : a.icon === Send ? "text-brand-orange" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground/85 leading-relaxed">{a.text}</p>
                  <p className="text-2xs text-muted-foreground mt-1 font-medium">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <UploadTrackModal open={showUploadModal} onOpenChange={setShowUploadModal} />
      <CreatePlaylistModal open={showPlaylistModal} onOpenChange={setShowPlaylistModal} onCreate={(data) => { addPlaylist(data); completeStep("create_playlist"); setShowPlaylistModal(false); }} />
      <InviteMemberModal open={showInviteModal} onOpenChange={setShowInviteModal} onInvite={() => { completeStep("add_credits"); setShowInviteModal(false); }} />
      <CreatePitchModal open={showPitchModal} onOpenChange={setShowPitchModal} onCreate={(pitch) => { addPitch(pitch); completeStep("share_or_pitch"); setShowPitchModal(false); }} />
      <CreateTeamModal open={showCreateTeamModal} onOpenChange={setShowCreateTeamModal} onCreate={(name) => { createTeam(name); completeStep("create_team"); setShowCreateTeamModal(false); }} />

      {/* Welcome Onboarding overlay */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeOnboarding onComplete={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>

      <GuidedTour
        run={runTour}
        onFinish={() => {
          setRunTour(false);
          localStorage.setItem("trakalog_tour_complete", "true");
        }}
        onUploadClick={() => setShowUploadModal(true)}
      />
    </motion.div>
  );
}
