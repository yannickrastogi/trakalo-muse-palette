import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTeams } from "@/contexts/TeamContext";
import { useTrack, mapRowToTrack, type TrackData, type TrackStem, type TrackSplit } from "@/contexts/TrackContext";
import { useEngagement } from "@/contexts/EngagementContext";
import { useTrackReview, formatTimestamp } from "@/contexts/TrackReviewContext";
import { generateLyricsPdf, generateSplitsPdf, generateMetadataPdf, generateCreditsPdf, type CreditEntry } from "@/lib/pdf-generators";
import { DownloadTrackModal } from "@/components/DownloadTrackModal";
import { SharePackModal } from "@/components/SharePackModal";
import { EditTrackModal } from "@/components/EditTrackModal";
import { Textarea } from "@/components/ui/textarea";
import { TrackWaveformPlayer } from "@/components/TrackWaveformPlayer";
import { CommentMarkerLayer } from "@/components/CommentMarkerLayer";
import { TrackReviewPanel } from "@/components/TrackReviewPanel";
import { TimecodedCommentComposer } from "@/components/TimecodedCommentComposer";
import { ShareModal } from "@/components/ShareModal";
import { ShareToWorkspaceModal } from "@/components/ShareToWorkspaceModal";
import { StudioQRModal } from "@/components/StudioQRModal";
import { usePitches } from "@/contexts/PitchContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRightLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Download,
  Share2,
  Edit3,
  Music,
  FileText,
  Send,
  Users,
  Clock,
  Disc3,
  Layers,
  PieChart,
  Paperclip,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Info,
  Activity,
  Trash2,
  Upload,
  Pause as PauseIcon,
  Mic,
  Guitar as GuitarIcon,
  Package,
  Plus,
  Headphones,
  Eye,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  X,
  QrCode,
  FileSignature,
  Loader2,
  Mail,
  AlertTriangle,
  Link2,
  PenLine,
  MessageCircle,
  Bookmark,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { PageShell } from "@/components/PageShell";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useRole } from "@/contexts/RoleContext";
import { type PitchEntry } from "@/components/CreatePitchModal";
import { StemsTab } from "@/components/StemsTab";
import { STEM_TYPES, DEFAULT_COVER } from "@/lib/constants";
import { encodeToMp3 } from "@/lib/mp3Encoder";
import { generateWaveform } from "@/lib/waveformGenerator";
import { toast } from "sonner";
import type { StemType } from "@/lib/constants";

interface StemFile {
  id: string;
  fileName: string;
  type: StemType;
  fileSize: string;
  uploadDate: string;
  color: string;
}

const pitchStatusColors: Record<string, string> = {
  Draft: "bg-muted/60 text-muted-foreground",
  Sent: "bg-primary/15 text-primary",
  Opened: "bg-brand-purple/15 text-brand-purple",
  Responded: "bg-emerald-500/15 text-emerald-400",
  "Under Review": "bg-brand-orange/15 text-brand-orange",
  Accepted: "bg-emerald-500/15 text-emerald-400",
  Declined: "bg-destructive/15 text-destructive",
};

const docStatusColors: Record<string, string> = {
  Signed: "bg-emerald-500/15 text-emerald-400",
  Pending: "bg-brand-orange/15 text-brand-orange",
  Draft: "bg-muted text-muted-foreground",
};

function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null || val === "" || val === 0) return true;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (lower === "n_a" || lower === "n/a") return true;
  }
  return false;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const detailLabelKeys: Record<string, string> = {
  producers: "productionCredits.producers", songwriters: "productionCredits.songwriters", recordingEngineer: "productionCredits.recordingEngineer",
  mixingEngineer: "productionCredits.mixingEngineer", masteringEngineer: "productionCredits.masteringEngineer", drumsBy: "performerCredits.drums",
  synthsBy: "performerCredits.synths", keysBy: "performerCredits.keys", guitarsBy: "performerCredits.guitars", bassBy: "performerCredits.bass",
  programmingBy: "productionCredits.programmingBy", vocalsBy: "performerCredits.leadVocals", backgroundVocalsBy: "performerCredits.backgroundVocals",
  mixingStudio: "productionCredits.mixingStudio", recordingStudio: "productionCredits.recordingStudio", recordingDate: "productionCredits.recordingDate",
};

function buildMeta(trackData: TrackData, t: (key: string) => string) {
  const meta = [
    { label: t("trackDetail.albumEp"), value: trackData.album || "\u2014" },
    { label: t("trackDetail.label"), value: trackData.label || "\u2014" },
    { label: t("trackDetail.publisher"), value: trackData.publisher || "\u2014" },
    { label: t("trackDetail.releaseDate"), value: trackData.releaseDate || "\u2014" },
    { label: t("trackDetail.isrc"), value: trackData.isrc || "\u2014" },
    { label: t("trackDetail.upc"), value: trackData.upc || "\u2014" },
    { label: t("trackDetail.writtenBy"), value: trackData.writtenBy.length ? trackData.writtenBy.join(", ") : "\u2014" },
    { label: t("trackDetail.producedBy"), value: trackData.producedBy.length ? trackData.producedBy.join(", ") : "\u2014" },
    { label: t("trackDetail.mixedBy"), value: trackData.mixedBy || "\u2014" },
    { label: t("trackDetail.masteredBy"), value: trackData.masteredBy || "\u2014" },
    { label: t("trackDetail.copyright"), value: trackData.copyright || "\u2014" },
    { label: t("trackDetail.language"), value: trackData.language || "\u2014" },
    { label: t("trackDetail.gender"), value: trackData.voice || "\u2014" },
    { label: t("trackDetail.explicit"), value: trackData.explicit ? t("trackDetail.yes") : t("trackDetail.no") },
    { label: t("trackDetail.notes"), value: trackData.notes || "\u2014" },
  ];
  Object.entries(trackData.details || {}).forEach(([key, values]) => {
    const filtered = values.filter(Boolean);
    if (filtered.length > 0) {
      meta.push({ label: detailLabelKeys[key] ? t(detailLabelKeys[key]) : key, value: filtered.join(", ") });
    }
  });
  return meta;
}

export default function TrackDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Global audio player
  const { currentTrack, isPlaying: globalIsPlaying, progress: globalProgress, playTrack: globalPlayTrack, togglePlay, seek, volume, setVolume } = useAudioPlayer();

  const isThisTrackPlaying = currentTrack?.uuid === id && globalIsPlaying;
  const currentProgress = currentTrack?.uuid === id ? globalProgress : 0;

  const tabParamMap: Record<string, string> = {
    splits: "details", metadata: "details", paperwork: "details",
    pitches: "activity", engagement: "activity", status: "activity",
  };
  const rawTab = searchParams.get("tab") || "lyrics";
  const [activeTab, setActiveTab] = useState<string>(tabParamMap[rawTab] || rawTab);
  const shouldAutoUpload = searchParams.get("upload") === "true";
  const shouldAutoEdit = searchParams.get("edit") === "true";
  const [waveformComposerOpen, setWaveformComposerOpen] = useState(false);
  const [waveformComposerTimestamp, setWaveformComposerTimestamp] = useState(0);

  // Clear query params after consuming them
  useEffect(() => {
    if (searchParams.has("tab") || searchParams.has("upload") || searchParams.has("edit")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { user } = useAuth();
  const { permissions } = useRole();
  const { activeWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();
  const { getTrackByUuid, getTrack, updateTrack, updateTrackStatus, deleteTrack, refreshTracks } = useTrack();
  const { getTrackEngagement } = useEngagement();
  const { getCommentsForTrack, addComment } = useTrackReview();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTrackModalOpen, setShareTrackModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [sharePackModalOpen, setSharePackModalOpen] = useState(false);
  const [editTrackModalOpen, setEditTrackModalOpen] = useState(shouldAutoEdit);
  const [studioQrOpen, setStudioQrOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareExpanded, setShareExpanded] = useState(false);
  const [shareToWorkspaceOpen, setShareToWorkspaceOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [commentFilterAuthor, setCommentFilterAuthor] = useState<string | null>(null);
  const [commentFilterLink, setCommentFilterLink] = useState<string | null>(null);
  const { teams } = useTeams();
  const currentUserName = user?.user_metadata?.full_name || user?.email || "Unknown";

  const trackData = id ? getTrackByUuid(id) : undefined;

  // Persistent fallback: survives context resets (tab switch, auth revalidation)
  const dbTrackRef = useRef<any>(null);
  const dbFetchedIdRef = useRef<string | null>(null);

  // Reset refs only when navigating to a different track
  if (id && dbFetchedIdRef.current && dbFetchedIdRef.current !== id) {
    dbFetchedIdRef.current = null;
    dbTrackRef.current = null;
  }

  useEffect(function() {
    if (!id || dbFetchedIdRef.current === id) return;
    if (trackData) {
      dbFetchedIdRef.current = id;
      return;
    }
    dbFetchedIdRef.current = id;
    supabase
      .from("tracks")
      .select("*")
      .eq("id", id)
      .single()
      .then(function(res) {
        if (res.data) {
          dbTrackRef.current = mapRowToTrack(res.data as Record<string, unknown>, 0);
          // Force re-render
          setForceUpdate((n) => n + 1);
        }
      }).catch(function (err) { console.error("Error:", err); });
  }, [id, trackData]);

  // Dummy state to force re-render when dbTrackRef is set
  const [, setForceUpdate] = useState(0);

  const track = trackData || dbTrackRef.current;
  // Remember if we ever had a track, to show loading instead of "not found" during context resets
  const hadTrackRef = useRef(false);
  if (track) hadTrackRef.current = true;

  // Auto-regenerate waveform peaks for tracks that have waveform_data = NULL
  const waveformRegenRef = useRef<string | null>(null);
  useEffect(function() {
    if (!track || !track.uuid) return;
    if (track.waveformData && track.waveformData.length > 0) return;
    if (waveformRegenRef.current === track.uuid) return;
    waveformRegenRef.current = track.uuid;

    var audioPath = track.previewUrl || track.originalFileUrl;
    if (!audioPath) return;

    // Fetch the audio file and regenerate peaks
    (async function() {
      try {
        // If the URL is already signed/absolute, fetch directly; otherwise get a signed URL
        var url = audioPath;
        if (!url.startsWith("http")) {
          var signed = await supabase.storage.from("tracks").createSignedUrl(url, 300);
          if (signed.error || !signed.data?.signedUrl) return;
          url = signed.data.signedUrl;
        }
        var response = await fetch(url);
        if (!response.ok) return;
        var blob = await response.blob();
        var file = new File([blob], "audio", { type: blob.type });
        var peaks = await generateWaveform(file, 200);
        if (!peaks || peaks.length === 0) return;

        // Persist to DB
        await supabase.from("tracks").update({ waveform_data: peaks }).eq("id", track.uuid);
        // Update local state
        if (track.id !== undefined) {
          updateTrack(track.id, { waveformData: peaks });
        }
      } catch (e) {
        console.error("Waveform auto-regeneration error:", e);
      }
    })();
  }, [track?.uuid, track?.waveformData, track?.previewUrl, track?.originalFileUrl]);

  // Play/pause handler — must be before early return to respect Rules of Hooks
  const handlePlayPause = useCallback(() => {
    if (currentTrack?.uuid === id) {
      togglePlay();
    } else if (track) {
      globalPlayTrack(track);
    }
  }, [track, currentTrack, id, togglePlay, globalPlayTrack]);

  const numericId = track?.id;
  const engagement = numericId ? getTrackEngagement(numericId) : undefined;
  const trackComments = track?.uuid ? getCommentsForTrack(track.uuid) : [];
  const commentCount = trackComments.length;

  // Unique comment authors and shared links for the filter dropdowns
  const commentAuthors = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    trackComments.forEach((c) => {
      const existing = map.get(c.authorName);
      if (existing) existing.count++;
      else map.set(c.authorName, { name: c.authorName, count: 1 });
    });
    return Array.from(map.values());
  }, [trackComments]);

  const commentSharedLinks = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    trackComments.forEach((c) => {
      const key = c.sharedLinkId || "__direct__";
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { id: key, name: c.sharedLinkName || (c.sharedLinkId ? c.sharedLinkId : "Direct"), count: 1 });
    });
    return Array.from(map.values());
  }, [trackComments]);

  const statusColorMap: Record<string, string> = {
    Available: "bg-emerald-500/15 text-emerald-400",
    "On Hold": "bg-brand-orange/15 text-brand-orange",
    Released: "bg-brand-purple/15 text-brand-purple",
  };

  // Parse duration string to seconds
  const parseDuration = (dur: string): number => {
    const parts = dur.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
  };
  const totalDurationSeconds = track ? parseDuration(track.duration) : 0;

  const handleWaveformClick = (pct: number) => {
    if (currentTrack?.uuid !== id && track) {
      globalPlayTrack(track);
    }
    seek(pct);
  };

  const handleWaveformDoubleClick = (pct: number) => {
    const seconds = (pct / 100) * totalDurationSeconds;
    setWaveformComposerTimestamp(seconds);
    setWaveformComposerOpen(true);
    seek(pct);
  };

  const handleCommentSeek = (seconds: number, _totalDuration: number) => {
    const pct = (seconds / totalDurationSeconds) * 100;
    seek(pct);
  };

  const handleWaveformCommentSubmit = (text: string, timestampSeconds: number) => {
    if (!track) return;
    addComment({
      trackId: track.uuid,
      authorName: currentUserName,
      authorType: "owner",
      commentText: text,
      timestampSeconds,
      timestampLabel: formatTimestamp(timestampSeconds),
      sourceContext: "internal_review",
    });
    setWaveformComposerOpen(false);
  };

  const isViewerShared = track?.isShared && track?.shareAccessLevel === "viewer";

  const allTabs = [
    { id: "lyrics", label: "Lyrics" },
    { id: "stems", label: "Stems" },
    { id: "details", label: "Details" },
    { id: "activity", label: engagement ? "Activity (" + engagement.totalPlays + ")" : "Activity" },
    { id: "review", label: commentCount ? "Notes (" + commentCount + ")" : "Notes" },
  ];
  const tabs = isViewerShared
    ? allTabs.filter(function (tab) { return tab.id !== "stems" && tab.id !== "activity"; })
    : allTabs;

  return (
    <PageShell>
      <div data-drm="protected" onContextMenu={(e: React.MouseEvent) => e.preventDefault()}>
      {!track ? (
        hadTrackRef.current ? (
          <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <Disc3 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading track...</span>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Track not found.</div>
        )
      ) : (
        <>
          <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
            {/* Breadcrumb */}
            <motion.div variants={item}>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/tracks">{t("trackDetail.tracks")}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{track.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </motion.div>

            {/* Shared track banner */}
            {track.isShared && (
              <motion.div variants={item} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-purple/8 border border-brand-purple/20">
                <Info className="w-4 h-4 text-brand-purple shrink-0" />
                <p className="text-sm text-foreground flex-1">
                  {track.shareAccessLevel === "viewer"
                    ? t("catalogSharing.savedFromBanner", { workspace: track.sharedFrom || "" })
                    : t("catalogSharing.sharedFromBanner", { workspace: track.sharedFrom || "" })}
                </p>
                {track.shareAccessLevel === "viewer" && track.shareId && (
                  <button
                    onClick={async function() {
                      var { error } = await supabase
                        .rpc("remove_track_from_trakalog", { _track_id: track.uuid, _user_id: user.id });
                      if (!error) {
                        supabase.rpc("write_audit_log", { _user_id: user.id, _workspace_id: activeWorkspace?.id || null, _action: "track.removed_from_share", _entity_type: "track", _entity_id: track.uuid }).then(() => {}).catch(() => {});
                        toast.success(t("catalogSharing.removedFromTrakalog"));
                        refreshTracks();
                        navigate("/tracks");
                      }
                    }}
                    className="text-[11px] text-destructive hover:text-destructive/80 font-semibold transition-colors min-h-[44px] px-2 shrink-0"
                  >
                    {t("catalogSharing.removeFromTrakalog")}
                  </button>
                )}
              </motion.div>
            )}

            {/* Hero section: Cover + Info + Player */}
            <motion.div variants={item} className="flex flex-col lg:flex-row gap-6">
              {/* Cover artwork — full width on mobile */}
              <div className="w-full md:w-52 lg:w-64 shrink-0">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 border border-border flex items-center justify-center relative overflow-hidden group" style={{ boxShadow: "var(--shadow-card)" }}>
                  <img src={track.coverImage || DEFAULT_COVER} alt={track.title} className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const path = activeWorkspace.id + "/" + track.uuid + ".jpg";
                      const { error } = await supabase.storage
                        .from("covers")
                        .upload(path, file, { upsert: true, contentType: file.type });
                      if (error) {
                        console.error("Error uploading cover:", error);
                        return;
                      }
                      const { data: urlData } = supabase.storage
                        .from("covers")
                        .getPublicUrl(path);
                      updateTrack(track.id, { coverImage: urlData.publicUrl });
                      e.target.value = "";
                    }}
                  />
                  {!isViewerShared && permissions.canEditTracks && (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-all duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  )}
                </div>
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {isViewerShared || !permissions.canEditTracks ? (
                      <span className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium " + (statusColorMap[track.status] || "bg-emerald-500/15 text-emerald-400")}>
                        {track.status}
                      </span>
                    ) : (
                    <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity " + (statusColorMap[track.status] || "bg-emerald-500/15 text-emerald-400")}>
                          {track.status}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-1.5">
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              if (opt.value !== track.status) {
                                updateTrackStatus(track.id, opt.value, "Status updated");
                              }
                              setStatusPopoverOpen(false);
                            }}
                            className={"flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors " + (opt.value === track.status ? opt.color + " font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
                          >
                            <opt.icon className="w-4 h-4" />
                            {opt.value}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    )}
                    {track.isrc && <span className="text-xs text-muted-foreground">{track.isrc}</span>}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{track.title}</h1>
                  <p className="text-lg text-muted-foreground mt-1">
                    {track.artist}
                    {track.featuredArtists?.length > 0 && (
                      <span className="text-foreground/60"> feat. {track.featuredArtists.join(", ")}</span>
                    )}
                  </p>
                </div>

                {/* Quick metadata chips — scroll horizontal on mobile */}
                <div className="flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto scrollbar-hide pb-1 md:pb-0">
                  {!isEmptyValue(track.type) && <MetaChip icon={Music} label={track.type} />}
                  {!isEmptyValue(track.genre) && <MetaChip icon={Disc3} label={track.genre} />}
                  {!isEmptyValue(track.bpm) && <MetaChip icon={Activity} label={track.bpm + " BPM"} />}
                  {!isEmptyValue(track.key) && <MetaChip icon={({ className }: { className?: string }) => <span className={className}>#</span>} label={track.key} />}
                  {isEmptyValue(track.bpm) && isEmptyValue(track.key) && track.createdAt && (Date.now() - new Date(track.createdAt).getTime()) < 5 * 60 * 1000 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-orange/10 text-xs font-medium text-brand-orange animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </span>
                  )}
                  {!isEmptyValue(track.language) && <MetaChip icon={Mic} label={track.language} />}
                  {!isEmptyValue(track.voice) && <MetaChip icon={Mic} label={track.voice} />}
                  {!isEmptyValue(track.duration) && <MetaChip icon={Clock} label={track.duration} />}
                  {(track.mood || []).map((m) => (
                    <span key={m} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
                      #{m}
                    </span>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="pt-1">
                  <AnimatePresence mode="wait" initial={false}>
                    {!shareExpanded ? (
                      <motion.div
                        key="main-actions"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2"
                      >
                        {permissions.canEditTracks && !isViewerShared && (
                          <button
                            onClick={() => setEditTrackModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 min-h-[44px] col-span-1"
                          >
                            <Edit3 className="w-4 h-4" /> Edit Track
                          </button>
                        )}
                        {permissions.canCreateSharedLinks && track.shareAccessLevel !== "viewer" && (
                          <button
                            onClick={() => setShareExpanded(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px] col-span-1"
                          >
                            <Share2 className="w-4 h-4" /> Share
                          </button>
                        )}
                        <button
                          onClick={() => setDownloadModalOpen(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px]"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                        {isViewerShared && track.shareId && (
                          <button
                            onClick={async function() {
                              var { error } = await supabase
                                .rpc("remove_track_from_trakalog", { _track_id: track.uuid, _user_id: user.id });
                              if (!error) {
                                supabase.rpc("write_audit_log", { _user_id: user.id, _workspace_id: activeWorkspace?.id || null, _action: "track.removed_from_share", _entity_type: "track", _entity_id: track.uuid }).then(() => {}).catch(() => {});
                                toast.success(t("catalogSharing.removedFromTrakalog"));
                                refreshTracks();
                                navigate("/tracks");
                              }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 transition-all duration-200 min-h-[44px]"
                          >
                            <X className="w-4 h-4" /> {t("catalogSharing.removeFromTrakalog")}
                          </button>
                        )}
                        {permissions.canEditTracks && !isViewerShared && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!track.previewFileUrl && (
                                <DropdownMenuItem onClick={async () => {
                                  try {
                                    toast.info("Compressing MP3 preview...");
                                    // Fetch the raw audio_url path from DB (track.originalFileUrl may be signed)
                                    const { data: row, error: fetchErr } = await supabase
                                      .from("tracks")
                                      .select("audio_url")
                                      .eq("id", track.uuid)
                                      .single();
                                    if (fetchErr || !row?.audio_url) throw new Error("No audio file for this track");
                                    const storagePath = row.audio_url as string;
                                    const { data: fileData, error: dlErr } = await supabase.storage
                                      .from("tracks")
                                      .download(storagePath);
                                    if (dlErr || !fileData) throw new Error("Failed to download audio");
                                    const audioFile = new File([fileData], "audio.wav", { type: fileData.type });
                                    const mp3Blob = await encodeToMp3(audioFile);
                                    const previewPath = storagePath.replace(/\.[^.]+$/, "_preview.mp3");
                                    const { error: upErr } = await supabase.storage
                                      .from("tracks")
                                      .upload(previewPath, mp3Blob, { contentType: "audio/mp3", upsert: true });
                                    if (upErr) throw upErr;
                                    await supabase
                                      .from("tracks")
                                      .update({ audio_preview_url: previewPath })
                                      .eq("id", track.uuid);
                                    refreshTracks();
                                    toast.success("MP3 preview ready");
                                  } catch (err) {
                                    console.error("MP3 generation failed:", err);
                                    toast.warning("MP3 preview generation failed");
                                  }
                                }}>
                                  <Music className="w-4 h-4 mr-2" /> Generate MP3 Preview
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={async () => {
                                try {
                                  toast.info("Sonic DNA analysis in progress…");

                                  // 1. Fetch raw storage path from DB
                                  const { data: row, error: fetchErr } = await supabase
                                    .from("tracks")
                                    .select("audio_url")
                                    .eq("id", track.uuid)
                                    .single();
                                  if (fetchErr) throw new Error("Could not fetch track: " + fetchErr.message);
                                  if (!row?.audio_url) throw new Error("No audio file linked to this track");

                                  // 2. Call Sonic DNA Edge Function
                                  const res = await fetch(SUPABASE_URL + "/functions/v1/analyze-sonic-dna", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
                                      "apikey": SUPABASE_PUBLISHABLE_KEY,
                                    },
                                    body: JSON.stringify({ track_id: track.uuid, storage_path: row.audio_url, force: true }),
                                  });
                                  const result = await res.json();
                                  if (!res.ok) throw new Error(result.error || "Sonic DNA analysis failed");

                                  refreshTracks();
                                  const bpm = result.sonic_dna?.bpm?.bpm;
                                  const key = result.sonic_dna?.key?.key;
                                  const mode = result.sonic_dna?.key?.mode;
                                  const keyLabel = key ? key + " " + (mode === "Minor" ? "Min" : "Maj") : null;
                                  toast.success("Sonic DNA complete" + (bpm ? ": " + Math.round(bpm) + " BPM" : "") + (keyLabel ? ", " + keyLabel : ""));
                                } catch (err: any) {
                                  console.error("Re-analyze failed:", err);
                                  toast.error("Re-analysis failed: " + (err?.message || "unknown error"));
                                }
                              }}>
                                <Activity className="w-4 h-4 mr-2" /> Re-analyze Audio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStudioQrOpen(true)}>
                                <QrCode className="w-4 h-4 mr-2" /> Studio QR
                              </DropdownMenuItem>
                              {!track.isShared && permissions.canDeleteTracks && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="share-actions"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <button
                          onClick={() => setShareExpanded(false)}
                          className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setShareTrackModalOpen(true); setShareExpanded(false); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px]"
                        >
                          <Music className="w-4 h-4" /> Share Track
                        </button>
                        <button
                          onClick={() => { setShareModalOpen(true); setShareExpanded(false); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px]"
                        >
                          <Layers className="w-4 h-4" /> Share Stems
                        </button>
                        <button
                          onClick={() => { setSharePackModalOpen(true); setShareExpanded(false); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px]"
                        >
                          <Package className="w-4 h-4" /> Share Trakalog Pack
                        </button>
                        {workspaces.length > 1 && !track.isShared && (
                          <button
                            onClick={() => { setShareToWorkspaceOpen(true); setShareExpanded(false); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-all duration-200 min-h-[44px]"
                          >
                            <ArrowRightLeft className="w-4 h-4" /> Share to Workspace
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Audio Player */}
            <motion.div variants={item} className="bg-card border border-border rounded-xl p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    disabled={!track.previewUrl && !track.originalFileUrl && !isThisTrackPlaying}
                    className={"w-10 h-10 rounded-full flex items-center justify-center transition-colors " + (!track.previewUrl && !track.originalFileUrl && !isThisTrackPlaying ? "bg-muted text-muted-foreground cursor-default" : "bg-primary text-primary-foreground hover:bg-primary/90")}
                  >
                    {isThisTrackPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                  </button>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>{formatTimestamp((currentProgress / 100) * totalDurationSeconds)}</span>
                  <span>{track.duration}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <button onClick={() => { const v = volume > 0 ? 0 : 0.8; setVolume(v); }} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 h-1.5 accent-primary cursor-pointer" />
                </div>
              </div>
              <div className="relative">
                <TrackWaveformPlayer
                  seed={track.id}
                  peaks={track.waveformData}
                  progress={currentProgress}
                  onSeek={handleWaveformClick}
                  onDoubleClick={handleWaveformDoubleClick}
                  chapters={track.chapters || []}
                  isPlaying={isThisTrackPlaying}
                  editable={!isViewerShared && permissions.canEditTracks}
                  onChaptersChange={async (newChapters) => {
                    updateTrack(track.id, { chapters: newChapters });

                    // Sync to sonic_dna.structure if sonic_dna exists
                    const { data: row } = await supabase
                      .from("tracks")
                      .select("sonic_dna")
                      .eq("id", track.uuid)
                      .single();

                    const existingSonicDna = row?.sonic_dna as Record<string, unknown> | null;
                    if (!existingSonicDna) {
                      toast.success("Sections saved");
                      return;
                    }

                    toast("Updating Sonic DNA...");
                    const durationSec = totalDurationSeconds || 1;
                    const oldStructure = (existingSonicDna.structure as Array<{ start_sec?: number; end_sec?: number; energy_avg?: number | null }>) || [];

                    const newStructure = newChapters.map((ch) => {
                      const startSec = ch.startSec ?? (ch.startPercent * durationSec) / 100;
                      const endSec = ch.endSec ?? (ch.endPercent * durationSec) / 100;
                      // Try to find a matching old segment to preserve energy_avg
                      const match = oldStructure.find(
                        (old) => old.start_sec != null && old.end_sec != null && Math.abs(old.start_sec - startSec) < 2 && Math.abs(old.end_sec - endSec) < 2
                      );
                      return {
                        type: ch.label.toLowerCase().replace(/\s+\d+$/, ""),
                        start_sec: Math.round(startSec * 100) / 100,
                        end_sec: Math.round(endSec * 100) / 100,
                        energy_avg: match?.energy_avg ?? null,
                      };
                    });

                    const updatedSonicDna = { ...existingSonicDna, structure: newStructure };
                    const { error } = await supabase
                      .from("tracks")
                      .update({ sonic_dna: updatedSonicDna })
                      .eq("id", track.uuid);

                    if (error) {
                      console.error("Failed to update sonic_dna.structure:", error);
                      toast.error("Failed to update Sonic DNA");
                    } else {
                      toast.success("Sections saved to Sonic DNA");
                    }
                  }}
                />
                <CommentMarkerLayer
                  comments={trackComments}
                  totalDurationSeconds={totalDurationSeconds}
                  onMarkerClick={(seconds) => handleCommentSeek(seconds, totalDurationSeconds)}
                  filterAuthor={commentFilterAuthor}
                  filterSharedLink={commentFilterLink}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">Double-click waveform to leave a timecoded comment</p>

              {/* Inline waveform comment composer */}
              <AnimatePresence>
                {waveformComposerOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                    <TimecodedCommentComposer
                      currentSeconds={(currentProgress / 100) * totalDurationSeconds}
                      initialTimestamp={waveformComposerTimestamp}
                      onSubmit={handleWaveformCommentSubmit}
                      onCancel={() => setWaveformComposerOpen(false)}
                      compact
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>

            {/* Tabs */}
            <motion.div variants={item} className="border-b border-border">
              <div className="flex gap-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={"px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] " + (activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Tab content */}
            <motion.div variants={item}>
              {activeTab === "lyrics" && <LyricsTab trackId={track.id} trackUuid={track.uuid} fallbackTrack={track} readOnly={isViewerShared || !permissions.canEditTracks} />}
               {activeTab === "stems" && <StemsTab trackId={track.id} autoOpenUpload={shouldAutoUpload} readOnly={isViewerShared || !permissions.canEditTracks} />}
               {activeTab === "details" && (
                 <div className="space-y-10">
                   <section>
                     <h3 className="text-lg font-semibold text-foreground mb-4">Splits</h3>
                     <SplitsTab trackId={track.id} trackUuid={track.uuid} readOnly={isViewerShared} />
                   </section>
                   <div className="border-t border-border" />
                   <section>
                     <h3 className="text-lg font-semibold text-foreground mb-4">Metadata</h3>
                     <OverviewTab trackId={track.id} onEdit={() => setEditTrackModalOpen(true)} readOnly={isViewerShared || !permissions.canEditTracks} />
                   </section>
                   {!isViewerShared && permissions.canEditTracks && (
                   <>
                   <div className="border-t border-border" />
                   <section>
                     <h3 className="text-lg font-semibold text-foreground mb-4">Paperwork</h3>
                     <PaperworkTab trackUuid={track.uuid} workspaceId={activeWorkspace.id} />
                   </section>
                   </>
                   )}
                 </div>
               )}
               {activeTab === "activity" && (
                 <ActivityTimeline trackId={track.id} trackUuid={track.uuid} />
               )}
               {activeTab === "review" && (
                 <div className="space-y-4">
                 {/* Track notes */}
                 {track.notes && track.notes.trim() !== "" && (
                   <>
                     <div>
                       <p className="text-sm font-semibold text-foreground mb-2">Track Notes</p>
                       <div className="bg-secondary rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap">
                         {track.notes}
                       </div>
                     </div>
                     <div className="border-t border-border my-4" />
                   </>
                 )}
                 {/* Recipient feedback filter pills */}
                 {commentCount > 0 && (
                   <div className="px-0 py-3">
                     <p className="text-sm font-semibold text-foreground mb-2">
                       {"Recipient Feedback "}
                       <span className="text-muted-foreground font-normal">
                         {"· " + commentCount + " comment" + (commentCount !== 1 ? "s" : "") + " from " + commentAuthors.length + " " + (commentAuthors.length !== 1 ? "people" : "person")}
                       </span>
                     </p>
                     <div className="flex flex-wrap gap-2">
                       <button
                         onClick={() => setCommentFilterAuthor(null)}
                         className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] " + (!commentFilterAuthor ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25" : "bg-card border border-border text-muted-foreground hover:text-foreground")}
                       >
                         {"All (" + commentCount + ")"}
                       </button>
                       {commentAuthors.map((a) => {
                         const initials = a.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                         const isActive = commentFilterAuthor === a.name;
                         return (
                           <button
                             key={a.name}
                             onClick={() => setCommentFilterAuthor(a.name)}
                             className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] " + (isActive ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25" : "bg-card border border-border text-muted-foreground hover:text-foreground")}
                           >
                             <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                               {initials}
                             </span>
                             {a.name + " (" + a.count + ")"}
                           </button>
                         );
                       })}
                     </div>
                     {commentSharedLinks.length > 1 && (
                       <div className="flex flex-wrap gap-1.5 mt-2">
                         <span className="text-[10px] text-muted-foreground/60 self-center mr-1">via:</span>
                         <button
                           onClick={() => setCommentFilterLink(null)}
                           className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors min-h-[28px] " + (!commentFilterLink ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25" : "bg-card border border-border text-muted-foreground hover:text-foreground")}
                         >
                           All Links
                         </button>
                         {commentSharedLinks.map((l) => (
                           <button
                             key={l.id}
                             onClick={() => setCommentFilterLink(l.id)}
                             className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors min-h-[28px] " + (commentFilterLink === l.id ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/25" : "bg-card border border-border text-muted-foreground hover:text-foreground")}
                           >
                             <Link2 className="w-3 h-3" />
                             {l.name + " (" + l.count + ")"}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 )}
                 <TrackReviewPanel
                   trackId={track.uuid}
                   currentUserName={currentUserName}
                   progress={currentProgress}
                   onSeek={handleCommentSeek}
                   totalDurationSeconds={totalDurationSeconds}
                   isPlaying={isThisTrackPlaying}
                   filterAuthor={commentFilterAuthor}
                   filterSharedLink={commentFilterLink}
                 />
                 </div>
               )}
             </motion.div>
          </motion.div>
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareType="stems"
        trackId={track.id}
        trackUuid={track.uuid}
        trackTitle={track?.title}
        trackArtist={track?.artist}
        trackCover={track?.coverImage}
        stems={(track?.stems || []).map((s) => ({ id: s.id, fileName: s.fileName, type: s.type, fileSize: s.fileSize }))}
      />
      <ShareModal
        open={shareTrackModalOpen}
        onClose={() => setShareTrackModalOpen(false)}
        shareType="track"
        trackId={track.id}
        trackUuid={track.uuid}
        trackTitle={track?.title}
        trackArtist={track?.artist}
        trackCover={track?.coverImage}
      />
      {track && (
        <DownloadTrackModal
          open={downloadModalOpen}
          onClose={() => setDownloadModalOpen(false)}
          trackData={track}
          meta={buildMeta(track, t)}
        />
      )}
      {track && (
        <SharePackModal
          open={sharePackModalOpen}
          onClose={() => setSharePackModalOpen(false)}
          trackData={track}
        />
      )}
      <EditTrackModal
        open={editTrackModalOpen}
        onClose={() => setEditTrackModalOpen(false)}
        trackId={track.id}
      />
      {track && workspaces.length > 1 && (
        <ShareToWorkspaceModal
          open={shareToWorkspaceOpen}
          onClose={() => setShareToWorkspaceOpen(false)}
          trackId={track.uuid}
          sourceWorkspaceId={activeWorkspace.id}
        />
      )}
      <StudioQRModal
        open={studioQrOpen}
        onClose={() => setStudioQrOpen(false)}
        trackId={track.uuid}
        trackTitle={track.title}
        trackArtist={track.artist}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Track</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{track.title}"? This will permanently remove the track, its stems, and all associated files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                const ok = await deleteTrack(track.uuid);
                setDeleting(false);
                if (ok) {
                  setDeleteDialogOpen(false);
                  navigate("/tracks");
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
      </div>
    </PageShell>
  );
}
/* ─── Sub-components ─── */

function MetaChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-xs font-medium text-foreground/80">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      {label}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4.5 h-4.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function OverviewTab({ trackId, onEdit, readOnly }: { trackId: number; onEdit: () => void; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  if (!trackData) return null;

  const meta = buildMeta(trackData, t);

  const handleDownloadPdf = () => {
    generateMetadataPdf(trackData.title, trackData.artist, meta);
  };

  return (
    <SectionCard
      title="Metadata"
      icon={FileText}
      action={
        <div className="flex items-center gap-2">
          {!readOnly && (
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-foreground hover:text-foreground/80 bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg font-semibold transition-colors">
            <Edit3 className="w-3.5 h-3.5" /> Edit Metadata
          </button>
          )}
          <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg font-semibold transition-colors">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {meta.map((m) => (
          <div key={m.label} className="bg-card px-5 py-3.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{m.label}</p>
            <p className="text-sm text-foreground font-medium">{m.value}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

const PERFORMER_CREDIT_KEYS = [
  { key: "vocalsBy", label: "Lead Vocals By" },
  { key: "backgroundVocalsBy", label: "Background Vocals By" },
  { key: "drumsBy", label: "Drums By" },
  { key: "synthsBy", label: "Synths By" },
  { key: "keysBy", label: "Keys By" },
  { key: "guitarsBy", label: "Guitars By" },
  { key: "bassBy", label: "Bass By" },
];

const PRODUCTION_CREDIT_KEYS = [
  { key: "producers", label: "Producer(s)" },
  { key: "songwriters", label: "Songwriter(s)" },
  { key: "recordingEngineer", label: "Recording Engineer" },
  { key: "mixingEngineer", label: "Mixing Engineer" },
  { key: "masteringEngineer", label: "Mastering Engineer" },
  { key: "programmingBy", label: "Programming By" },
  { key: "mixingStudio", label: "Mixing Studio" },
  { key: "recordingStudio", label: "Recording Studio" },
  { key: "recordingDate", label: "Recording Date" },
];

function CreditsTab({ trackId, onEdit }: { trackId: number; onEdit: () => void }) {
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  if (!trackData) return null;

  const details = trackData.details || {};
  const performerCredits = PERFORMER_CREDIT_KEYS.filter((f) => details[f.key]?.some((v) => v.trim()));
  const productionCredits = PRODUCTION_CREDIT_KEYS.filter((f) => details[f.key]?.some((v) => v.trim()));

  const topLevelCredits = [
    { label: "Written By", value: trackData.writtenBy.length ? trackData.writtenBy.join(", ") : "" },
    { label: "Produced By", value: trackData.producedBy.length ? trackData.producedBy.join(", ") : "" },
    { label: "Mixed By", value: trackData.mixedBy || "" },
    { label: "Mastered By", value: trackData.masteredBy || "" },
  ].filter((c) => c.value);

  const hasAny = performerCredits.length > 0 || productionCredits.length > 0 || topLevelCredits.length > 0;

  const handleDownloadPdf = () => {
    const perfEntries: CreditEntry[] = performerCredits.map((f) => ({
      label: f.label,
      value: details[f.key].filter(Boolean).join(", "),
    }));
    const prodEntries: CreditEntry[] = productionCredits.map((f) => ({
      label: f.label,
      value: details[f.key].filter(Boolean).join(", "),
    }));
    generateCreditsPdf(trackData.title, trackData.artist, topLevelCredits, perfEntries, prodEntries);
  };

  return (
    <SectionCard title="Credits" icon={Users}>
      {hasAny ? (
        <div className="p-5 space-y-6">
          {topLevelCredits.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topLevelCredits.map((c) => (
                <div key={c.label}>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{c.label}</p>
                  <p className="text-sm text-foreground font-medium">{c.value}</p>
                </div>
              ))}
            </div>
          )}
          {performerCredits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1 mb-3">Performer Credits</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {performerCredits.map((f) => (
                  <div key={f.key}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                    <p className="text-sm text-foreground font-medium">{details[f.key].filter(Boolean).join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {productionCredits.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1 mb-3">Production & Other Credits</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {productionCredits.map((f) => (
                  <div key={f.key}>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                    <p className="text-sm text-foreground font-medium">{details[f.key].filter(Boolean).join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Credits
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">No credits added yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add performer and production credits</p>
            <button
              onClick={onEdit}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors mx-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Add Credits
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function LyricsTab({ trackId, trackUuid, fallbackTrack, readOnly }: { trackId: number; trackUuid: string; fallbackTrack?: TrackData; readOnly?: boolean }) {
  const { getTrack, updateTrackLyrics, refreshTracks } = useTrack();
  const { currentTrack, currentTime, isPlaying, seekToTime, playTrack } = useAudioPlayer();
  const contextTrack = getTrack(trackId);
  const trackData = contextTrack || fallbackTrack;
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const [editLines, setEditLines] = useState<{ start: number; end: number; text: string }[]>([]);
  const [syncedEditMode, setSyncedEditMode] = useState(false);
  const [localLyrics, setLocalLyrics] = useState<string | undefined>(undefined);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // When using fallback, we need to fetch fresh lyrics from DB
  const [dbLyrics, setDbLyrics] = useState<string | undefined>(undefined);
  const [dbSegments, setDbSegments] = useState<{ start: number; end: number; text: string }[] | undefined>(undefined);
  const dbFetchedRef = useRef<string | null>(null);

  useEffect(function() {
    if (contextTrack || dbFetchedRef.current === trackUuid) return;
    dbFetchedRef.current = trackUuid;
    supabase
      .from("tracks")
      .select("lyrics, lyrics_segments")
      .eq("id", trackUuid)
      .single()
      .then(function(res) {
        if (res.data?.lyrics) {
          setDbLyrics(res.data.lyrics as string);
        }
        if (res.data?.lyrics_segments) {
          setDbSegments(res.data.lyrics_segments as { start: number; end: number; text: string }[]);
        }
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid, contextTrack]);

  if (!trackData) return null;

  // Use the most up-to-date lyrics source: local edit > context > DB fetch > fallback
  const effectiveTrackData = localLyrics !== undefined
    ? { ...trackData, lyrics: localLyrics }
    : contextTrack
      ? trackData
      : dbLyrics !== undefined
        ? { ...trackData, lyrics: dbLyrics, lyricsSegments: dbSegments }
        : trackData;

  const segments = effectiveTrackData.lyricsSegments;
  const isThisTrackPlaying = currentTrack?.uuid === trackData.uuid;
  const hasSyncedLyrics = !!segments && segments.length > 0 && !isEditing;

  // Find the active segment index based on current playback time (respects end time)
  const activeSegmentIndex = useMemo(() => {
    if (!hasSyncedLyrics || !isThisTrackPlaying) return -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start && currentTime < segments[i].end) return i;
    }
    return -1;
  }, [hasSyncedLyrics, isThisTrackPlaying, currentTime, segments]);

  // Auto-scroll to the active line
  useEffect(() => {
    if (activeSegmentIndex >= 0 && activeLineRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeLine = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const lineRect = activeLine.getBoundingClientRect();
      const offset = lineRect.top - containerRect.top - containerRect.height / 3;
      container.scrollBy({ top: offset, behavior: "smooth" });
    }
  }, [activeSegmentIndex]);

  const handleSegmentClick = (segment: { start: number; end: number; text: string }) => {
    if (isThisTrackPlaying) {
      seekToTime(segment.start);
    } else if (trackData) {
      playTrack(trackData);
      // Small delay to let audio load, then seek
      setTimeout(() => seekToTime(segment.start), 300);
    }
  };

  const isAutoTranscribed = effectiveTrackData.lyrics?.startsWith("[auto-transcribed]\n") || false;
  const rawLyrics = isAutoTranscribed ? effectiveTrackData.lyrics!.replace("[auto-transcribed]\n", "") : (effectiveTrackData.lyrics || "");
  const hasLyrics = !!rawLyrics.trim();

  const handleSave = async () => {
    if (syncedEditMode) {
      const newSegments = editLines.filter((l) => l.text.trim() !== "");
      const prefix = isAutoTranscribed ? "[auto-transcribed]\n" : "";
      const newLyrics = prefix + newSegments.map((s) => s.text).join("\n");
      if (contextTrack) {
        updateTrackLyrics(trackId, newLyrics, newSegments);
      } else {
        await supabase.from("tracks").update({ lyrics: newLyrics, lyrics_segments: newSegments }).eq("id", trackUuid);
        setLocalLyrics(newLyrics);
        setDbLyrics(newLyrics);
        setDbSegments(newSegments);
        refreshTracks();
      }
    } else {
      if (contextTrack) {
        updateTrackLyrics(trackId, editValue);
      } else {
        await supabase.from("tracks").update({ lyrics: editValue }).eq("id", trackUuid);
        setLocalLyrics(editValue);
        setDbLyrics(editValue);
        refreshTracks();
      }
    }

    // Sync lyrics to sonic_dna.user_metadata
    try {
      const { data: row } = await supabase
        .from("tracks")
        .select("sonic_dna")
        .eq("id", trackUuid)
        .single();
      const existingSonicDna = row?.sonic_dna as Record<string, unknown> | null;
      if (existingSonicDna) {
        const savedLyrics = syncedEditMode
          ? editLines.filter((l) => l.text.trim() !== "").map((s) => s.text).join("\n")
          : editValue;
        const rawLyrics = savedLyrics.replace(/^\[auto-transcribed\]\n/, "");
        const updatedSonicDna = {
          ...existingSonicDna,
          user_metadata: {
            ...(existingSonicDna.user_metadata as Record<string, unknown> || {}),
            lyrics: rawLyrics,
          },
        };
        await supabase.from("tracks").update({ sonic_dna: updatedSonicDna }).eq("id", trackUuid);
      }
    } catch (err) {
      console.error("Failed to sync lyrics to sonic_dna:", err);
    }

    setIsEditing(false);
    setSyncedEditMode(false);
  };

  const handleCancel = () => {
    setEditValue(rawLyrics);
    setEditLines([]);
    setSyncedEditMode(false);
    setIsEditing(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;
    // Read PDF as text — since we can't parse real PDFs in browser without a lib,
    // we simulate by reading as text. For real PDFs, a backend service would be needed.
    try {
      const text = await file.text();
      // Try to extract readable text from PDF content
      const cleaned = text
        .replace(/[^\x20-\x7E\n\r]/g, " ")
        .replace(/\s{3,}/g, "\n")
        .trim();
      const extracted = cleaned.length > 20 ? cleaned : `[Lyrics imported from ${file.name}]\n\nPaste your lyrics here to replace this placeholder.`;
      setEditValue(extracted);
      setIsEditing(true);
    } catch {
      setEditValue(`[Lyrics imported from ${file.name}]\n\nPaste your lyrics here.`);
      setIsEditing(true);
    }
    e.target.value = "";
  };

  const handleDownloadPdf = () => {
    if (!effectiveTrackData.lyrics) return;
    generateLyricsPdf(effectiveTrackData.title, effectiveTrackData.artist, effectiveTrackData.lyrics);
  };

  const handleTranscribe = async () => {
    if (hasLyrics && !confirm("Existing lyrics will be replaced. Continue?")) return;
    try {
      toast.info("Transcribing lyrics...");
      const res = await fetch(SUPABASE_URL + "/functions/v1/transcribe-lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ track_id: trackUuid }),
      });
      const json = await res.json();
      if (json.empty) {
        toast.info("No vocals detected in this track");
      } else if (json.success) {
        // Refresh lyrics from DB
        dbFetchedRef.current = null;
        setDbLyrics(undefined);
        setLocalLyrics(undefined);
        refreshTracks();
        toast.success("Lyrics transcribed! Please review and edit if needed — auto-transcription may contain errors.", { duration: 6000 });

        // Sync transcribed lyrics to sonic_dna.user_metadata
        try {
          const { data: freshRow } = await supabase
            .from("tracks")
            .select("lyrics, sonic_dna")
            .eq("id", trackUuid)
            .single();
          const freshSonicDna = freshRow?.sonic_dna as Record<string, unknown> | null;
          const freshLyrics = freshRow?.lyrics as string | null;
          if (freshSonicDna && freshLyrics) {
            const rawText = freshLyrics.replace(/^\[auto-transcribed\]\n/, "");
            const updatedSonicDna = {
              ...freshSonicDna,
              user_metadata: {
                ...(freshSonicDna.user_metadata as Record<string, unknown> || {}),
                lyrics: rawText,
              },
            };
            await supabase.from("tracks").update({ sonic_dna: updatedSonicDna }).eq("id", trackUuid);
            toast.success("Sonic DNA updated with lyrics");
          }
        } catch (err) {
          console.error("Failed to sync transcribed lyrics to sonic_dna:", err);
        }
      } else {
        throw new Error(json.error || "Transcription failed");
      }
    } catch (err) {
      console.error("Transcription failed:", err);
      toast.warning("Lyrics transcription failed");
    }
  };

  return (
    <SectionCard
      title="Lyrics"
      icon={FileText}
      action={
        readOnly ? undefined :
        <div className="flex items-center gap-2">
          {hasLyrics && !isEditing && (
            <>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button
                onClick={() => {
                  if (segments && segments.length > 0) {
                    setEditLines(segments.map((s) => ({ ...s })));
                    setSyncedEditMode(true);
                  } else {
                    setEditValue(rawLyrics);
                    setSyncedEditMode(false);
                  }
                  setIsEditing(true);
                }}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={handleTranscribe}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Mic className="w-3.5 h-3.5" /> Re-transcribe
              </button>
            </>
          )}
          {!isEditing && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Upload className="w-3.5 h-3.5" /> Import File
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="p-5">
        {isEditing ? (
          <div className="space-y-4">
            {syncedEditMode ? (
              <div className="space-y-0.5">
                {/* Add line at beginning */}
                <div className="flex justify-center py-0.5">
                  <button
                    onClick={() => {
                      const firstStart = editLines.length > 0 ? editLines[0].start : 0;
                      const newStart = Math.max(0, firstStart - 1);
                      setEditLines([{ start: newStart, end: firstStart, text: "" }, ...editLines]);
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Add line at beginning"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {editLines.map((line, i) => (
                  <div key={i} className="group/line">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/50 w-10 text-right tabular-nums flex-shrink-0">
                        {Math.floor(line.start / 60) + ":" + String(Math.floor(line.start % 60)).padStart(2, "0")}
                      </span>
                      <input
                        type="text"
                        value={line.text}
                        onChange={(e) => {
                          const updated = [...editLines];
                          updated[i] = { ...updated[i], text: e.target.value };
                          setEditLines(updated);
                        }}
                        className="flex-1 bg-secondary/50 border border-transparent focus:border-border rounded px-2 py-1 text-sm leading-relaxed outline-none transition-colors"
                        placeholder="Enter lyrics…"
                      />
                      <button
                        onClick={() => setEditLines(editLines.filter((_, j) => j !== i))}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/line:opacity-100"
                        title="Remove line"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Add line between */}
                    <div className="flex justify-center py-0.5 opacity-0 group-hover/line:opacity-100 hover:!opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          const currEnd = editLines[i].end;
                          const nextStart = i + 1 < editLines.length ? editLines[i + 1].start : currEnd + 1;
                          const interpolated = (currEnd + nextStart) / 2;
                          const newLines = [...editLines];
                          newLines.splice(i + 1, 0, { start: interpolated, end: nextStart, text: "" });
                          setEditLines(newLines);
                        }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Add line"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Type or paste your lyrics here…\n\n[Verse 1]\nYour lyrics...\n\n[Chorus]\n..."
                className="min-h-[400px] bg-secondary border-border font-mono text-sm leading-relaxed resize-y"
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save Lyrics
              </button>
            </div>
          </div>
        ) : hasLyrics ? (
          <div>
            {isAutoTranscribed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-primary/10 text-primary mb-3">
                <Mic className="w-3 h-3" /> Auto-transcribed
              </span>
            )}
            {hasSyncedLyrics ? (
              <div
                ref={lyricsContainerRef}
                className="max-h-[500px] overflow-y-auto space-y-1 scroll-smooth"
              >
                {segments.map((seg, i) => {
                  const isActive = isThisTrackPlaying && currentTime >= seg.start && currentTime < seg.end;
                  const isPast = isThisTrackPlaying && !isActive && currentTime >= seg.end;
                  const isFuture = !isThisTrackPlaying || (!isActive && !isPast);
                  return (
                    <div
                      key={i}
                      ref={isActive ? activeLineRef : undefined}
                      onClick={() => handleSegmentClick(seg)}
                      className={
                        "py-1.5 px-2 rounded-md cursor-pointer text-sm leading-relaxed transition-all duration-300 " +
                        (isActive
                          ? "bg-brand-orange/10 font-semibold scale-[1.02] origin-left"
                          : "hover:bg-secondary/50") +
                        (isPast ? " text-foreground" : "") +
                        (isFuture && !isActive ? " text-muted-foreground" : "")
                      }
                    >
                      {isActive ? (
                        <span className="bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange bg-clip-text text-transparent drop-shadow-[0_0_8px_hsl(var(--brand-orange)/0.4)]">
                          {seg.text}
                        </span>
                      ) : (
                        seg.text
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                {rawLyrics}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No lyrics yet</p>
              {!readOnly && <p className="text-xs text-muted-foreground/60 mt-1">Write lyrics or import from a file</p>}
            </div>
            {!readOnly && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Write Lyrics
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Import File
              </button>
              <button
                onClick={handleTranscribe}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                <Mic className="w-3.5 h-3.5" /> Transcribe Lyrics
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}


interface SignatureStatus {
  id: string;
  collaborator_name: string;
  collaborator_email: string;
  status: string;
  signed_at: string | null;
  signature_data: string | null;
  split_share: number;
}

interface StudioSubmission {
  id: string;
  full_name: string;
  email: string;
  artist_name: string | null;
  roles: string[];
  pro_name: string | null;
  ipi_number: string | null;
  publisher_name: string | null;
  proposed_split: number;
  justification: string | null;
  status: string;
  created_at: string;
}

function SplitsTab({ trackId, trackUuid, readOnly }: { trackId: number; trackUuid?: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { permissions: splitsPermissions } = useRole();
  const { getTrack, updateTrackSplits } = useTrack();
  const trackData = getTrack(trackId);
  const splits = trackData?.splits || [];
  const totalShares = splits.reduce((sum, s) => sum + s.share, 0);
  const [editing, setEditing] = useState(false);
  const [editSplits, setEditSplits] = useState<TrackSplit[]>([]);

  // Studio submissions
  const [submissions, setSubmissions] = useState<StudioSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Signature requests
  const [signatureStatuses, setSignatureStatuses] = useState<SignatureStatus[]>([]);
  const [sendingSignatures, setSendingSignatures] = useState(false);
  const [viewSignature, setViewSignature] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [sendingExecuted, setSendingExecuted] = useState(false);
  const [executedSent, setExecutedSent] = useState(false);

  const fetchSubmissions = useCallback(function () {
    if (!trackUuid) return;
    setLoadingSubs(true);
    supabase
      .from("studio_submissions")
      .select("*")
      .eq("track_id", trackUuid)
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          // Table may not exist yet — silently fail
          setLoadingSubs(false);
          return;
        }
        if (res.data) setSubmissions(res.data as StudioSubmission[]);
        setLoadingSubs(false);
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid]);

  var fetchSignatures = useCallback(function () {
    if (!trackUuid) return;
    supabase
      .from("signature_requests")
      .select("id, collaborator_name, collaborator_email, status, signed_at, signature_data, split_share")
      .eq("track_id", trackUuid)
      .then(function (res) {
        if (!res.data) return;
        // Deduplicate: keep best status per collaborator_email (signed > pending)
        var best: Record<string, SignatureStatus> = {};
        (res.data as SignatureStatus[]).forEach(function (sig) {
          var key = sig.collaborator_email || sig.collaborator_name;
          var existing = best[key];
          if (!existing || sig.status === "signed") {
            best[key] = sig;
          }
        });
        setSignatureStatuses(Object.values(best));
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid]);

  useEffect(function () {
    fetchSubmissions();
    fetchSignatures();

    // Auto-refresh signatures every 30s
    var interval = setInterval(fetchSignatures, 30000);

    // Refresh on tab focus
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchSignatures();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return function () {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchSubmissions, fetchSignatures]);

  // Auto-balance: distribute 100% equally among all collaborators
  var equalBalance = function (allSplits: TrackSplit[]): TrackSplit[] {
    var count = allSplits.length;
    if (count === 0) return allSplits;
    var each = parseFloat((100 / count).toFixed(2));
    var total = parseFloat((each * count).toFixed(2));
    var diff = parseFloat((100 - total).toFixed(2));
    return allSplits.map(function (s, i) {
      return { ...s, share: i === 0 ? parseFloat((each + diff).toFixed(2)) : each };
    });
  };

  var handleAcceptSubmission = useCallback(function (sub: StudioSubmission) {
    // Create new split from submission
    var newSplit: TrackSplit = {
      id: crypto.randomUUID(),
      name: sub.full_name,
      email: sub.email || "",
      role: sub.roles.join(", "),
      share: 0,
      pro: sub.pro_name || "",
      ipi: sub.ipi_number || "",
      publisher: sub.publisher_name || "",
    };
    // Auto-balance ALL splits equally (existing + new)
    var balanced = equalBalance([...splits, newSplit]);
    updateTrackSplits(trackId, balanced);

    supabase
      .from("studio_submissions")
      .update({ status: "accepted" })
      .eq("id", sub.id)
      .then(function () {
        fetchSubmissions();
      }).catch(function (err) { console.error("Error:", err); });
  }, [splits, trackId, updateTrackSplits, fetchSubmissions]);

  var handleAcceptAll = useCallback(function () {
    // Accept all pending submissions at once with equal balance
    var newSplits = pendingSubs.map(function (sub) {
      return {
        id: crypto.randomUUID(),
        name: sub.full_name,
        email: sub.email || "",
        role: sub.roles.join(", "),
        share: 0,
        pro: sub.pro_name || "",
        ipi: sub.ipi_number || "",
        publisher: sub.publisher_name || "",
      } as TrackSplit;
    });
    var balanced = equalBalance([...splits, ...newSplits]);
    updateTrackSplits(trackId, balanced);

    // Mark all pending as accepted
    var ids = pendingSubs.map(function (s) { return s.id; });
    supabase
      .from("studio_submissions")
      .update({ status: "accepted" })
      .in("id", ids)
      .then(function () {
        fetchSubmissions();
      }).catch(function (err) { console.error("Error:", err); });
  }, [splits, pendingSubs, trackId, updateTrackSplits, fetchSubmissions]);

  var handleRejectSubmission = useCallback(function (subId: string) {
    supabase
      .from("studio_submissions")
      .update({ status: "rejected" })
      .eq("id", subId)
      .then(function () {
        fetchSubmissions();
      }).catch(function (err) { console.error("Error:", err); });
  }, [fetchSubmissions]);

  var allSplitsHaveEmail = splits.length > 0 && splits.every(function (s) { return s.email && s.email.indexOf("@") > 0; });
  var allSigned = signatureStatuses.length > 0 && signatureStatuses.every(function (s) { return s.status === "signed"; });

  // Detect if splits have changed since signatures were sent (compare shares)
  var splitsMatchSignatures = allSigned && signatureStatuses.every(function (sig) {
    var matchingSplit = splits.find(function (s) { return (s.email && s.email === sig.collaborator_email) || s.name === sig.collaborator_name; });
    return matchingSplit && matchingSplit.share === sig.split_share;
  });
  var effectiveExecutedSent = executedSent && splitsMatchSignatures;

  var handleSendForSignature = useCallback(function () {
    if (!trackUuid || splits.length < 1 || totalShares !== 100) return;
    if (!allSplitsHaveEmail) return;
    setSendingSignatures(true);

    // Use emails directly from splits (already stored in DB)
    var splitsPayload = splits.map(function (s) {
      return {
        name: s.name,
        email: s.email || "",
        role: s.role,
        share: s.share,
        pro: s.pro || "",
        ipi: s.ipi || "",
        publisher: s.publisher || "",
      };
    });

    // Call Edge Function to insert signature_requests AND send emails
    supabase.functions
      .invoke("send-split-signature", {
        body: { track_id: trackUuid, splits: splitsPayload },
      })
      .then(function (res) {
        setSendingSignatures(false);
        if (res.error) {
          toast.error(t("signature.signaturesSentError"));
          return;
        }
        var sentCount = (res.data && res.data.sent) || splitsPayload.length;
        toast.success(t("signature.signaturesSent", { count: sentCount }));
        fetchSignatures();
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid, splits, totalShares, allSplitsHaveEmail, t, fetchSignatures]);

  var handleSendExecutedCopies = useCallback(function () {
    if (!trackUuid) return;
    setSendingExecuted(true);

    // Build PDF entries from signatureStatuses + splits (same as Download Agreement PDF)
    var entries = signatureStatuses.map(function (sig) {
      var matchingSplit = splits.find(function (s) { return (s.email && s.email === sig.collaborator_email) || s.name === sig.collaborator_name; });
      return {
        name: sig.collaborator_name,
        role: matchingSplit ? matchingSplit.role : "",
        share: sig.split_share,
        pro: matchingSplit ? matchingSplit.pro : "",
        ipi: matchingSplit ? matchingSplit.ipi : "",
        publisher: matchingSplit ? matchingSplit.publisher : "",
        signatureData: sig.signature_data,
        signedAt: sig.signed_at,
      };
    });

    // Generate PDF base64 then send to edge function
    import("@/lib/pdf-generators")
      .then(function (mod) {
        return mod.generateSignedAgreementPdfBase64(trackData?.title || "", trackData?.artist || "", entries);
      })
      .catch(function (e) {
        console.error("PDF generation failed, sending without attachment:", e);
        return undefined;
      })
      .then(function (pdfBase64) {
        return supabase.functions.invoke("send-executed-splits", {
          body: { track_id: trackUuid, pdf_base64: pdfBase64 },
        });
      })
      .then(function (res) {
        setSendingExecuted(false);
        if (res.error) {
          var errorMsg = (res.data && res.data.error) || res.error.message || t("signature.executedSentError");
          toast.error(errorMsg);
          return;
        }
        var sentCount = (res.data && res.data.sent) || 0;
        toast.success(t("signature.executedSent", { count: sentCount }));
        setExecutedSent(true);
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid, t, signatureStatuses, splits, trackData]);

  var pendingSubs = submissions.filter(function (s) { return s.status === "pending"; });
  var processedSubs = submissions.filter(function (s) { return s.status !== "pending"; });

  // Extracted submissions section — rendered in ALL return paths so it's never skipped by early returns
  function renderStudioSubmissions() {
    if (!trackUuid) return null;
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-foreground">{t("studioQr.pendingSubmissions")}</h4>
            {pendingSubs.length > 0 && (
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-orange/15 text-brand-orange">
                {pendingSubs.length + " pending"}
              </span>
            )}
          </div>
          {pendingSubs.length > 1 && (
            <button
              onClick={handleAcceptAll}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3 h-3" />
              Accept All (Equal Split)
            </button>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Pending submissions */}
          {pendingSubs.length > 0 && (
            <div className="divide-y divide-border">
              {pendingSubs.map(function (sub) {
                return (
                  <div key={sub.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{sub.full_name}</p>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-orange/12 text-brand-orange">pending</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{sub.email}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {sub.roles.map(function (role) {
                            return <span key={role} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground/70">{role}</span>;
                          })}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                          {sub.pro_name && <span>PRO: {sub.pro_name}</span>}
                          {sub.ipi_number && <span>IPI: {sub.ipi_number}</span>}
                          {sub.publisher_name && <span>Publisher: {sub.publisher_name}</span>}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{new Date(sub.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={function () { handleAcceptSubmission(sub); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"><CheckCircle2 className="w-3 h-3 inline mr-1" />{t("studioQr.accept")} (Equal Split)</button>
                      <button onClick={function () { handleRejectSubmission(sub.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">{t("studioQr.reject")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {processedSubs.length > 0 && (
            <div className={"divide-y divide-border" + (pendingSubs.length > 0 ? " border-t border-border" : "")}>
              {processedSubs.map(function (sub) {
                var isAccepted = sub.status === "accepted";
                return (
                  <div key={sub.id} className={"px-5 py-3.5 " + (isAccepted ? "opacity-60" : "opacity-40")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={"w-2 h-2 rounded-full " + (isAccepted ? "bg-emerald-400" : "bg-destructive")} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{sub.roles.join(", ")}</p>
                        </div>
                      </div>
                      <span className={"inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold " + (isAccepted ? "bg-emerald-500/12 text-emerald-400" : "bg-destructive/12 text-destructive")}>{isAccepted ? "Accepted" : "Rejected"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {loadingSubs && (
            <div className="px-5 py-6 text-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            </div>
          )}
          {!loadingSubs && submissions.length === 0 && (
            <div className="px-5 py-6 text-center">
              <Users className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("studioQr.noSubmissions")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setEditSplits(splits.length ? splits.map(s => ({ ...s })) : [{ id: "1", name: "", email: "", role: "", share: 100, pro: "", ipi: "", publisher: "" }]);
    setEditing(true);
  };

  const redistributeSplits = (updated: TrackSplit[], changedId?: string): TrackSplit[] => {
    if (!changedId) {
      const equal = parseFloat((100 / updated.length).toFixed(2));
      const total = parseFloat((equal * updated.length).toFixed(2));
      const diff = parseFloat((100 - total).toFixed(2));
      return updated.map((s, i) => ({ ...s, share: i === 0 ? parseFloat((equal + diff).toFixed(2)) : equal }));
    }
    const changed = updated.find((s) => s.id === changedId);
    const others = updated.filter((s) => s.id !== changedId);
    const remaining = parseFloat(Math.max(0, 100 - (changed?.share || 0)).toFixed(2));
    if (others.length === 0) return updated;
    const each = parseFloat((remaining / others.length).toFixed(2));
    const total = parseFloat((each * others.length).toFixed(2));
    const diff = parseFloat((remaining - total).toFixed(2));
    let idx = 0;
    return updated.map((s) => {
      if (s.id === changedId) return s;
      const val = idx === 0 ? parseFloat((each + diff).toFixed(2)) : each;
      idx++;
      return { ...s, share: val };
    });
  };

  const addSplit = () => {
    const newSplits = [...editSplits, { id: crypto.randomUUID(), name: "", email: "", role: "", share: 0, pro: "", ipi: "", publisher: "" }];
    setEditSplits(redistributeSplits(newSplits));
  };

  const updateSplit = (id: string, field: keyof TrackSplit, value: string | number) => {
    const updated = editSplits.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    if (field === "share") {
      setEditSplits(redistributeSplits(updated, id));
    } else {
      setEditSplits(updated);
    }
  };

  const removeSplit = (id: string) => {
    if (editSplits.length <= 1) return;
    setEditSplits(redistributeSplits(editSplits.filter((s) => s.id !== id)));
  };

  const saveSplits = () => {
    var filtered = editSplits.filter(function (s) { return s.name.trim(); });
    var total = filtered.reduce(function (sum, s) { return sum + (Number(s.share) || 0); }, 0);
    var roundedTotal = parseFloat(total.toFixed(2));
    if (roundedTotal !== 100 && filtered.length > 0) {
      toast.error("Total splits must equal 100% (currently " + roundedTotal + "%)");
      return;
    }
    updateTrackSplits(trackId, filtered);
    setEditing(false);
  };

  const editTotalShares = editSplits.reduce((sum, s) => sum + (Number(s.share) || 0), 0);

  const saveInlineEmail = (splitId: string) => {
    var trimmed = editingEmailValue.trim();
    if (trimmed && trimmed.indexOf("@") <= 0) return;
    var updated = splits.map(function (s) {
      return s.id === splitId ? { ...s, email: trimmed } : s;
    });
    updateTrackSplits(trackId, updated);
    setEditingEmailId(null);
    setEditingEmailValue("");
  };

  const handleDownloadPdf = () => {
    if (!trackData) return;
    generateSplitsPdf(trackData.title, trackData.artist, splits, totalShares);
  };

  // Inline editing mode
  if (editing) {
    return (
      <div>
      <SectionCard title="Publishing & Ownership Splits" icon={PieChart}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={saveSplits} disabled={parseFloat(editTotalShares.toFixed(2)) !== 100 && editSplits.filter(function (s) { return s.name.trim(); }).length > 0} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"><CheckCircle2 className="w-3 h-3" /> Save</button>
          </div>
        }
      >
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xs text-muted-foreground">Add collaborators and assign ownership splits</p>
            <div className="text-right">
              <span className={"text-xs font-bold tabular-nums " + (editTotalShares === 100 ? "text-emerald-400" : editTotalShares > 100 ? "text-destructive" : "text-brand-orange")}>{parseFloat(editTotalShares.toFixed(2))}%</span>
              {parseFloat(editTotalShares.toFixed(2)) !== 100 && editSplits.filter(function (s) { return s.name.trim(); }).length > 0 && (
                <p className="text-[10px] text-destructive mt-0.5">Total must equal 100%</p>
              )}
            </div>
          </div>
          {editSplits.map((split, idx) => (
            <div key={split.id} className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center">
                    <Users className="w-3 h-3 text-brand-orange" />
                  </div>
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Contributor {idx + 1}</span>
                </div>
                {editSplits.length > 1 && (
                  <button onClick={() => removeSplit(split.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">Name</label>
                  <input value={split.name} onChange={(e) => updateSplit(split.id, "name", e.target.value)} placeholder="Full name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">Email</label>
                  <input type="email" value={split.email || ""} onChange={(e) => updateSplit(split.id, "email", e.target.value)} placeholder={t("signature.emailPlaceholder")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">Role</label>
                  <input value={split.role} onChange={(e) => updateSplit(split.id, "role", e.target.value)} placeholder="e.g. Producer" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">Split %</label>
                  <input type="number" min={0} max={100} step={0.01} value={split.share} onChange={(e) => updateSplit(split.id, "share", parseFloat(e.target.value) || 0)} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-mono font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">PRO</label>
                  <input value={split.pro} onChange={(e) => updateSplit(split.id, "pro", e.target.value)} placeholder="e.g. ASCAP" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">IPI</label>
                  <input value={split.ipi} onChange={(e) => updateSplit(split.id, "ipi", e.target.value)} placeholder="IPI number" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs text-muted-foreground font-medium">Publisher</label>
                  <input value={split.publisher} onChange={(e) => updateSplit(split.id, "publisher", e.target.value)} placeholder="Publisher name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addSplit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-brand-orange/30 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all w-full justify-center">
            <Plus className="w-3.5 h-3.5" /> Add Contributor
          </button>
        </div>
      </SectionCard>
      {renderStudioSubmissions()}
      </div>
    );
  }

  // Empty state with add button
  if (splits.length === 0) {
    return (
      <div>
      <SectionCard title="Publishing & Ownership Splits" icon={PieChart}>
        <div className="px-5 py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-secondary/80 flex items-center justify-center mx-auto">
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">No splits configured yet</p>
            {!readOnly && splitsPermissions.canManageSplits && <p className="text-xs text-muted-foreground">Add collaborators and assign ownership percentages</p>}
          </div>
          {!readOnly && splitsPermissions.canManageSplits && (
          <button onClick={startEditing} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold btn-brand">
            <Plus className="w-3.5 h-3.5" /> Add Splits
          </button>
          )}
        </div>
      </SectionCard>
      {!readOnly && renderStudioSubmissions()}
      </div>
    );
  }

  // Display mode
  return (
    <div className="space-y-4">
      <SectionCard
        title="Publishing & Ownership Splits"
        icon={PieChart}
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Download className="w-3.5 h-3.5" /> {t("signature.downloadUnsignedPdf")}
            </button>
            {!readOnly && splitsPermissions.canManageSplits && <button onClick={startEditing} className="text-xs text-primary hover:underline">{t("signature.editSplits")}</button>}
          </div>
        }
      >
        {/* Visual bar */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {splits.map((s, i) => {
              const colors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
              return <div key={s.name + i} className={colors[i % colors.length] + " rounded-full"} style={{ width: s.share + "%" }} />;
            })}
          </div>
        </div>
        {/* All signed badge */}
        {allSigned && (
          <div className="px-5 py-2.5 bg-emerald-500/8 border-b border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">{t("signature.allSigned")}</span>
          </div>
        )}
        <div className="divide-y divide-border">
          {splits.map(function (s, i) {
            var dotColors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
            var sigStatus = signatureStatuses.find(function (sig) { return (s.email && sig.collaborator_email === s.email) || sig.collaborator_name === s.name; });
            var isEditingThisEmail = editingEmailId === s.id;
            var hasNoEmail = !s.email || s.email.indexOf("@") <= 0;
            return (
              <div key={s.id || s.name + i} className={"flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors" + (hasNoEmail && splits.length >= 1 && totalShares === 100 ? " bg-destructive/5" : "")}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={"w-2.5 h-2.5 rounded-full shrink-0 " + dotColors[i % dotColors.length]} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    {splitsPermissions.canManageSplits && isEditingThisEmail ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          type="email"
                          autoFocus
                          value={editingEmailValue}
                          onChange={function (e) { setEditingEmailValue(e.target.value); }}
                          onKeyDown={function (e) {
                            if (e.key === "Enter") saveInlineEmail(s.id);
                            if (e.key === "Escape") { setEditingEmailId(null); setEditingEmailValue(""); }
                          }}
                          onBlur={function () { saveInlineEmail(s.id); }}
                          placeholder={t("signature.emailPlaceholder")}
                          className="h-6 w-48 px-2 rounded bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30"
                        />
                      </div>
                    ) : s.email ? (
                      splitsPermissions.canManageSplits ? (
                      <button
                        onClick={function () { setEditingEmailId(s.id); setEditingEmailValue(s.email || ""); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hover:text-foreground transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        {s.email}
                      </button>
                      ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="w-3 h-3" />
                        {s.email}
                      </span>
                      )
                    ) : splitsPermissions.canManageSplits ? (
                      <button
                        onClick={function () { setEditingEmailId(s.id); setEditingEmailValue(""); }}
                        className="flex items-center gap-1 text-xs text-brand-orange mt-0.5 hover:underline"
                      >
                        <Mail className="w-3 h-3" />
                        {t("signature.addEmail")}
                      </button>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">{s.role} · {s.pro || "—"} · IPI: {s.ipi || "—"}</p>
                    {sigStatus && (
                      sigStatus.status === "signed" ? (
                        <button
                          onClick={function () { setViewSignature(sigStatus.signature_data); }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 mt-1 hover:underline"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t("signature.signedOn", { date: new Date(sigStatus.signed_at || "").toLocaleDateString() })}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-orange mt-1">
                          <Clock className="w-3 h-3" />
                          {t("signature.pendingSignature")}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-foreground shrink-0">{s.share}%</span>
              </div>
            );
          })}
        </div>
        {!allSplitsHaveEmail && totalShares === 100 && splits.length >= 1 && splitsPermissions.canManageSplits && (
          <div className="px-5 py-2.5 bg-brand-orange/8 border-t border-brand-orange/20 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-brand-orange shrink-0" />
            <span className="text-xs text-brand-orange">{t("signature.missingEmails")}</span>
          </div>
        )}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className={"font-bold " + (totalShares === 100 ? "text-emerald-400" : "text-destructive")}>{totalShares}%</span>
        </div>
        {totalShares === 100 && splits.length >= 1 && !readOnly && splitsPermissions.canManageSplits && (
          <TooltipProvider delayDuration={200}>
            <div className="px-5 py-3 border-t border-border flex flex-wrap items-center gap-2">
              {/* Download Signed Splits PDF */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <button
                      onClick={function () {
                        var entries = signatureStatuses.map(function (sig) {
                          var matchingSplit = splits.find(function (s) { return (s.email && s.email === sig.collaborator_email) || s.name === sig.collaborator_name; });
                          return {
                            name: sig.collaborator_name,
                            role: matchingSplit ? matchingSplit.role : "",
                            share: sig.split_share,
                            pro: matchingSplit ? matchingSplit.pro : "",
                            ipi: matchingSplit ? matchingSplit.ipi : "",
                            publisher: matchingSplit ? matchingSplit.publisher : "",
                            signatureData: sig.signature_data,
                            signedAt: sig.signed_at,
                          };
                        });
                        import("@/lib/pdf-generators").then(function (mod) {
                          mod.generateSignedAgreementPdf(trackData?.title || "", trackData?.artist || "", entries);
                        }).catch(function (err) { console.error("Error:", err); });
                      }}
                      disabled={!allSigned}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t("signature.downloadSignedPdf")}
                    </button>
                  </span>
                </TooltipTrigger>
                {!allSigned && (
                  <TooltipContent side="top">
                    <p className="text-xs">{t("signature.allMustSignToDownload")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <span className="text-border">|</span>

              {/* Send for Signature */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <button
                      onClick={handleSendForSignature}
                      disabled={sendingSignatures || !allSplitsHaveEmail || allSigned}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingSignatures ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSignature className="w-3 h-3" />}
                      {sendingSignatures ? t("signature.sendingSignatures") : t("signature.sendForSignature")}
                    </button>
                  </span>
                </TooltipTrigger>
                {allSigned ? (
                  <TooltipContent side="top">
                    <p className="text-xs">{t("signature.allAlreadySigned")}</p>
                  </TooltipContent>
                ) : !allSplitsHaveEmail ? (
                  <TooltipContent side="top">
                    <p className="text-xs">{t("signature.allNeedEmail")}</p>
                  </TooltipContent>
                ) : null}
              </Tooltip>

              {/* Send Executed Copies */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <button
                      onClick={handleSendExecutedCopies}
                      disabled={!allSigned || sendingExecuted || effectiveExecutedSent}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingExecuted ? <Loader2 className="w-3 h-3 animate-spin" /> : effectiveExecutedSent ? <CheckCircle2 className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                      {sendingExecuted ? t("signature.sendingExecuted") : effectiveExecutedSent ? t("signature.executedSentLabel") : t("signature.sendExecutedCopies")}
                    </button>
                  </span>
                </TooltipTrigger>
                {!allSigned && !effectiveExecutedSent && (
                  <TooltipContent side="top">
                    <p className="text-xs">{t("signature.allMustSignFirst")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </TooltipProvider>
        )}
      </SectionCard>

      {/* Signature preview popover */}
      {viewSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={function () { setViewSignature(null); }}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div className="relative z-10 bg-card border border-border rounded-2xl p-6 max-w-sm" onClick={function (e) { e.stopPropagation(); }}>
            <img src={viewSignature} alt="Signature" className="w-full rounded-lg bg-white" />
            <button onClick={function () { setViewSignature(null); }} className="mt-3 w-full px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">{t("common.close")}</button>
          </div>
        </div>
      )}

      {!readOnly && renderStudioSubmissions()}
    </div>
  );
}

interface TrackDocument {
  id: string;
  name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  status: "draft" | "pending" | "signed";
  created_at: string;
  updated_at: string;
}

function PaperworkTab({ trackUuid, workspaceId }: { trackUuid: string; workspaceId: string }) {
  const [documents, setDocuments] = useState<TrackDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    if (!trackUuid || !workspaceId) return;
    try {
      const { data, error } = await supabase
        .from("track_documents")
        .select("*")
        .eq("track_id", trackUuid)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, [trackUuid, workspaceId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !trackUuid) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum size is 20MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = workspaceId + "/" + trackUuid + "/" + crypto.randomUUID() + "." + ext;

      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type });
      if (storageError) {
        alert("Storage upload failed: " + storageError.message);
        return;
      }

      const userId = (await supabase.auth.getSession()).data.session?.user?.id;

      const { error: dbError } = await supabase
        .from("track_documents")
        .insert({
          track_id: trackUuid,
          workspace_id: workspaceId,
          uploaded_by: userId,
          name: file.name.replace(/\.[^/.]+$/, ""),
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          status: "draft",
        });
      if (dbError) {
        alert("Database insert failed: " + dbError.message);
        return;
      }

      await fetchDocuments();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: TrackDocument) => {
    if (!confirm("Delete \"" + doc.name + "\"?")) return;
    try {
      await supabase.storage.from("documents").remove([doc.file_path]);
      const { error } = await supabase
        .from("track_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleOpen = async (doc: TrackDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);
      if (error) throw error;

      if (doc.mime_type && doc.mime_type.includes("pdf")) {
        const pdfBytes = await fetch(data.signedUrl).then(r => r.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        for (const page of pages) {
          const { width, height } = page.getSize();
          const fontSize = width / 4;
          const textWidth = font.widthOfTextAtSize("TRAKALOG", fontSize);

          for (let y = height * 0.2; y < height; y += height * 0.25) {
            page.drawText("TRAKALOG", {
              x: (width - textWidth * 0.7) / 2,
              y: y,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity: 0.08,
              rotate: degrees(45),
            });
          }
        }

        const watermarkedBytes = await pdfDoc.save();
        const blob = new Blob([watermarkedBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Failed to open document:", err);
    }
  };

  const handleDownload = async (doc: TrackDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);
      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const arrayBuffer = await response.arrayBuffer();

      if (doc.mime_type && doc.mime_type.includes("pdf")) {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        for (const page of pages) {
          const { width, height } = page.getSize();
          const fontSize = width / 4;
          const textWidth = font.widthOfTextAtSize("TRAKALOG", fontSize);

          for (let y = height * 0.2; y < height; y += height * 0.25) {
            page.drawText("TRAKALOG", {
              x: (width - textWidth * 0.7) / 2,
              y: y,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity: 0.08,
              rotate: degrees(45),
            });
          }
        }

        const watermarkedBytes = await pdfDoc.save();
        const blob = new Blob([watermarkedBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (doc.file_name || doc.name + ".pdf");
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([arrayBuffer], { type: doc.mime_type || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (doc.file_name || doc.name);
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download document:", err);
      alert("Download failed. Please try again.");
    }
  };

  const cycleStatus = async (doc: TrackDocument) => {
    const next: Record<string, string> = { draft: "pending", pending: "signed", signed: "draft" };
    const newStatus = next[doc.status] || "draft";
    try {
      const { error } = await supabase
        .from("track_documents")
        .update({ status: newStatus })
        .eq("id", doc.id);
      if (error) throw error;
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, status: newStatus as TrackDocument["status"] } : d))
      );
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending: "Pending",
    signed: "Signed",
  };

  return (
    <SectionCard
      title="Documents & Contracts"
      icon={Paperclip}
      action={
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> Upload
            </>
          )}
        </button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
        onChange={handleUpload}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No documents yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Upload contracts, split sheets, licenses, and other paperwork.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Document
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(doc.file_size)} · {formatDate(doc.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <button
                  onClick={() => cycleStatus(doc)}
                  className={"inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity " + docStatusColors[statusLabels[doc.status]]}
                >
                  {statusLabels[doc.status]}
                </button>
                <button
                  onClick={() => handleOpen(doc)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Open"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function PitchHistoryTab({ trackId }: { trackId: number }) {
  const { getTrack } = useTrack();
  const { getPitchesForTrack } = usePitches();
  const trackData = getTrack(trackId);
  const trackPitches = trackData ? getPitchesForTrack(trackData.title) : [];

  return (
    <SectionCard
      title="Pitch History"
      icon={Send}
      action={
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity">
          <Send className="w-3.5 h-3.5" /> New Pitch
        </button>
      }
    >
      {trackPitches.length === 0 ? (
        <div className="px-5 py-12 text-center text-muted-foreground text-sm">No pitches made for this track yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {trackPitches.map((pitch) => (
            <div key={pitch.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  {pitch.status === "Responded" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : pitch.status === "Draft" ? (
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-brand-orange" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{pitch.recipientCompany} <span className="text-muted-foreground font-normal">— {pitch.recipientName}</span></p>
                  <p className="text-[11px] text-muted-foreground">
                    {pitch.date}
                    {pitch.notes && <span className="ml-2 text-foreground/60">· {pitch.notes}</span>}
                  </p>
                </div>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${pitchStatusColors[pitch.status] || "bg-muted text-muted-foreground"}`}>
                {pitch.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const statusOptions = [
  { value: "Available", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400", description: "Track is available for pitching and licensing" },
  { value: "On Hold", icon: Clock, color: "bg-brand-orange/15 text-brand-orange", description: "Waiting on clearance, features, or label decision" },
  { value: "Released", icon: Disc3, color: "bg-primary/15 text-primary", description: "Publicly available on all platforms" },
];

function StatusTab({ trackId }: { trackId: number }) {
  const { getTrack, updateTrackStatus } = useTrack();
  const trackData = getTrack(trackId);
  const currentStatus = trackData?.status || "Available";
  const statusHistory = trackData?.statusHistory || [];
  const [statusNote, setStatusNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setShowNoteInput(newStatus);
  };

  const confirmStatusChange = () => {
    if (showNoteInput) {
      updateTrackStatus(trackId, showNoteInput, statusNote.trim() || "Status updated");
      setShowNoteInput(null);
      setStatusNote("");
    }
  };

  return (
    <SectionCard
      title="Track Status"
      icon={Activity}
    >
      {/* Current status */}
      <div className="px-5 py-5 border-b border-border">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Current Status</p>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => {
            const isActive = opt.value === currentStatus;
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isActive
                    ? `${opt.color} border-current`
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                <opt.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{opt.value}</span>
              </button>
            );
          })}
        </div>

        {/* Note input when changing status */}
        {showNoteInput && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Add a note for this status change:</p>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="e.g. Clearance received"
              className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-all"
              onKeyDown={(e) => e.key === "Enter" && confirmStatusChange()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={confirmStatusChange}
                className="px-4 py-2 rounded-lg text-xs font-semibold btn-brand"
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowNoteInput(null); setStatusNote(""); }}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-5 py-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-4">History</p>
        <div className="space-y-0">
          {statusHistory.map((entry, i) => {
            const opt = statusOptions.find((o) => o.value === entry.status);
            const isLast = i === statusHistory.length - 1;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isLast ? "bg-primary/15" : "bg-secondary"}`}>
                    {opt && <opt.icon className={`w-3.5 h-3.5 ${isLast ? "text-primary" : "text-muted-foreground"}`} />}
                  </div>
                  {!isLast && <div className="w-px h-8 bg-border" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-medium text-foreground">{entry.status}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.date} · {entry.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function StatusHistoryTimeline({ trackId }: { trackId: number }) {
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  const statusHistory = trackData?.statusHistory || [];

  return (
    <div className="space-y-0">
      {statusHistory.map((entry, i) => {
        const opt = statusOptions.find((o) => o.value === entry.status);
        const isLast = i === statusHistory.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={"w-7 h-7 rounded-full flex items-center justify-center shrink-0 " + (isLast ? "bg-primary/15" : "bg-secondary")}>
                {opt && <opt.icon className={"w-3.5 h-3.5 " + (isLast ? "text-primary" : "text-muted-foreground")} />}
              </div>
              {!isLast && <div className="w-px h-8 bg-border" />}
            </div>
            <div className="pb-6">
              <p className="text-sm font-medium text-foreground">{entry.status}</p>
              <p className="text-[11px] text-muted-foreground">{entry.date} · {entry.note}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── ENGAGEMENT TAB ─── */
function EngagementTab({ trackId, onSeek }: { trackId: number; onSeek?: (seconds: number, totalDuration: number) => void }) {
  const { getTrackEngagement } = useEngagement();
  const { getCommentsForTrack } = useTrackReview();
  const { getTrack } = useTrack();
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);
  const engagement = getTrackEngagement(trackId);

  // Fetch link_events for this track
  const trackUuid = getTrack(trackId)?.uuid;
  const trackComments = trackUuid ? getCommentsForTrack(trackUuid) : [];
  const [linkEvents, setLinkEvents] = useState<{ event_type: string; visitor_email: string | null; created_at: string }[]>([]);

  useEffect(function() {
    if (!trackUuid) return;
    supabase
      .from("link_events")
      .select("event_type, visitor_email, created_at")
      .eq("track_id", trackUuid)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(function(res) {
        if (res.data) setLinkEvents(res.data);
      }).catch(function (err) { console.error("Error:", err); });
  }, [trackUuid]);

  var linkPlays = linkEvents.filter(function(e) { return e.event_type === "play"; }).length;
  var linkDownloads = linkEvents.filter(function(e) { return e.event_type === "download"; }).length;
  var linkSaves = linkEvents.filter(function(e) { return e.event_type === "save"; }).length;
  var uniqueListeners = new Set(linkEvents.filter(function(e) { return e.visitor_email; }).map(function(e) { return e.visitor_email; })).size;

  // Build comment engagement events
  const commentEvents = trackComments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  const authorTypeBadge: Record<string, { label: string; className: string }> = {
    owner: { label: "Owner", className: "bg-brand-orange/15 text-brand-orange" },
    team_member: { label: "Team", className: "bg-brand-purple/15 text-brand-purple" },
    recipient: { label: "Recipient", className: "bg-primary/15 text-primary" },
    guest_recipient: { label: "Guest", className: "bg-muted text-muted-foreground" },
  };

  if ((!engagement || engagement.totalPlays === 0) && commentEvents.length === 0 && linkEvents.length === 0) {
    return (
      <SectionCard title="Engagement" icon={Headphones}>
        <div className="text-center py-12 text-muted-foreground">
          <Headphones className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold">No engagement yet</p>
          <p className="text-xs mt-1 text-muted-foreground/60">Share this track to start tracking plays and downloads</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {engagement && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="card-premium p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-pink/12 flex items-center justify-center">
                <Headphones className="w-4 h-4 text-brand-pink" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Total Plays</p>
                <p className="text-xl font-bold text-foreground">{engagement.totalPlays}</p>
              </div>
            </div>
          </div>
          <div className="card-premium p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-chart-5/12 flex items-center justify-center">
                <Download className="w-4 h-4 text-chart-5" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Downloads</p>
                <p className="text-xl font-bold text-foreground">{engagement.totalDownloads}</p>
              </div>
            </div>
          </div>
          {linkSaves > 0 && (
            <div className="card-premium p-4 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-purple/12 flex items-center justify-center">
                  <Bookmark className="w-4 h-4 text-brand-purple" />
                </div>
                <div>
                  <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Saves</p>
                  <p className="text-xl font-bold text-foreground">{linkSaves}</p>
                </div>
              </div>
            </div>
          )}
          <div className="card-premium p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-purple/12 flex items-center justify-center">
                <Users className="w-4 h-4 text-brand-purple" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Recipients</p>
                <p className="text-xl font-bold text-foreground">{engagement.recipients.length}</p>
              </div>
            </div>
          </div>
          <div className="card-premium p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-orange/12 flex items-center justify-center">
                <Eye className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Avg Plays</p>
                <p className="text-xl font-bold text-foreground">{Math.round(engagement.totalPlays / engagement.recipients.length)}</p>
              </div>
            </div>
          </div>
          <div className="card-premium p-4 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-accent/12 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">Comments</p>
                <p className="text-xl font-bold text-foreground">{trackComments.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared link activity */}
      {linkEvents.length > 0 && (
        <SectionCard title="Shared Link Activity" icon={Activity}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <Play className="w-4 h-4 text-brand-pink mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{linkPlays}</p>
              <p className="text-2xs text-muted-foreground">Plays</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <Download className="w-4 h-4 text-chart-5 mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{linkDownloads}</p>
              <p className="text-2xs text-muted-foreground">Downloads</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <Users className="w-4 h-4 text-brand-purple mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{uniqueListeners}</p>
              <p className="text-2xs text-muted-foreground">Unique Listeners</p>
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {linkEvents.map(function(evt, i) {
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                  {evt.event_type === "play" ? (
                    <Play className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-chart-5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">
                      <span className="font-semibold">{evt.visitor_email || "Anonymous"}</span>
                      {" " + (evt.event_type === "play" ? "played" : "downloaded") + " this track"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {new Date(evt.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Comment activity feed */}
      {commentEvents.length > 0 && (
        <SectionCard title="Review Activity" icon={MessageSquare}>
          <div className="divide-y divide-border/50">
            {commentEvents.map((c) => {
              const badge = authorTypeBadge[c.authorType] || authorTypeBadge.recipient;
              return (
                <div key={c.id} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <button
                    onClick={() => onSeek?.(c.timestampSeconds, 1)}
                    className="shrink-0 px-2 py-1 rounded-md bg-secondary hover:bg-primary/15 text-xs font-mono font-bold text-primary transition-colors mt-0.5"
                    title="Jump to this moment"
                  >
                    {c.timestampLabel}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-foreground">{c.authorName}</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/70 line-clamp-2">{c.commentText}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Recipient breakdown */}
      {engagement && (
        <SectionCard title="Recipient Breakdown" icon={Users}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Recipient Breakdown</h3>
            <span className="text-2xs text-muted-foreground">{engagement.recipients.length} recipients</span>
          </div>
          <div className="space-y-1">
            {engagement.recipients
              .sort((a, b) => b.plays - a.plays)
              .map((r) => {
                const isExpanded = expandedRecipient === r.recipientName;
                return (
                  <div key={r.recipientName} className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedRecipient(isExpanded ? null : r.recipientName)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary-foreground">
                          {r.recipientName.split(" ").map((n) => n[0]).join("").toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{r.recipientName}</p>
                        <p className="text-2xs text-muted-foreground truncate">{r.recipientCompany}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-pink">
                          <Headphones className="w-3 h-3" /> {r.plays}
                        </span>
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-chart-5">
                          <Download className="w-3 h-3" /> {r.downloads}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0 ml-11 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-2xs text-muted-foreground">Plays</p>
                          <p className="text-sm font-bold text-foreground">{r.plays}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-2xs text-muted-foreground">Downloads</p>
                          <p className="text-sm font-bold text-foreground">{r.downloads}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-2xs text-muted-foreground">Pack Downloads</p>
                          <p className="text-sm font-bold text-foreground">{r.packDownloads}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-2xs text-muted-foreground">Stem Downloads</p>
                          <p className="text-sm font-bold text-foreground">{r.stemDownloads}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-4 bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-2xs text-muted-foreground">Last Activity</p>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(r.lastActivity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" · "}
                            {new Date(r.lastActivity).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ─── Unified Activity Timeline ─── */

interface ActivityEvent {
  id: string;
  type: "pitch" | "play" | "download" | "shared_link" | "signature" | "studio" | "comment";
  label: string;
  date: Date;
}

var activityEventConfig: Record<ActivityEvent["type"], { icon: React.ElementType; color: string; bg: string }> = {
  pitch:       { icon: Send,          color: "text-brand-orange", bg: "bg-brand-orange/12" },
  play:        { icon: Play,          color: "text-brand-pink",   bg: "bg-brand-pink/12" },
  download:    { icon: Download,      color: "text-chart-5",      bg: "bg-chart-5/12" },
  shared_link: { icon: Link2,         color: "text-primary",      bg: "bg-primary/12" },
  signature:   { icon: PenLine,       color: "text-emerald-400",  bg: "bg-emerald-400/12" },
  studio:      { icon: QrCode,        color: "text-brand-purple", bg: "bg-brand-purple/12" },
  comment:     { icon: MessageCircle, color: "text-accent",       bg: "bg-accent/12" },
};

function formatRelativeTime(date: Date): string {
  var now = Date.now();
  var diff = now - date.getTime();
  var sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  var min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  var hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs + "h ago";
  var days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return days + "d ago";
  var months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  return Math.floor(months / 12) + "y ago";
}

function ActivityTimeline({ trackId, trackUuid }: { trackId: number; trackUuid: string }) {
  var { getTrack } = useTrack();
  var { getPitchesForTrack } = usePitches();
  var trackData = getTrack(trackId);
  var [events, setEvents] = useState<ActivityEvent[]>([]);
  var [loading, setLoading] = useState(true);

  useEffect(function () {
    if (!trackUuid) { setLoading(false); return; }

    var cancelled = false;

    async function load() {
      var allEvents: ActivityEvent[] = [];

      // 1. Pitches — match by track title via context
      var trackTitle = trackData?.title;
      if (trackTitle) {
        var pitches = getPitchesForTrack(trackTitle);
        pitches.forEach(function (p) {
          allEvents.push({
            id: "pitch-" + p.id,
            type: "pitch",
            label: "Track pitched to " + p.recipientName + (p.recipientCompany ? " (" + p.recipientCompany + ")" : ""),
            date: new Date(p.date),
          });
        });
      }

      // 2 & 3. Plays + Downloads from link_events
      var evRes = await supabase
        .from("link_events")
        .select("id, event_type, visitor_email, created_at")
        .eq("track_id", trackUuid)
        .in("event_type", ["play", "download"])
        .order("created_at", { ascending: false })
        .limit(50);
      (evRes.data || []).forEach(function (e: any) {
        var who = e.visitor_email || "Someone";
        allEvents.push({
          id: "le-" + e.id,
          type: e.event_type === "play" ? "play" : "download",
          label: who + (e.event_type === "play" ? " played this track" : " downloaded this track"),
          date: new Date(e.created_at),
        });
      });

      // 4. Shared links created
      var slRes = await supabase
        .from("shared_links")
        .select("id, link_slug, created_at")
        .eq("track_id", trackUuid)
        .order("created_at", { ascending: false })
        .limit(20);
      (slRes.data || []).forEach(function (l: any) {
        allEvents.push({
          id: "sl-" + l.id,
          type: "shared_link",
          label: "Shared link created: " + l.link_slug,
          date: new Date(l.created_at),
        });
      });

      // 5. Signatures
      var sigRes = await supabase
        .from("signature_requests")
        .select("id, signer_name, signed_at")
        .eq("track_id", trackUuid)
        .eq("status", "signed")
        .order("signed_at", { ascending: false })
        .limit(20);
      (sigRes.data || []).forEach(function (s: any) {
        allEvents.push({
          id: "sig-" + s.id,
          type: "signature",
          label: (s.signer_name || "Someone") + " signed the split agreement",
          date: new Date(s.signed_at),
        });
      });

      // 6. Studio submissions
      var subRes = await supabase
        .from("studio_submissions")
        .select("id, submitted_by_name, created_at")
        .eq("track_id", trackUuid)
        .order("created_at", { ascending: false })
        .limit(20);
      (subRes.data || []).forEach(function (s: any) {
        allEvents.push({
          id: "stu-" + s.id,
          type: "studio",
          label: (s.submitted_by_name || "Someone") + " submitted splits via QR",
          date: new Date(s.created_at),
        });
      });

      // 7. Comments
      var cmtRes = await supabase
        .from("track_comments")
        .select("id, author_name, timestamp_sec, created_at")
        .eq("track_id", trackUuid)
        .order("created_at", { ascending: false })
        .limit(20);
      (cmtRes.data || []).forEach(function (c: any) {
        var ts = c.timestamp_sec != null ? " at " + Math.floor(c.timestamp_sec / 60) + ":" + String(Math.floor(c.timestamp_sec % 60)).padStart(2, "0") : "";
        allEvents.push({
          id: "cmt-" + c.id,
          type: "comment",
          label: (c.author_name || "Someone") + " left a comment" + ts,
          date: new Date(c.created_at),
        });
      });

      // Sort descending, limit 50
      allEvents.sort(function (a, b) { return b.date.getTime() - a.date.getTime(); });
      allEvents = allEvents.slice(0, 50);

      if (!cancelled) {
        setEvents(allEvents);
        setLoading(false);
      }
    }

    load().catch(function () { if (!cancelled) setLoading(false); });

    return function () { cancelled = true; };
  }, [trackUuid, trackData?.title]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card-premium py-16 text-center">
        <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/15" />
        <p className="text-sm font-semibold text-foreground">No activity yet for this track</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Pitches, plays, downloads, and other events will appear here</p>
      </div>
    );
  }

  return (
    <div className="card-premium overflow-hidden divide-y divide-border/40">
      {events.map(function (ev) {
        var cfg = activityEventConfig[ev.type];
        var Icon = cfg.icon;
        return (
          <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
            <div className={"w-8 h-8 rounded-lg flex items-center justify-center shrink-0 " + cfg.bg}>
              <Icon className={"w-3.5 h-3.5 " + cfg.color} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{ev.label}</p>
            </div>
            <span className="text-2xs text-muted-foreground/60 shrink-0 whitespace-nowrap">{formatRelativeTime(ev.date)}</span>
          </div>
        );
      })}
    </div>
  );
}
