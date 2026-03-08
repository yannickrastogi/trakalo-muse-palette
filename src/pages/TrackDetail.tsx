import { useState, useRef, useCallback /* refresh */ } from "react";
import { jsPDF } from "jspdf";
import { useParams, Link } from "react-router-dom";
import { useTrack, type TrackStem, type TrackSplit } from "@/contexts/TrackContext";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { Textarea } from "@/components/ui/textarea";
import { TrackWaveformPlayer } from "@/components/TrackWaveformPlayer";
import { ShareModal } from "@/components/ShareModal";
import { usePitches } from "@/contexts/PitchContext";
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
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useRole } from "@/contexts/RoleContext";
import { type PitchEntry } from "@/components/CreatePitchModal";

// Stem types kept for the stems tab
const stemTypes = ["kick", "snare", "bass", "guitar", "vocal", "synth", "drums", "background vocal", "fx", "other"] as const;
type StemType = typeof stemTypes[number];

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

export default function TrackDetail() {
  const { id } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [activeTab, setActiveTab] = useState<string>("lyrics");
  const { permissions } = useRole();
  const { getTrack, updateTrack } = useTrack();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTrackModalOpen, setShareTrackModalOpen] = useState(false);

  const trackData = getTrack(Number(id));

  if (!trackData) {
    return (
      <PageShell>
        <div className="p-8 text-center text-muted-foreground">Track not found.</div>
      </PageShell>
    );
  }

  const statusColorMap: Record<string, string> = {
    Available: "bg-emerald-500/15 text-emerald-400",
    "On Hold": "bg-brand-orange/15 text-brand-orange",
    Released: "bg-brand-purple/15 text-brand-purple",
  };

  const tabs = [
    { id: "lyrics", label: "Lyrics" },
    { id: "stems", label: "Stems" },
    { id: "splits", label: "Splits" },
    { id: "metadata", label: "Metadata" },
    { id: "paperwork", label: "Paperwork" },
    { id: "pitches", label: "Pitch History" },
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
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateTrack(trackData.id, { coverImage: reader.result as string });
                      };
                      reader.readAsDataURL(file);
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
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColorMap[trackData.status] || "bg-emerald-500/15 text-emerald-400"}`}>
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
                  {trackData.key && <MetaChip icon={Music} label={trackData.key} />}
                  {trackData.bpm > 0 && <MetaChip icon={Clock} label={`${trackData.bpm} BPM`} />}
                  {trackData.genre && <MetaChip icon={Disc3} label={trackData.genre} />}
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
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]">
                      <Edit3 className="w-4 h-4" /> Edit Track
                    </button>
                  )}
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button
                    onClick={() => setShareTrackModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Share2 className="w-4 h-4" /> Share Track
                  </button>
                  <button
                    onClick={() => setShareModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Share2 className="w-4 h-4" /> Share Stems
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
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 ml-0.5" />}
                  </button>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>1:28</span>
                  <span>{trackData.duration}</span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-muted-foreground/50 rounded-full" />
                  </div>
                </div>
              </div>
              <TrackWaveformPlayer
                seed={trackData.id}
                progress={progress}
                onSeek={setProgress}
                chapters={trackData.chapters || []}
                isPlaying={isPlaying}
              />
            </motion.div>

            {/* Tabs */}
            <motion.div variants={item} className="border-b border-border">
              <div className="flex gap-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Tab content */}
            <motion.div variants={item}>
              {activeTab === "lyrics" && <LyricsTab trackId={Number(id)} />}
              {activeTab === "stems" && <StemsTab trackId={Number(id)} />}
              {activeTab === "splits" && <SplitsTab trackId={Number(id)} />}
              {activeTab === "metadata" && <OverviewTab trackId={Number(id)} />}
              {activeTab === "paperwork" && <PaperworkTab />}
              {activeTab === "pitches" && <PitchHistoryTab trackId={Number(id)} />}
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

function OverviewTab({ trackId }: { trackId: number }) {
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  if (!trackData) return null;

  const meta = [
    { label: "Album / EP", value: trackData.album || "—" },
    { label: "Label", value: trackData.label || "—" },
    { label: "Publisher", value: trackData.publisher || "—" },
    { label: "Release Date", value: trackData.releaseDate || "—" },
    { label: "ISRC", value: trackData.isrc || "—" },
    { label: "UPC", value: trackData.upc || "—" },
    { label: "Written By", value: trackData.writtenBy.length ? trackData.writtenBy.join(", ") : "—" },
    { label: "Produced By", value: trackData.producedBy.length ? trackData.producedBy.join(", ") : "—" },
    { label: "Mixed By", value: trackData.mixedBy || "—" },
    { label: "Mastered By", value: trackData.masteredBy || "—" },
    { label: "Copyright", value: trackData.copyright || "—" },
    { label: "Language", value: trackData.language || "—" },
    { label: "Explicit", value: trackData.explicit ? "Yes" : "No" },
    { label: "Notes", value: trackData.notes || "—" },
  ];

  // Add detail fields from upload
  const detailLabels: Record<string, string> = {
    producers: "Producer(s)", songwriters: "Songwriter(s)", recordingEngineer: "Recording Engineer",
    mixingEngineer: "Mixing Engineer", masteringEngineer: "Mastering Engineer", drumsBy: "Drums By",
    synthsBy: "Synths By", keysBy: "Keys By", guitarsBy: "Guitars By", bassBy: "Bass By",
    programmingBy: "Programming By", vocalsBy: "Vocals By", backgroundVocalsBy: "Background Vocals By",
    mixingStudio: "Mixing Studio", recordingStudio: "Recording Studio", recordingDate: "Recording Date",
  };

  Object.entries(trackData.details || {}).forEach(([key, values]) => {
    const filtered = values.filter(Boolean);
    if (filtered.length > 0) {
      meta.push({ label: detailLabels[key] || key, value: filtered.join(", ") });
    }
  });

  return (
    <SectionCard title="Metadata" icon={FileText} action={<button className="text-xs text-primary hover:underline">Edit</button>}>
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

/** Generate a premium branded lyrics PDF using jsPDF */
function generateLyricsPdf(title: string, artist: string, lyrics: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  // Brand colors (from CSS tokens)
  const brandOrange: [number, number, number] = [255, 140, 26];   // hsl(24 100% 55%)
  const brandPink: [number, number, number] = [224, 82, 153];     // hsl(330 80% 60%)
  const brandPurple: [number, number, number] = [140, 70, 209];   // hsl(270 70% 55%)
  const bgDark: [number, number, number] = [16, 16, 18];          // hsl(240 6% 6%)
  const cardBg: [number, number, number] = [22, 22, 25];          // hsl(240 5% 9%)
  const textLight: [number, number, number] = [245, 245, 245];    // hsl(0 0% 96%)
  const textMuted: [number, number, number] = [120, 120, 128];    // muted

  // ─── Full-page dark background ───
  doc.setFillColor(...bgDark);
  doc.rect(0, 0, pageW, pageH, "F");

  // ─── Top gradient bar ───
  const barH = 5;
  const barSegments = 60;
  for (let i = 0; i < barSegments; i++) {
    const t = i / barSegments;
    const r = Math.round(brandOrange[0] + (brandPink[0] - brandOrange[0]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[0] - brandPurple[0]));
    const g = Math.round(brandOrange[1] + (brandPink[1] - brandOrange[1]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[1] - brandPurple[1]));
    const b = Math.round(brandOrange[2] + (brandPink[2] - brandOrange[2]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[2] - brandPurple[2]));
    doc.setFillColor(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
    doc.rect((pageW / barSegments) * i, 0, pageW / barSegments + 1, barH, "F");
  }

  // ─── Logo area ───
  let y = 44;
  const iconSize = 28;
  // Add the actual logo image
  try {
    doc.addImage(trakalogLogo, "PNG", marginX, y - 2, iconSize, iconSize);
  } catch {
    // Fallback: draw a branded square with "T"
    doc.setFillColor(...brandOrange);
    doc.roundedRect(marginX, y - 2, iconSize, iconSize, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("T", marginX + iconSize / 2, y + iconSize / 2 + 1, { align: "center", baseline: "middle" });
  }

  // Brand name
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandOrange);
  doc.text("TRAKALOG", marginX + iconSize + 10, y + iconSize / 2 + 1, { baseline: "middle" });

  // ─── Header card area ───
  y = 92;
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 80, 8, 8, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...textLight);
  doc.text(title, marginX + 20, y + 32);

  // Artist
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...textMuted);
  doc.text(artist, marginX + 20, y + 54);

  // "LYRICS" label badge
  doc.setFillColor(brandOrange[0], brandOrange[1], brandOrange[2]);
  const badgeText = "LYRICS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(badgeText) + 16;
  doc.roundedRect(pageW - marginX - badgeW - 20, y + 16, badgeW, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageW - marginX - badgeW / 2 - 20, y + 28, { align: "center" });

  // ─── Divider line with gradient dots ───
  y = 188;
  for (let i = 0; i < 3; i++) {
    const colors = [brandOrange, brandPink, brandPurple];
    doc.setFillColor(...colors[i]);
    doc.circle(pageW / 2 - 12 + i * 12, y, 2, "F");
  }

  // ─── Lyrics body ───
  y = 210;
  const lines = lyrics.split("\n");
  const lineHeight = 16;
  const sectionLineHeight = 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  for (const line of lines) {
    const trimmed = line.trim();
    const isSection = /^\[.*\]$/.test(trimmed);

    // Check if we need a new page
    if (y > pageH - 80) {
      doc.addPage();
      // New page background
      doc.setFillColor(...bgDark);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 48;
    }

    if (isSection) {
      // Section header styling
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...brandOrange);
      doc.text(trimmed.replace(/[\[\]]/g, "").toUpperCase(), marginX, y);
      // Small underline accent
      const tw = doc.getTextWidth(trimmed.replace(/[\[\]]/g, "").toUpperCase());
      doc.setDrawColor(...brandOrange);
      doc.setLineWidth(0.5);
      doc.line(marginX, y + 4, marginX + tw, y + 4);
      y += sectionLineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
    } else if (trimmed === "") {
      y += 8;
    } else {
      doc.setTextColor(...textLight);
      // Word-wrap long lines
      const splitLines = doc.splitTextToSize(trimmed, contentW);
      for (const sl of splitLines) {
        if (y > pageH - 80) {
          doc.addPage();
          doc.setFillColor(...bgDark);
          doc.rect(0, 0, pageW, pageH, "F");
          y = 48;
        }
        doc.text(sl, marginX, y);
        y += lineHeight;
      }
    }
  }

  // ─── Footer on every page ───
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Bottom gradient bar
    for (let i = 0; i < barSegments; i++) {
      const t = i / barSegments;
      const r = Math.round(brandOrange[0] + (brandPink[0] - brandOrange[0]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[0] - brandPurple[0]));
      const g = Math.round(brandOrange[1] + (brandPink[1] - brandOrange[1]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[1] - brandPurple[1]));
      const b = Math.round(brandOrange[2] + (brandPink[2] - brandOrange[2]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[2] - brandPurple[2]));
      doc.setFillColor(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
      doc.rect((pageW / barSegments) * i, pageH - 3, pageW / barSegments + 1, 3, "F");
    }

    // "Powered by trakalog.com" footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text("Powered by", pageW / 2 - 20, pageH - 18, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brandOrange);
    doc.text(" trakalog.com", pageW / 2 - 18, pageH - 18);

    // Page number
    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(`${p} / ${totalPages}`, pageW - marginX, pageH - 18, { align: "right" });
    }
  }

  doc.save(`${title} - Lyrics.pdf`);
}

/** Generate a premium branded splits PDF using jsPDF — matching lyrics PDF branding */
function generateSplitsPdf(title: string, artist: string, splits: TrackSplit[], totalShares: number) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  const brandOrange: [number, number, number] = [255, 140, 26];
  const brandPink: [number, number, number] = [224, 82, 153];
  const brandPurple: [number, number, number] = [140, 70, 209];
  const bgDark: [number, number, number] = [16, 16, 18];
  const cardBg: [number, number, number] = [22, 22, 25];
  const textLight: [number, number, number] = [245, 245, 245];
  const textMuted: [number, number, number] = [120, 120, 128];
  const splitColors: [number, number, number][] = [brandOrange, brandPink, brandPurple, [80, 180, 220]];

  // ─── Background ───
  doc.setFillColor(...bgDark);
  doc.rect(0, 0, pageW, pageH, "F");

  // ─── Top gradient bar ───
  const barSegments = 60;
  for (let i = 0; i < barSegments; i++) {
    const t = i / barSegments;
    const r = Math.round(brandOrange[0] + (brandPink[0] - brandOrange[0]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[0] - brandPurple[0]));
    const g = Math.round(brandOrange[1] + (brandPink[1] - brandOrange[1]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[1] - brandPurple[1]));
    const b = Math.round(brandOrange[2] + (brandPink[2] - brandOrange[2]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[2] - brandPurple[2]));
    doc.setFillColor(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
    doc.rect((pageW / barSegments) * i, 0, pageW / barSegments + 1, 5, "F");
  }

  // ─── Logo ───
  let y = 44;
  const iconSize = 28;
  try {
    doc.addImage(trakalogLogo, "PNG", marginX, y - 2, iconSize, iconSize);
  } catch {
    doc.setFillColor(...brandOrange);
    doc.roundedRect(marginX, y - 2, iconSize, iconSize, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("T", marginX + iconSize / 2, y + iconSize / 2 + 1, { align: "center", baseline: "middle" });
  }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandOrange);
  doc.text("TRAKALOG", marginX + iconSize + 10, y + iconSize / 2 + 1, { baseline: "middle" });

  // ─── Header card ───
  y = 92;
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 80, 8, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...textLight);
  doc.text(title, marginX + 20, y + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...textMuted);
  doc.text(artist, marginX + 20, y + 54);

  // Badge
  const badgeText = "SPLITS";
  doc.setFillColor(...brandOrange);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(badgeText) + 16;
  doc.roundedRect(pageW - marginX - badgeW - 20, y + 16, badgeW, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageW - marginX - badgeW / 2 - 20, y + 28, { align: "center" });

  // ─── Divider dots ───
  y = 188;
  [brandOrange, brandPink, brandPurple].forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(pageW / 2 - 12 + i * 12, y, 2, "F");
  });

  // ─── Visual split bar ───
  y = 210;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("OWNERSHIP BREAKDOWN", marginX, y);
  y += 20;

  const barY = y;
  const barHeight = 14;
  let barX = marginX;
  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];
    const w = (s.share / 100) * contentW;
    doc.setFillColor(...color);
    doc.roundedRect(barX, barY, Math.max(w, 2), barHeight, i === 0 ? 4 : 0, i === splits.length - 1 ? 4 : 0, "F");
    barX += w;
  });
  y += barHeight + 24;

  // ─── Table header ───
  const colName = marginX;
  const colRole = marginX + 180;
  const colPro = marginX + 310;
  const colIpi = marginX + 370;
  const colShare = pageW - marginX - 40;

  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 28, 6, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("NAME", colName + 14, y + 18);
  doc.text("ROLE", colRole, y + 18);
  doc.text("PRO", colPro, y + 18);
  doc.text("IPI", colIpi, y + 18);
  doc.text("SHARE", colShare, y + 18, { align: "right" });
  y += 36;

  // ─── Split rows ───
  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];

    // Alternating subtle row bg
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, 32, "F");
    }

    // Color dot
    doc.setFillColor(...color);
    doc.circle(colName + 6, y + 10, 4, "F");

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textLight);
    doc.text(s.name, colName + 18, y + 12);

    // Publisher subtitle
    if (s.publisher) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text(s.publisher, colName + 18, y + 23);
    }

    // Role
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...textLight);
    doc.text(s.role, colRole, y + 12);

    // PRO
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.text(s.pro || "—", colPro, y + 12);

    // IPI
    doc.text(s.ipi || "—", colIpi, y + 12);

    // Share %
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(`${s.share}%`, colShare, y + 12, { align: "right" });

    y += 36;
  });

  // ─── Total row ───
  y += 4;
  doc.setDrawColor(...brandOrange);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + contentW, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text("TOTAL", colName + 18, y);

  const isComplete = totalShares === 100;
  doc.setFontSize(14);
  doc.setTextColor(isComplete ? 74 : 239, isComplete ? 222 : 68, isComplete ? 128 : 68);
  doc.text(`${totalShares}%`, colShare, y, { align: "right" });

  if (isComplete) {
    doc.setFontSize(8);
    doc.setTextColor(74, 222, 128);
    doc.text("✓ Fully allocated", colShare - 40, y + 14, { align: "right" });
  }

  // ─── Footer on every page ───
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Bottom gradient bar
    for (let i = 0; i < barSegments; i++) {
      const t = i / barSegments;
      const r = Math.round(brandOrange[0] + (brandPink[0] - brandOrange[0]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[0] - brandPurple[0]));
      const g = Math.round(brandOrange[1] + (brandPink[1] - brandOrange[1]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[1] - brandPurple[1]));
      const b = Math.round(brandOrange[2] + (brandPink[2] - brandOrange[2]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[2] - brandPurple[2]));
      doc.setFillColor(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
      doc.rect((pageW / barSegments) * i, pageH - 3, pageW / barSegments + 1, 3, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text("Powered by", pageW / 2 - 20, pageH - 18, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brandOrange);
    doc.text(" trakalog.com", pageW / 2 - 18, pageH - 18);

    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(`${p} / ${totalPages}`, pageW - marginX, pageH - 18, { align: "right" });
    }
  }

  doc.save(`${title} - Splits.pdf`);
}


  const { getTrack, updateTrackStems } = useTrack();
  const trackData = getTrack(trackId);
  const initialStems: StemFile[] = (trackData?.stems || []).map((s) => ({
    ...s,
    type: s.type as StemType,
  }));
  const [stems, setStems] = useState<StemFile[]>(initialStems);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: StemType; customName: string }[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalDragOver, setModalDragOver] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      setStems((prev) => prev.filter((s) => s.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    }
  };

  const handleChangeType = (id: string, newType: StemType) => {
    setStems((prev) => prev.map((s) => s.id === id ? { ...s, type: newType } : s));
    setEditingTypeId(null);
  };

  const handlePlay = (id: string) => {
    setPlayingId((prev) => (prev === id ? null : id));
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.match(/\.(wav|mp3|aiff|flac|ogg|m4a)$/i)
    );
    if (files.length) stageFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      stageFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const stageFiles = (files: File[]) => {
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((f) => ({ file: f, type: guessType(f.name), customName: f.name.replace(/\.[^.]+$/, "") })),
    ]);
  };

  const updatePendingType = (index: number, type: StemType) => {
    setPendingFiles((prev) => prev.map((p, i) => i === index ? { ...p, type } : p));
  };

  const updatePendingName = (index: number, customName: string) => {
    setPendingFiles((prev) => prev.map((p, i) => i === index ? { ...p, customName } : p));
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmUpload = () => {
    const ext = (name: string) => { const m = name.match(/\.[^.]+$/); return m ? m[0] : ""; };
    const newStems: StemFile[] = pendingFiles.map((p, i) => ({
      id: `new-${Date.now()}-${i}`,
      fileName: p.customName.trim() ? p.customName.trim() + ext(p.file.name) : p.file.name,
      type: p.type,
      fileSize: formatFileSize(p.file.size),
      uploadDate: "Just now",
      color: "text-muted-foreground",
    }));
    setStems((prev) => [...prev, ...newStems]);
    setPendingFiles([]);
  };

  const handleRename = (id: string, newName: string) => {
    setStems((prev) => prev.map((s) => s.id === id ? { ...s, fileName: newName } : s));
  };

  const guessType = (name: string): StemType => {
    const n = name.toLowerCase();
    if (n.includes("kick")) return "kick";
    if (n.includes("snare")) return "snare";
    if (n.includes("bass")) return "bass";
    if (n.includes("guitar")) return "guitar";
    if (n.includes("vocal") && n.includes("bg") || n.includes("backing")) return "background vocal";
    if (n.includes("vocal") || n.includes("vox")) return "vocal";
    if (n.includes("synth") || n.includes("pad") || n.includes("keys")) return "synth";
    if (n.includes("drum") || n.includes("perc")) return "drums";
    if (n.includes("fx") || n.includes("riser") || n.includes("effect")) return "fx";
    return "other";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
    return (bytes / 1e3).toFixed(0) + " KB";
  };

  const stemTypeIcon = (type: StemType) => {
    switch (type) {
      case "vocal":
      case "background vocal":
        return <Mic className="w-3.5 h-3.5" />;
      case "guitar":
        return <GuitarIcon className="w-3.5 h-3.5" />;
      default:
        return <Music className="w-3.5 h-3.5" />;
    }
  };

  const totalSize = stems.length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{totalSize} Stems</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage audio stems for this track</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
            <Download className="w-3.5 h-3.5" /> Download All
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold btn-brand"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Stems
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.005]"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        {/* Drop overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center"
              style={{ background: "var(--gradient-brand-soft)" }}
            >
              <Upload className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">Drop audio files here</p>
              <p className="text-xs text-muted-foreground mt-0.5">WAV, MP3, AIFF, FLAC, OGG, M4A</p>
            </motion.div>
          )}
        </AnimatePresence>

        {stems.length === 0 ? (
          /* Empty state */
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-full py-16 flex flex-col items-center justify-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-2xl icon-brand flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No stems uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag & drop audio files or click to browse
              </p>
            </div>
          </button>
        ) : (
          /* Stems table */
          <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-5 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>File</span>
              <span>Type</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Stem rows */}
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {stems.map((stem) => (
                  <motion.div
                    key={stem.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                    className="grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-5 py-3 items-center hover:bg-secondary/30 transition-colors group"
                  >
                    {/* File name — click to edit inline */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${stem.color}`}>
                        {stemTypeIcon(stem.type)}
                      </div>
                      <input
                        type="text"
                        defaultValue={stem.fileName}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== stem.fileName) handleRename(stem.id, v);
                          else e.target.value = stem.fileName;
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="text-sm font-medium text-foreground truncate bg-transparent border-0 outline-none w-full rounded px-1 -ml-1 hover:bg-secondary focus:bg-secondary focus:ring-1 focus:ring-ring transition-colors cursor-text"
                        title="Click to rename"
                      />
                    </div>

                    {/* Type badge — clickable to change */}
                    <div className="relative">
                      <button
                        onClick={() => setEditingTypeId(editingTypeId === stem.id ? null : stem.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[11px] font-medium text-secondary-foreground capitalize hover:bg-muted transition-colors cursor-pointer"
                        title="Click to change type"
                      >
                        {stem.type}
                        <ChevronRight className={`w-3 h-3 transition-transform ${editingTypeId === stem.id ? "rotate-90" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {editingTypeId === stem.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-30 top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1"
                            style={{ boxShadow: "var(--shadow-elevated)" }}
                          >
                            {stemTypes.map((t) => (
                              <button
                                key={t}
                                onClick={() => handleChangeType(stem.id, t)}
                                className={`w-full text-left px-3 py-1.5 text-xs capitalize transition-colors ${
                                  stem.type === t
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-popover-foreground hover:bg-secondary"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Size */}
                    <span className="text-xs text-muted-foreground font-mono">{stem.fileSize}</span>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground">{stem.uploadDate}</span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePlay(stem.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          playingId === stem.id
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title="Play preview"
                      >
                        {playingId === stem.id ? <PauseIcon className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(stem.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Drop hint footer */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-secondary/30 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Drag & drop files here or click to upload more
            </button>
          </div>
        )}
      </div>

      {/* Upload modal — drag & drop + assign types */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Upload Stems</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You can upload multiple stems at once
                  </p>
                </div>
                <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setModalDragOver(true); }}
                onDragLeave={() => setModalDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setModalDragOver(false);
                  const files = Array.from(e.dataTransfer.files).filter((f) =>
                    f.name.match(/\.(wav|mp3|aiff|flac|ogg|m4a)$/i)
                  );
                  if (files.length) stageFiles(files);
                }}
                onClick={() => modalFileInputRef.current?.click()}
                className={`mx-6 mt-4 mb-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                  modalDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40 hover:bg-secondary/30"
                }`}
              >
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Upload className={`w-5 h-5 ${modalDragOver ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {modalDragOver ? "Drop files here" : "Drag & drop stems here"}
                  </p>
                  <p className="text-xs text-muted-foreground">or click to browse · WAV, MP3, AIFF, FLAC, OGG, M4A</p>
                </div>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept=".wav,.mp3,.aiff,.flac,.ogg,.m4a"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      stageFiles(Array.from(e.target.files));
                      e.target.value = "";
                    }
                  }}
                />
              </div>

              {/* Staged files list */}
              {pendingFiles.length > 0 && (
                <>
                  <div className="px-6 pt-2 pb-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} ready — assign type & rename
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-border mx-2">
                    {pendingFiles.map((pf, index) => (
                      <div key={index} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Music className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={pf.customName}
                            onChange={(e) => updatePendingName(index, e.target.value)}
                            placeholder={pf.file.name.replace(/\.[^.]+$/, "")}
                            className="text-sm font-medium text-foreground bg-transparent border-0 outline-none w-full rounded px-1 -ml-1 hover:bg-secondary focus:bg-secondary focus:ring-1 focus:ring-ring transition-colors"
                          />
                          <p className="text-[11px] text-muted-foreground px-1">{formatFileSize(pf.file.size)}</p>
                        </div>
                        <select
                          value={pf.type}
                          onChange={(e) => updatePendingType(index, e.target.value as StemType)}
                          className="h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground capitalize appearance-none cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                          style={{ minWidth: "120px" }}
                        >
                          {stemTypes.map((t) => (
                            <option key={t} value={t} className="capitalize">{t}</option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => { e.stopPropagation(); removePending(index); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between mt-2">
                <button
                  onClick={() => { setShowUploadModal(false); setPendingFiles([]); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { confirmUpload(); setShowUploadModal(false); }}
                  disabled={pendingFiles.length === 0}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-brand disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" />
                  Upload {pendingFiles.length > 0 ? `${pendingFiles.length} Stem${pendingFiles.length !== 1 ? "s" : ""}` : "Stems"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this stem?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SplitsTab({ trackId }: { trackId: number }) {
  const { getTrack } = useTrack();
  const trackData = getTrack(trackId);
  const splits = trackData?.splits || [];
  const totalShares = splits.reduce((sum, s) => sum + s.share, 0);

  if (splits.length === 0) {
    return (
      <SectionCard title="Publishing & Ownership Splits" icon={PieChart}>
        <div className="px-5 py-12 text-center text-muted-foreground text-sm">No splits configured for this track.</div>
      </SectionCard>
    );
  }

  const handleDownloadPdf = () => {
    if (!trackData) return;
    generateSplitsPdf(trackData.title, trackData.artist, splits, totalShares);
  };

  return (
    <SectionCard
      title="Publishing & Ownership Splits"
      icon={PieChart}
      action={
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
          <button className="text-xs text-primary hover:underline">Edit Splits</button>
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
