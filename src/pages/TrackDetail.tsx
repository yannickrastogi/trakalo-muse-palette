import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { PageShell } from "@/components/PageShell";

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

const stems = [
  { name: "Vocals (Lead)", format: "WAV 48kHz/24bit", size: "42 MB", color: "text-brand-pink" },
  { name: "Vocals (Backing)", format: "WAV 48kHz/24bit", size: "38 MB", color: "text-brand-purple" },
  { name: "Drums", format: "WAV 48kHz/24bit", size: "56 MB", color: "text-primary" },
  { name: "Bass", format: "WAV 48kHz/24bit", size: "28 MB", color: "text-emerald-400" },
  { name: "Keys / Synths", format: "WAV 48kHz/24bit", size: "34 MB", color: "text-brand-orange" },
  { name: "Guitar", format: "WAV 48kHz/24bit", size: "31 MB", color: "text-sky-400" },
  { name: "Full Mix (Instrumental)", format: "WAV 48kHz/24bit", size: "62 MB", color: "text-muted-foreground" },
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
          <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
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
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">{trackData.title}</h1>
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
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Edit3 className="w-4 h-4" /> Edit Track
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
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
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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
  return (
    <SectionCard
      title="Stems & Files"
      icon={Layers}
      action={
        <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Download className="w-3.5 h-3.5" /> Download All
        </button>
      }
    >
      <div className="divide-y divide-border">
        {stems.map((stem) => (
          <div key={stem.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Music className={`w-3.5 h-3.5 ${stem.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{stem.name}</p>
                <p className="text-[11px] text-muted-foreground">{stem.format}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{stem.size}</span>
              <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Play className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
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
  { value: "Written", icon: FileText, color: "bg-brand-purple/15 text-brand-purple", description: "Song has been written and recorded" },
  { value: "On Hold", icon: Clock, color: "bg-brand-orange/15 text-brand-orange", description: "Waiting on clearance, features, or label decision" },
  { value: "To Be Released", icon: Send, color: "bg-primary/15 text-primary", description: "Scheduled for upcoming release" },
  { value: "Released", icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-400", description: "Publicly available on all platforms" },
];

const statusTimeline = [
  { status: "Written", date: "Jan 10, 2026", note: "Recording completed at Nightfall Studio" },
  { status: "On Hold", date: "Jan 22, 2026", note: "Awaiting JVNE feature clearance" },
  { status: "To Be Released", date: "Feb 15, 2026", note: "Release date set for April 12, 2026" },
];

function StatusTab() {
  const currentStatus = "To Be Released";

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
