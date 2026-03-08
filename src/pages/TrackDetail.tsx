import { useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

// Sample track data
const trackData = {
  id: 1,
  title: "Velvet Hour",
  artist: "Kira Nomura",
  featuredArtists: ["JVNE"],
  album: "Late Bloom EP",
  genre: "Neo-Soul",
  bpm: 92,
  key: "Ab Major",
  duration: "4:12",
  mood: ["emotional", "dreamy", "smooth"],
  status: "Master",
  isrc: "USRC12600001",
  upc: "0850123456789",
  releaseDate: "2026-04-12",
  label: "Nightfall Records",
  publisher: "Nomura Publishing",
  writtenBy: ["Kira Nomura", "Jun Tanaka"],
  producedBy: ["JVNE", "Kira Nomura"],
  mixedBy: "Marco Silva",
  masteredBy: "Sterling Sound NYC",
  copyright: "© 2026 Nightfall Records",
  language: "English",
  explicit: false,
};

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

const stemsData: StemFile[] = [
  { id: "1", fileName: "VelvetHour_Vocal_Lead.wav", type: "vocal", fileSize: "42.3 MB", uploadDate: "Mar 2, 2026", color: "text-brand-pink" },
  { id: "2", fileName: "VelvetHour_BG_Vocals.wav", type: "background vocal", fileSize: "38.1 MB", uploadDate: "Mar 2, 2026", color: "text-brand-purple" },
  { id: "3", fileName: "VelvetHour_Drums_Full.wav", type: "drums", fileSize: "56.7 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
  { id: "4", fileName: "VelvetHour_Kick.wav", type: "kick", fileSize: "12.4 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
  { id: "5", fileName: "VelvetHour_Snare.wav", type: "snare", fileSize: "8.9 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
  { id: "6", fileName: "VelvetHour_Bass.wav", type: "bass", fileSize: "28.5 MB", uploadDate: "Feb 28, 2026", color: "text-chart-4" },
  { id: "7", fileName: "VelvetHour_Synth_Pad.wav", type: "synth", fileSize: "34.2 MB", uploadDate: "Feb 28, 2026", color: "text-brand-orange" },
  { id: "8", fileName: "VelvetHour_Guitar_Clean.wav", type: "guitar", fileSize: "31.0 MB", uploadDate: "Feb 27, 2026", color: "text-chart-5" },
  { id: "9", fileName: "VelvetHour_FX_Risers.wav", type: "fx", fileSize: "15.8 MB", uploadDate: "Feb 27, 2026", color: "text-accent" },
];

const splits = [
  { name: "Kira Nomura", role: "Writer / Artist", share: 40, pro: "ASCAP", ipi: "00123456789" },
  { name: "Jun Tanaka", role: "Writer", share: 25, pro: "BMI", ipi: "00987654321" },
  { name: "JVNE", role: "Producer", share: 20, pro: "SESAC", ipi: "00112233445" },
  { name: "Nightfall Records", role: "Publisher", share: 15, pro: "—", ipi: "—" },
];

const paperwork = [
  { name: "Master License Agreement", type: "PDF", date: "Jan 15, 2026", status: "Signed" },
  { name: "Publishing Split Sheet", type: "PDF", date: "Jan 18, 2026", status: "Signed" },
  { name: "Sync License — Nike Campaign", type: "PDF", date: "Feb 22, 2026", status: "Pending" },
  { name: "Distribution Agreement", type: "PDF", date: "Jan 10, 2026", status: "Signed" },
  { name: "Mechanical License", type: "PDF", date: "Mar 01, 2026", status: "Draft" },
];


const pitchHistory = [
  { recipient: "Interscope Records", contact: "A&R — Jamie Lin", date: "Mar 2, 2026", status: "Under Review", response: null },
  { recipient: "Atlantic Records", contact: "A&R — David Park", date: "Feb 28, 2026", status: "Accepted", response: "Signed sync deal Mar 5" },
  { recipient: "Anjunadeep", contact: "Label Manager", date: "Feb 25, 2026", status: "Declined", response: "Not a fit for current roster" },
  { recipient: "Billie Eilish", contact: "Management — Darkroom", date: "Feb 20, 2026", status: "Accepted", response: "Feature confirmed Feb 27" },
  { recipient: "Republic Records", contact: "A&R — Sarah Cho", date: "Feb 18, 2026", status: "Under Review", response: null },
];

const pitchStatusColors: Record<string, string> = {
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
  const [activeTab, setActiveTab] = useState<string>("overview");
  const { permissions } = useRole();

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "stems", label: "Stems" },
    { id: "splits", label: "Splits" },
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
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 via-transparent to-brand-orange/10 group-hover:opacity-70 transition-opacity" />
                  <Disc3 className="w-20 h-20 text-foreground/20" />
                  <button className="absolute bottom-3 right-3 p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400`}>
                      {trackData.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{trackData.isrc}</span>
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
                  <MetaChip icon={Music} label={trackData.key} />
                  <MetaChip icon={Clock} label={`${trackData.bpm} BPM`} />
                  <MetaChip icon={Disc3} label={trackData.genre} />
                  <MetaChip icon={Clock} label={trackData.duration} />
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
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Audio Player */}
            <motion.div variants={item} className="bg-card border border-border rounded-xl p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-4">
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
                <div className="flex-1 space-y-1">
                  <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setProgress(Math.round(((e.clientX - rect.left) / rect.width) * 100));
                  }}>
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-brand-pink rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>1:28</span>
                    <span>{trackData.duration}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-muted-foreground/50 rounded-full" />
                  </div>
                </div>
              </div>
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
              {activeTab === "overview" && <OverviewTab />}
              {activeTab === "stems" && <StemsTab />}
              {activeTab === "splits" && <SplitsTab />}
              {activeTab === "paperwork" && <PaperworkTab />}
              {activeTab === "pitches" && <PitchHistoryTab />}
              {activeTab === "status" && <StatusTab />}
            </motion.div>
          </motion.div>
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

function OverviewTab() {
  const meta = [
    { label: "Album / EP", value: trackData.album },
    { label: "Label", value: trackData.label },
    { label: "Publisher", value: trackData.publisher },
    { label: "Release Date", value: trackData.releaseDate },
    { label: "ISRC", value: trackData.isrc },
    { label: "UPC", value: trackData.upc },
    { label: "Written By", value: trackData.writtenBy.join(", ") },
    { label: "Produced By", value: trackData.producedBy.join(", ") },
    { label: "Mixed By", value: trackData.mixedBy },
    { label: "Mastered By", value: trackData.masteredBy },
    { label: "Copyright", value: trackData.copyright },
    { label: "Language", value: trackData.language },
    { label: "Explicit", value: trackData.explicit ? "Yes" : "No" },
  ];

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

function StemsTab() {
  const [stems, setStems] = useState<StemFile[]>(stemsData);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: StemType; customName: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (id: string) => {
    setStems((prev) => prev.filter((s) => s.id !== id));
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
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold btn-brand"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Stems
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".wav,.mp3,.aiff,.flac,.ogg,.m4a"
            className="hidden"
            onChange={handleFileSelect}
          />
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
            onClick={() => fileInputRef.current?.click()}
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
                    {/* File name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${stem.color}`}>
                        {stemTypeIcon(stem.type)}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{stem.fileName}</span>
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
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-secondary/30 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Drag & drop files here or click to upload more
            </button>
          </div>
        )}
      </div>

      {/* Staging modal — assign types before upload */}
      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setPendingFiles([])} />

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
                  <h3 className="text-sm font-semibold text-foreground">Assign Stem Types</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose the correct type for each file before uploading
                  </p>
                </div>
                <button onClick={() => setPendingFiles([])} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* File list */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {pendingFiles.map((pf, index) => (
                  <div key={index} className="px-6 py-3.5 flex items-center gap-4">
                    {/* File info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Music className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{pf.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatFileSize(pf.file.size)}</p>
                      </div>
                    </div>

                    {/* Type selector */}
                    <select
                      value={pf.type}
                      onChange={(e) => updatePendingType(index, e.target.value as StemType)}
                      className="h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground capitalize appearance-none cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                      style={{ minWidth: "130px" }}
                    >
                      {stemTypes.map((t) => (
                        <option key={t} value={t} className="capitalize">{t}</option>
                      ))}
                    </select>

                    {/* Remove */}
                    <button
                      onClick={() => removePending(index)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""} ready</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPendingFiles([])}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmUpload}
                    className="px-4 py-2 rounded-lg text-xs font-semibold btn-brand"
                  >
                    <Upload className="w-3.5 h-3.5 inline mr-1.5" />
                    Upload {pendingFiles.length} Stem{pendingFiles.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SplitsTab() {
  const totalShares = splits.reduce((sum, s) => sum + s.share, 0);

  return (
    <SectionCard
      title="Publishing & Ownership Splits"
      icon={PieChart}
      action={<button className="text-xs text-primary hover:underline">Edit Splits</button>}
    >
      {/* Visual bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {splits.map((s, i) => {
            const colors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
            return <div key={s.name} className={`${colors[i % colors.length]} rounded-full`} style={{ width: `${s.share}%` }} />;
          })}
        </div>
      </div>
      <div className="divide-y divide-border">
        {splits.map((s, i) => {
          const dotColors = ["bg-primary", "bg-brand-pink", "bg-brand-purple", "bg-brand-orange"];
          return (
            <div key={s.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.role} · {s.pro} · IPI: {s.ipi}</p>
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

function PitchHistoryTab() {
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
      <div className="divide-y divide-border">
        {pitchHistory.map((pitch, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                {pitch.status === "Accepted" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : pitch.status === "Declined" ? (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-brand-orange" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{pitch.recipient} <span className="text-muted-foreground font-normal">— {pitch.contact}</span></p>
                <p className="text-[11px] text-muted-foreground">
                  {pitch.date}
                  {pitch.response && <span className="ml-2 text-foreground/60">· {pitch.response}</span>}
                </p>
              </div>
            </div>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${pitchStatusColors[pitch.status]}`}>
              {pitch.status}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

const statusOptions = [
  { value: "Available", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400", description: "Track is available for pitching and licensing" },
  { value: "On Hold", icon: Clock, color: "bg-brand-orange/15 text-brand-orange", description: "Waiting on clearance, features, or label decision" },
  { value: "Released", icon: Disc3, color: "bg-primary/15 text-primary", description: "Publicly available on all platforms" },
];

const statusTimeline = [
  { status: "Available", date: "Jan 10, 2026", note: "Recording completed at Nightfall Studio" },
  { status: "On Hold", date: "Jan 22, 2026", note: "Awaiting JVNE feature clearance" },
  { status: "Available", date: "Feb 15, 2026", note: "Clearance received, track open for pitching" },
];

function StatusTab() {
  const currentStatus = "Available";

  return (
    <SectionCard
      title="Track Status"
      icon={Activity}
      action={<button className="text-xs text-primary hover:underline">Update Status</button>}
    >
      {/* Current status */}
      <div className="px-5 py-5 border-b border-border">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Current Status</p>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => {
            const isActive = opt.value === currentStatus;
            return (
              <div
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isActive
                    ? `${opt.color} border-current`
                    : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                <opt.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{opt.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 py-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-4">History</p>
        <div className="space-y-0">
          {statusTimeline.map((entry, i) => {
            const opt = statusOptions.find((o) => o.value === entry.status);
            const isLast = i === statusTimeline.length - 1;
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
