import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTeams } from "@/contexts/TeamContext";
import { useTrack, type TrackData, type TrackStem, type TrackSplit } from "@/contexts/TrackContext";
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
import { ShareWithTeamModal } from "@/components/ShareWithTeamModal";
import { usePitches } from "@/contexts/PitchContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useRole } from "@/contexts/RoleContext";
import { type PitchEntry } from "@/components/CreatePitchModal";
import { StemsTab } from "@/components/StemsTab";
import { STEM_TYPES } from "@/lib/constants";
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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const detailLabels: Record<string, string> = {
  producers: "Producer(s)", songwriters: "Songwriter(s)", recordingEngineer: "Recording Engineer",
  mixingEngineer: "Mixing Engineer", masteringEngineer: "Mastering Engineer", drumsBy: "Drums By",
  synthsBy: "Synths By", keysBy: "Keys By", guitarsBy: "Guitars By", bassBy: "Bass By",
  programmingBy: "Programming By", vocalsBy: "Vocals By", backgroundVocalsBy: "Background Vocals By",
  mixingStudio: "Mixing Studio", recordingStudio: "Recording Studio", recordingDate: "Recording Date",
};

function buildMeta(trackData: TrackData) {
  const meta = [
    { label: "Album / EP", value: trackData.album || "\u2014" },
    { label: "Label", value: trackData.label || "\u2014" },
    { label: "Publisher", value: trackData.publisher || "\u2014" },
    { label: "Release Date", value: trackData.releaseDate || "\u2014" },
    { label: "ISRC", value: trackData.isrc || "\u2014" },
    { label: "UPC", value: trackData.upc || "\u2014" },
    { label: "Written By", value: trackData.writtenBy.length ? trackData.writtenBy.join(", ") : "\u2014" },
    { label: "Produced By", value: trackData.producedBy.length ? trackData.producedBy.join(", ") : "\u2014" },
    { label: "Mixed By", value: trackData.mixedBy || "\u2014" },
    { label: "Mastered By", value: trackData.masteredBy || "\u2014" },
    { label: "Copyright", value: trackData.copyright || "\u2014" },
    { label: "Language", value: trackData.language || "\u2014" },
    { label: "Gender", value: trackData.voice || "\u2014" },
    { label: "Explicit", value: trackData.explicit ? "Yes" : "No" },
    { label: "Notes", value: trackData.notes || "\u2014" },
  ];
  Object.entries(trackData.details || {}).forEach(([key, values]) => {
    const filtered = values.filter(Boolean);
    if (filtered.length > 0) {
      meta.push({ label: detailLabels[key] || key, value: filtered.join(", ") });
    }
  });
  return meta;
}

export default function TrackDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Global audio player
  const { currentTrack, isPlaying: globalIsPlaying, progress: globalProgress, playTrack: globalPlayTrack, togglePlay, seek, volume, setVolume } = useAudioPlayer();

  const isThisTrackPlaying = currentTrack?.id === Number(id) && globalIsPlaying;
  const currentProgress = currentTrack?.id === Number(id) ? globalProgress : 0;

  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "lyrics");
  const shouldAutoUpload = searchParams.get("upload") === "true";
  const [waveformComposerOpen, setWaveformComposerOpen] = useState(false);
  const [waveformComposerTimestamp, setWaveformComposerTimestamp] = useState(0);

  // Clear query params after consuming them
  useEffect(() => {
    if (searchParams.has("tab") || searchParams.has("upload")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const { permissions } = useRole();
  const { activeWorkspace } = useWorkspace();
  const { getTrack, updateTrack } = useTrack();
  const { getTrackEngagement } = useEngagement();
  const { getCommentsForTrack, getCommentCountForTrack, addComment } = useTrackReview();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTrackModalOpen, setShareTrackModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [sharePackModalOpen, setSharePackModalOpen] = useState(false);
  const [editTrackModalOpen, setEditTrackModalOpen] = useState(false);
  const [shareWithTeamOpen, setShareWithTeamOpen] = useState(false);
  const { teams } = useTeams();

  const trackData = getTrack(Number(id));

  

  if (!trackData) {
    return (
      <PageShell>
        <div className="p-8 text-center text-muted-foreground">Track not found.</div>
      </PageShell>
    );
  }
  // Play/pause handler
  const handlePlayPause = useCallback(() => {
    if (currentTrack?.id === Number(id)) {
      togglePlay();
    } else {
      globalPlayTrack(trackData);
    }
  }, [trackData, currentTrack, id, togglePlay, globalPlayTrack]);

  const statusColorMap: Record<string, string> = {
    Available: "bg-emerald-500/15 text-emerald-400",
    "On Hold": "bg-brand-orange/15 text-brand-orange",
    Released: "bg-brand-purple/15 text-brand-purple",
  };

  const engagement = getTrackEngagement(Number(id));
  const commentCount = getCommentCountForTrack(Number(id));
  const trackComments = getCommentsForTrack(Number(id));

  // Parse duration string to seconds
  const parseDuration = (dur: string): number => {
    const parts = dur.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
  };
  const totalDurationSeconds = parseDuration(trackData.duration);

  const handleWaveformClick = (pct: number) => {
    if (currentTrack?.id !== Number(id) && trackData) {
      globalPlayTrack(trackData);
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
    addComment({
      trackId: Number(id),
      authorName: "Kira Nomura",
      authorType: "owner",
      commentText: text,
      timestampSeconds,
      timestampLabel: formatTimestamp(timestampSeconds),
      sourceContext: "internal_review",
    });
    setWaveformComposerOpen(false);
  };

  const tabs = [
    { id: "lyrics", label: "Lyrics" },
    { id: "stems", label: "Stems" },
    { id: "splits", label: "Splits" },
    { id: "metadata", label: "Metadata" },
    { id: "paperwork", label: "Paperwork" },
    { id: "pitches", label: "Pitch History" },
    { id: "review", label: commentCount ? "Review (" + commentCount + ")" : "Review" },
    { id: "engagement", label: engagement ? "Engagement (" + engagement.totalPlays + ")" : "Engagement" },
    { id: "status", label: "Status" },
  ];

  return (
    <PageShell>
          <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
            {/* Breadcrumb */}
            <motion.div variants={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/tracks" className="hover:text-foreground transition-colors">Tracks</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{trackData.title}</span>
            </motion.div>

            {/* Hero section: Cover + Info + Player */}
            <motion.div variants={item} className="flex flex-col lg:flex-row gap-6">
              {/* Cover artwork */}
              <div className="w-full lg:w-64 shrink-0">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-brand-purple/30 via-brand-pink/20 to-brand-orange/30 border border-border flex items-center justify-center relative overflow-hidden group" style={{ boxShadow: "var(--shadow-card)" }}>
                  {trackData.coverImage ? (
                    <img src={trackData.coverImage} alt={trackData.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 via-transparent to-brand-orange/10 group-hover:opacity-70 transition-opacity" />
                      <Disc3 className="w-20 h-20 text-foreground/20" />
                    </>
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const path = activeWorkspace.id + "/" + trackData.uuid + ".jpg";
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
                      updateTrack(trackData.id, { coverImage: urlData.publicUrl });
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={"inline-flex px-2.5 py-1 rounded-full text-xs font-medium " + (statusColorMap[trackData.status] || "bg-emerald-500/15 text-emerald-400")}>
                      {trackData.status}
                    </span>
                    {trackData.isrc && <span className="text-xs text-muted-foreground">{trackData.isrc}</span>}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{trackData.title}</h1>
                  <p className="text-lg text-muted-foreground mt-1">
                    {trackData.artist}
                    {trackData.featuredArtists.length > 0 && (
                      <span className="text-foreground/60"> feat. {trackData.featuredArtists.join(", ")}</span>
                    )}
                  </p>
                </div>

                {/* Quick metadata chips */}
                <div className="flex flex-wrap gap-2">
                  {trackData.type && <MetaChip icon={Music} label={trackData.type} />}
                  {trackData.genre && <MetaChip icon={Disc3} label={trackData.genre} />}
                  {trackData.bpm > 0 && <MetaChip icon={Activity} label={trackData.bpm + " BPM"} />}
                  {trackData.key && <MetaChip icon={({ className }: { className?: string }) => <span className={className}>#</span>} label={trackData.key} />}
                  {trackData.language && <MetaChip icon={Mic} label={trackData.language} />}
                  {trackData.voice && <MetaChip icon={Mic} label={trackData.voice} />}
                  {trackData.duration && <MetaChip icon={Clock} label={trackData.duration} />}
                  {trackData.mood.map((m) => (
                    <span key={m} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">
                      #{m}
                    </span>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {permissions.canEditOwnTracks && (
                    <button
                      onClick={() => setEditTrackModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
                    >
                      <Edit3 className="w-4 h-4" /> Edit Track
                    </button>
                  )}
                  <button
                    onClick={() => setDownloadModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button
                    onClick={() => setShareWithTeamOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Users className="w-4 h-4" /> Share with Team
                  </button>
                  <button
                    onClick={() => setShareTrackModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Music className="w-4 h-4" /> Share Track
                  </button>
                  <button
                    onClick={() => setShareModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Layers className="w-4 h-4" /> Share Stems
                  </button>
                  <button
                    onClick={() => setSharePackModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Package className="w-4 h-4" /> Share Pack
                  </button>
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
                    className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                  >
                    {isThisTrackPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                  </button>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>{formatTimestamp((currentProgress / 100) * totalDurationSeconds)}</span>
                  <span>{trackData.duration}</span>
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
                  seed={trackData.id}
                  progress={currentProgress}
                  onSeek={handleWaveformClick}
                  onDoubleClick={handleWaveformDoubleClick}
                  chapters={trackData.chapters || []}
                  isPlaying={isThisTrackPlaying}
                />
                <CommentMarkerLayer
                  comments={trackComments}
                  totalDurationSeconds={totalDurationSeconds}
                  onMarkerClick={(seconds) => handleCommentSeek(seconds, totalDurationSeconds)}
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
              {activeTab === "lyrics" && <LyricsTab trackId={Number(id)} />}
               {activeTab === "stems" && <StemsTab trackId={Number(id)} autoOpenUpload={shouldAutoUpload} />}
               {activeTab === "splits" && <SplitsTab trackId={Number(id)} />}
               {activeTab === "engagement" && <EngagementTab trackId={Number(id)} onSeek={handleCommentSeek} />}
               {activeTab === "metadata" && <OverviewTab trackId={Number(id)} onEdit={() => setEditTrackModalOpen(true)} />}
               {activeTab === "paperwork" && <PaperworkTab />}
               {activeTab === "pitches" && <PitchHistoryTab trackId={Number(id)} />}
               {activeTab === "review" && (
                 <TrackReviewPanel
                   trackId={Number(id)}
                   currentUserName="Kira Nomura"
                   progress={currentProgress}
                   onSeek={handleCommentSeek}
                   totalDurationSeconds={totalDurationSeconds}
                   isPlaying={isThisTrackPlaying}
                 />
               )}
               {activeTab === "status" && <StatusTab trackId={Number(id)} />}
             </motion.div>
          </motion.div>
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareType="stems"
        trackId={Number(id)}
        trackTitle={trackData?.title}
        trackArtist={trackData?.artist}
        trackCover={trackData?.coverImage}
        stems={(trackData?.stems || []).map((s) => ({ id: s.id, fileName: s.fileName, type: s.type, fileSize: s.fileSize }))}
      />
      <ShareModal
        open={shareTrackModalOpen}
        onClose={() => setShareTrackModalOpen(false)}
        shareType="track"
        trackId={Number(id)}
        trackTitle={trackData?.title}
        trackArtist={trackData?.artist}
        trackCover={trackData?.coverImage}
      />
      {trackData && (
        <DownloadTrackModal
          open={downloadModalOpen}
          onClose={() => setDownloadModalOpen(false)}
          trackData={trackData}
          meta={buildMeta(trackData)}
        />
      )}
      {trackData && (
        <SharePackModal
          open={sharePackModalOpen}
          onClose={() => setSharePackModalOpen(false)}
          trackData={trackData}
        />
      )}
      <EditTrackModal
        open={editTrackModalOpen}
        onClose={() => setEditTrackModalOpen(false)}
        trackId={Number(id)}
      />
      {trackData && (
        <ShareWithTeamModal
          open={shareWithTeamOpen}
          onClose={() => setShareWithTeamOpen(false)}
          trackTitle={trackData.title}
        />
      )}
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

function OverviewTab({ trackId, onEdit }: { trackId: number; onEdit: () => void }) {
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  if (!trackData) return null;

  const meta = buildMeta(trackData);

  const handleDownloadPdf = () => {
    generateMetadataPdf(trackData.title, trackData.artist, meta);
  };

  return (
    <SectionCard
      title="Metadata"
      icon={FileText}
      action={
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-foreground hover:text-foreground/80 bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg font-semibold transition-colors">
            <Edit3 className="w-3.5 h-3.5" /> Edit Metadata
          </button>
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

function LyricsTab({ trackId }: { trackId: number }) {
  const { getTrack, updateTrackLyrics } = useTrack();
  const trackData = getTrack(trackId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(trackData?.lyrics || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!trackData) return null;

  const hasLyrics = !!trackData.lyrics?.trim();

  const handleSave = () => {
    updateTrackLyrics(trackId, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(trackData.lyrics || "");
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
    if (!trackData.lyrics) return;
    generateLyricsPdf(trackData.title, trackData.artist, trackData.lyrics);
  };

  return (
    <SectionCard
      title="Lyrics"
      icon={FileText}
      action={
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
                onClick={() => { setEditValue(trackData.lyrics || ""); setIsEditing(true); }}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
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
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Type or paste your lyrics here…\n\n[Verse 1]\nYour lyrics...\n\n[Chorus]\n..."
              className="min-h-[400px] bg-secondary border-border font-mono text-sm leading-relaxed resize-y"
            />
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
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed">
            {trackData.lyrics}
          </pre>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No lyrics yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Write lyrics or import from a file</p>
            </div>
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}


function SplitsTab({ trackId }: { trackId: number }) {
  const { getTrack, updateTrackSplits } = useTrack();
  const trackData = getTrack(trackId);
  const splits = trackData?.splits || [];
  const totalShares = splits.reduce((sum, s) => sum + s.share, 0);
  const [editing, setEditing] = useState(false);
  const [editSplits, setEditSplits] = useState<TrackSplit[]>([]);

  const startEditing = () => {
    setEditSplits(splits.length ? splits.map(s => ({ ...s })) : [{ id: "1", name: "", role: "", share: 100, pro: "", ipi: "", publisher: "" }]);
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
    const newSplits = [...editSplits, { id: crypto.randomUUID(), name: "", role: "", share: 0, pro: "", ipi: "", publisher: "" }];
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
    updateTrackSplits(trackId, editSplits.filter(s => s.name.trim()));
    setEditing(false);
  };

  const editTotalShares = editSplits.reduce((sum, s) => sum + (Number(s.share) || 0), 0);

  const handleDownloadPdf = () => {
    if (!trackData) return;
    generateSplitsPdf(trackData.title, trackData.artist, splits, totalShares);
  };

  // Inline editing mode
  if (editing) {
    return (
      <SectionCard title="Publishing & Ownership Splits" icon={PieChart}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={saveSplits} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Save</button>
          </div>
        }
      >
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xs text-muted-foreground">Add collaborators and assign ownership splits</p>
            <span className={`text-xs font-bold tabular-nums ${editTotalShares === 100 ? "text-emerald-400" : editTotalShares > 100 ? "text-destructive" : "text-brand-orange"}`}>{editTotalShares}%</span>
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
    );
  }

  // Empty state with add button
  if (splits.length === 0) {
    return (
      <SectionCard title="Publishing & Ownership Splits" icon={PieChart}>
        <div className="px-5 py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-secondary/80 flex items-center justify-center mx-auto">
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">No splits configured yet</p>
            <p className="text-xs text-muted-foreground">Add collaborators and assign ownership percentages</p>
          </div>
          <button onClick={startEditing} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold btn-brand">
            <Plus className="w-3.5 h-3.5" /> Add Splits
          </button>
        </div>
      </SectionCard>
    );
  }

  // Display mode
  return (
    <SectionCard
      title="Publishing & Ownership Splits"
      icon={PieChart}
      action={
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
          <button onClick={startEditing} className="text-xs text-primary hover:underline">Edit Splits</button>
        </div>
      }
    >
      {/* Visual bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {splits.map((s, i) => {
            const colors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
            return <div key={s.name + i} className={`${colors[i % colors.length]} rounded-full`} style={{ width: `${s.share}%` }} />;
          })}
        </div>
      </div>
      <div className="divide-y divide-border">
        {splits.map((s, i) => {
          const dotColors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
          return (
            <div key={s.name + i} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.role} · {s.pro || "—"} · IPI: {s.ipi || "—"}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-foreground">{s.share}%</span>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-border flex justify-between text-xs">
        <span className="text-muted-foreground">Total</span>
        <span className={`font-bold ${totalShares === 100 ? "text-emerald-400" : "text-destructive"}`}>{totalShares}%</span>
      </div>
    </SectionCard>
  );
}

function PaperworkTab() {
  const paperwork = [
    { name: "Master License Agreement", type: "PDF", date: "Jan 15, 2026", status: "Signed" },
    { name: "Publishing Split Sheet", type: "PDF", date: "Jan 18, 2026", status: "Signed" },
    { name: "Sync License — Nike Campaign", type: "PDF", date: "Feb 22, 2026", status: "Pending" },
    { name: "Distribution Agreement", type: "PDF", date: "Jan 10, 2026", status: "Signed" },
    { name: "Mechanical License", type: "PDF", date: "Mar 01, 2026", status: "Draft" },
  ];

  return (
    <SectionCard
      title="Documents & Contracts"
      icon={Paperclip}
      action={
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
          <Paperclip className="w-3.5 h-3.5" /> Upload
        </button>
      }
    >
      <div className="divide-y divide-border">
        {paperwork.map((doc) => (
          <div key={doc.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{doc.name}</p>
                <p className="text-[11px] text-muted-foreground">{doc.type} · {doc.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${docStatusColors[doc.status]}`}>
                {doc.status}
              </span>
              <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
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

/* ─── ENGAGEMENT TAB ─── */
function EngagementTab({ trackId, onSeek }: { trackId: number; onSeek?: (seconds: number, totalDuration: number) => void }) {
  const { getTrackEngagement } = useEngagement();
  const { getCommentsForTrack } = useTrackReview();
  const { getTrack } = useTrack();
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);
  const engagement = getTrackEngagement(trackId);
  const trackComments = getCommentsForTrack(trackId);

  // Fetch link_events for this track
  const trackUuid = getTrack(trackId)?.uuid;
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
      });
  }, [trackUuid]);

  var linkPlays = linkEvents.filter(function(e) { return e.event_type === "play"; }).length;
  var linkDownloads = linkEvents.filter(function(e) { return e.event_type === "download"; }).length;
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
          <div className="grid grid-cols-3 gap-3 mb-4">
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
