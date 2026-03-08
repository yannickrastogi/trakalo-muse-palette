import { useState, useRef, useCallback } from "react";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import { analyzeAudio, type AudioAnalysisResult } from "@/lib/audio-analysis";
import { compressAudio, type CompressedAudio } from "@/lib/audio-compression";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Music,
  Upload,
  FileAudio,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const MAX_TRACKS = 20;

const STEPS_SINGLE = ["Audio", "Info", "Stems", "Splits", "Review"];

const GENRES = [
  "Afrobeats", "Afrohouse", "Ambient", "Blues", "Bouyon", "Caribbean", "Classical",
  "Country", "Dance", "Disco-Funk", "DnB", "Dubstep", "Electronic",
  "Film", "Folk", "Hip-Hop", "House", "I-Pop", "Indie", "Jazz",
  "K-Pop", "Kompa", "Latin", "Lo-fi", "Lounge", "Pop", "Progressive",
  "R&B", "Reggae-Dancehall", "Rock", "Shatta", "Soca", "Soul",
  "World", "Zouk",
];
const KEYS = ["Ab Maj", "A Min", "Bb Maj", "B Min", "C Min", "C# Min", "D Maj", "Eb Maj", "E Min", "F Maj", "F# Min", "G Maj"];
const MOODS = ["aggressive", "calm", "dark", "dreamy", "emotional", "energetic", "euphoric", "experimental", "happy", "hopeful", "hypnotic", "meditative", "nostalgic", "playful", "romantic", "smooth", "uplifting", "warm"];
const LANGUAGES = ["English", "French", "Instrumental", "Japanese", "Portuguese", "Spanish"];

interface Split {
  id: string;
  name: string;
  role: string;
  percentage: number;
  pro: string;
  ipi: string;
  publisher: string;
}

interface StemFile {
  id: string;
  name: string;
  file: File;
  size: string;
}

/** Per-track entry in the bulk queue */
interface TrackEntry {
  id: string;
  file: File;
  fileName: string;
  fileSize: string;
  // Analysis
  analyzing: boolean;
  analysisResult: AudioAnalysisResult | null;
  analysisDuration: string;
  analysisError: boolean;
  // Compression
  compressing: boolean;
  compressed: CompressedAudio | null;
  // Metadata
  title: string;
  artist: string;
  bpm: string;
  trackKey: string;
  genre: string;
  mood: string[];
  voice: string;
  language: string;
  notes: string;
  details: Record<string, string[]>;
  stems: StemFile[];
  splits: Split[];
  lyrics: string;
  // Status
  metadataComplete: boolean;
}

interface UploadTrackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function createTrackEntry(file: File): TrackEntry {
  const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    analyzing: false,
    analysisResult: null,
    analysisDuration: "",
    analysisError: false,
    compressing: false,
    compressed: null,
    title: nameWithoutExt,
    artist: "",
    bpm: "",
    trackKey: "",
    genre: "",
    mood: [],
    voice: "",
    language: "",
    notes: "",
    details: {},
    stems: [],
    splits: [{ id: "1", name: "", role: "", percentage: 100, pro: "", ipi: "", publisher: "" }],
    lyrics: "",
    metadataComplete: false,
  };
}

export function UploadTrackModal({ open, onOpenChange }: UploadTrackModalProps) {
  const { tracks, addTrack } = useTrack();

  // Phase: "upload" (drag & drop files) → "edit" (per-track metadata) → done
  const [phase, setPhase] = useState<"upload" | "edit">("upload");
  const [queue, setQueue] = useState<TrackEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editStep, setEditStep] = useState(0); // 0=Info, 1=Stems, 2=Lyrics, 3=Splits, 4=Review
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const stemsInputRef = useRef<HTMLInputElement>(null);
  const lyricsFileInputRef = useRef<HTMLInputElement>(null);

  const EDIT_STEPS = ["Info", "Stems", "Lyrics", "Splits", "Review"];

  const currentTrack = queue[currentIdx] || null;

  // ─── File handling ──────────────────────────────────────────

  const addFiles = useCallback(async (files: File[]) => {
    const audioFiles = files.filter((f) => f.type.startsWith("audio/") || /\.(wav|mp3|flac|aiff|aif|ogg|m4a|wma)$/i.test(f.name));
    if (audioFiles.length === 0) return;

    const remaining = MAX_TRACKS - queue.length;
    const toAdd = audioFiles.slice(0, remaining);
    if (toAdd.length === 0) return;

    const entries = toAdd.map(createTrackEntry);
    setQueue((prev) => [...prev, ...entries]);

    // Run analysis + compression in parallel for each file
    for (const entry of entries) {
      // Analysis
      setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, analyzing: true } : e));

      // Analysis
      analyzeAudio(entry.file)
        .then((result) => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? {
            ...e,
            analyzing: false,
            analysisResult: result,
            analysisDuration: result.duration,
            bpm: String(result.bpm),
            trackKey: result.key,
          } : e));
        })
        .catch(() => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, analyzing: false, analysisError: true } : e));
        });

      // Compression
      compressAudio(entry.file)
        .then((compressed) => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, compressing: false, compressed } : e));
        })
        .catch(() => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, compressing: false } : e));
        });
    }
  }, [queue.length]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Drag & Drop ──────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  // ─── Metadata updates ──────────────────────────────────────

  const updateCurrent = useCallback((updates: Partial<TrackEntry>) => {
    setQueue((prev) => prev.map((e, i) => i === currentIdx ? { ...e, ...updates } : e));
  }, [currentIdx]);

  const toggleMood = useCallback((m: string) => {
    if (!currentTrack) return;
    const mood = currentTrack.mood.includes(m) ? currentTrack.mood.filter((x) => x !== m) : [...currentTrack.mood, m];
    updateCurrent({ mood });
  }, [currentTrack, updateCurrent]);

  const updateDetail = useCallback((key: string, index: number, value: string) => {
    if (!currentTrack) return;
    const arr = [...(currentTrack.details[key] || [])];
    arr[index] = value;
    updateCurrent({ details: { ...currentTrack.details, [key]: arr } });
  }, [currentTrack, updateCurrent]);

  const addDetailEntry = useCallback((key: string) => {
    if (!currentTrack) return;
    updateCurrent({ details: { ...currentTrack.details, [key]: [...(currentTrack.details[key] || [""]), ""] } });
  }, [currentTrack, updateCurrent]);

  const removeDetailEntry = useCallback((key: string, index: number) => {
    if (!currentTrack) return;
    const arr = (currentTrack.details[key] || []).filter((_, i) => i !== index);
    updateCurrent({ details: { ...currentTrack.details, [key]: arr } });
  }, [currentTrack, updateCurrent]);

  // Stems
  const handleStemsUpload = useCallback((files: FileList) => {
    if (!currentTrack) return;
    const newStems: StemFile[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      size: formatFileSize(f.size),
    }));
    updateCurrent({ stems: [...currentTrack.stems, ...newStems] });
  }, [currentTrack, updateCurrent]);

  const removeStem = useCallback((id: string) => {
    if (!currentTrack) return;
    updateCurrent({ stems: currentTrack.stems.filter((s) => s.id !== id) });
  }, [currentTrack, updateCurrent]);

  // Splits
  const redistributeSplits = (updatedSplits: Split[], changedId?: string): Split[] => {
    if (!changedId) {
      const equal = parseFloat((100 / updatedSplits.length).toFixed(2));
      const total = parseFloat((equal * updatedSplits.length).toFixed(2));
      const diff = parseFloat((100 - total).toFixed(2));
      return updatedSplits.map((s, i) => ({
        ...s,
        percentage: i === 0 ? parseFloat((equal + diff).toFixed(2)) : equal,
      }));
    }
    const changed = updatedSplits.find((s) => s.id === changedId);
    const others = updatedSplits.filter((s) => s.id !== changedId);
    const remaining = parseFloat(Math.max(0, 100 - (changed?.percentage || 0)).toFixed(2));
    if (others.length === 0) return updatedSplits;
    const each = parseFloat((remaining / others.length).toFixed(2));
    const total = parseFloat((each * others.length).toFixed(2));
    const diff = parseFloat((remaining - total).toFixed(2));
    let idx = 0;
    return updatedSplits.map((s) => {
      if (s.id === changedId) return s;
      const val = idx === 0 ? parseFloat((each + diff).toFixed(2)) : each;
      idx++;
      return { ...s, percentage: val };
    });
  };

  const addSplit = useCallback(() => {
    if (!currentTrack) return;
    const newSplits = [
      ...currentTrack.splits,
      { id: crypto.randomUUID(), name: "", role: "", percentage: 0, pro: "", ipi: "", publisher: "" },
    ];
    updateCurrent({ splits: redistributeSplits(newSplits) });
  }, [currentTrack, updateCurrent]);

  const updateSplit = useCallback((id: string, field: keyof Split, value: string | number) => {
    if (!currentTrack) return;
    const updated = currentTrack.splits.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    if (field === "percentage") {
      updateCurrent({ splits: redistributeSplits(updated, id) });
    } else {
      updateCurrent({ splits: updated });
    }
  }, [currentTrack, updateCurrent]);

  const removeSplit = useCallback((id: string) => {
    if (!currentTrack || currentTrack.splits.length <= 1) return;
    updateCurrent({ splits: redistributeSplits(currentTrack.splits.filter((s) => s.id !== id)) });
  }, [currentTrack, updateCurrent]);

  const totalSplit = currentTrack ? currentTrack.splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) : 0;

  // ─── Preview playback ──────────────────────────────────────

  const togglePreview = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  }, [isPlayingPreview]);

  // ─── Save ──────────────────────────────────────────────────

  const saveCurrentTrack = useCallback(() => {
    if (!currentTrack) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const newId = Math.max(...tracks.map((t) => t.id), ...queue.map((_, i) => tracks.length + i), 0) + 1 + currentIdx;

    const newTrack: TrackData = {
      id: newId,
      title: currentTrack.title.trim() || "Untitled",
      artist: currentTrack.artist.trim() || "Unknown Artist",
      featuredArtists: [],
      album: "",
      genre: currentTrack.genre || "",
      bpm: parseInt(currentTrack.bpm) || 0,
      key: currentTrack.trackKey || "",
      duration: currentTrack.analysisResult?.duration || "0:00",
      mood: currentTrack.mood,
      status: "Available",
      isrc: "",
      upc: "",
      releaseDate: "",
      label: "",
      publisher: "",
      writtenBy: (currentTrack.details.songwriters || []).filter(Boolean),
      producedBy: (currentTrack.details.producers || []).filter(Boolean),
      mixedBy: (currentTrack.details.mixingEngineer || []).filter(Boolean).join(", "),
      masteredBy: (currentTrack.details.masteringEngineer || []).filter(Boolean).join(", "),
      copyright: "",
      language: currentTrack.language || "",
      voice: currentTrack.voice || "N/A",
      explicit: false,
      type: "Song",
      coverIdx: newId % 6,
      previewUrl: currentTrack.compressed?.url || undefined,
      originalFileName: currentTrack.fileName,
      originalFileSize: currentTrack.file.size,
      originalFileUrl: URL.createObjectURL(currentTrack.file),
      notes: currentTrack.notes,
      details: currentTrack.details,
      lyrics: currentTrack.lyrics || undefined,
      stems: currentTrack.stems.map((s, i) => ({
        id: `stem-${newId}-${i}`,
        fileName: s.name,
        type: "other",
        fileSize: s.size,
        uploadDate: dateStr,
        color: "text-muted-foreground",
      })),
      splits: currentTrack.splits.filter((s) => s.name.trim()).map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        share: Number(s.percentage) || 0,
        pro: s.pro,
        ipi: s.ipi,
        publisher: s.publisher,
      })),
      chapters: currentTrack.analysisResult?.chapters,
      statusHistory: [{ status: "Available", date: dateStr, note: "Track uploaded" }],
    };

    addTrack(newTrack);

    // Move to next track or close
    if (currentIdx < queue.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setEditStep(0);
      setIsPlayingPreview(false);
    } else {
      // All done
      onOpenChange(false);
      handleReset();
    }
  }, [currentTrack, currentIdx, queue, tracks, addTrack, onOpenChange]);

  // ─── Navigation ────────────────────────────────────────────

  const handleReset = () => {
    setPhase("upload");
    setQueue([]);
    setCurrentIdx(0);
    setEditStep(0);
    setIsDragOver(false);
    setIsPlayingPreview(false);
  };

  const canProceedEdit = () => {
    return true; // All steps are optional — users can skip
  };

  const startEditing = () => {
    if (queue.length === 0) return;
    setPhase("edit");
    setCurrentIdx(0);
    setEditStep(0);
  };

  const allProcessing = queue.some((e) => e.analyzing);

  // ─── Render ────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleReset(); onOpenChange(val); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[90vh] h-[100dvh] sm:h-auto overflow-hidden flex flex-col p-0 gap-0 bg-card border-border w-full sm:w-auto">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
            {phase === "upload"
              ? "Upload Tracks"
              : `Track ${currentIdx + 1} of ${queue.length}`
            }
          </DialogTitle>

          {phase === "edit" && (
            <>
              {/* Track navigator for bulk */}
              {queue.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {queue.map((entry, i) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        if (i <= currentIdx) {
                          setCurrentIdx(i);
                          setEditStep(0);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full text-2xs font-semibold whitespace-nowrap transition-all ${
                        i === currentIdx
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : i < currentIdx
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-secondary text-muted-foreground/40 border border-transparent"
                      }`}
                    >
                      {i < currentIdx && <Check className="w-2.5 h-2.5 inline mr-1" />}
                      {entry.title || entry.fileName}
                    </button>
                  ))}
                </div>
              )}
              {/* Step indicator */}
              <div className="flex items-center gap-1">
                {EDIT_STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => i < editStep && setEditStep(i)}
                      className={`flex items-center gap-1.5 text-2xs font-semibold transition-colors ${
                        i === editStep
                          ? "text-foreground"
                          : i < editStep
                          ? "text-brand-orange cursor-pointer hover:text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold transition-all ${
                          i < editStep
                            ? "btn-brand shadow-none text-primary-foreground"
                            : i === editStep
                            ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                            : "bg-secondary text-muted-foreground/40"
                        }`}
                      >
                        {i < editStep ? <Check className="w-2.5 h-2.5" /> : i + 1}
                      </span>
                      <span className="hidden sm:inline">{s}</span>
                    </button>
                    {i < EDIT_STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-1 transition-colors ${i < editStep ? "bg-brand-orange/40" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase === "upload" ? "upload" : `edit-${currentIdx}-${editStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {phase === "upload" && (
                <StepBulkUpload
                  queue={queue}
                  isDragOver={isDragOver}
                  fileInputRef={fileInputRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onAddFiles={addFiles}
                  onRemove={removeFromQueue}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 0 && (
                <StepInfo
                  title={currentTrack.title} setTitle={(v) => updateCurrent({ title: v })}
                  artist={currentTrack.artist} setArtist={(v) => updateCurrent({ artist: v })}
                  bpm={currentTrack.bpm} setBpm={(v) => updateCurrent({ bpm: v })}
                  trackKey={currentTrack.trackKey} setTrackKey={(v) => updateCurrent({ trackKey: v })}
                  genre={currentTrack.genre} setGenre={(v) => updateCurrent({ genre: v })}
                  mood={currentTrack.mood} toggleMood={toggleMood}
                  voice={currentTrack.voice} setVoice={(v) => updateCurrent({ voice: v })}
                  language={currentTrack.language} setLanguage={(v) => updateCurrent({ language: v })}
                  notes={currentTrack.notes} setNotes={(v) => updateCurrent({ notes: v })}
                  details={currentTrack.details} updateDetail={updateDetail}
                  addDetailEntry={addDetailEntry} removeDetailEntry={removeDetailEntry}
                  analysisResult={currentTrack.analysisResult}
                  analyzing={currentTrack.analyzing}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 1 && (
                <StepStems
                  stems={currentTrack.stems}
                  stemsInputRef={stemsInputRef}
                  onUpload={handleStemsUpload}
                  onRemove={removeStem}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 2 && (
                <StepLyrics
                  lyrics={currentTrack.lyrics}
                  onUpdate={(v: string) => updateCurrent({ lyrics: v })}
                  fileInputRef={lyricsFileInputRef}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 3 && (
                <StepSplits
                  splits={currentTrack.splits}
                  totalSplit={totalSplit}
                  onAdd={addSplit}
                  onUpdate={updateSplit}
                  onRemove={removeSplit}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 4 && (
                <StepReview
                  title={currentTrack.title} artist={currentTrack.artist}
                  bpm={currentTrack.bpm} trackKey={currentTrack.trackKey}
                  genre={currentTrack.genre} mood={currentTrack.mood}
                  voice={currentTrack.voice}
                  language={currentTrack.language} notes={currentTrack.notes}
                  audioFile={currentTrack.file} stems={currentTrack.stems}
                  splits={currentTrack.splits} totalSplit={totalSplit}
                  details={currentTrack.details} lyrics={currentTrack.lyrics}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          {phase === "upload" ? (
            <>
              <span className="text-2xs text-muted-foreground">
                {queue.length} / {MAX_TRACKS} tracks
              </span>
              <button
                onClick={startEditing}
                disabled={queue.length === 0 || allProcessing}
                className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {allProcessing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                ) : (
                  <>Continue <ChevronRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (editStep > 0) setEditStep(editStep - 1);
                  else if (currentIdx > 0) {
                    setCurrentIdx(currentIdx - 1);
                    setEditStep(EDIT_STEPS.length - 1);
                  } else {
                    setPhase("upload");
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              {editStep < EDIT_STEPS.length - 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditStep(editStep + 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-border/80"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => setEditStep(editStep + 1)}
                    className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={saveCurrentTrack}
                  className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
                >
                  <Check className="w-3.5 h-3.5" />
                  {currentIdx < queue.length - 1
                    ? `Save & Next (${currentIdx + 2}/${queue.length})`
                    : queue.length > 1
                    ? "Save All to Catalog"
                    : "Save Track to Catalog"
                  }
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
   Step Components
   ═════════════════════════════════════════════════════════════════════════════ */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}

function FieldInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
    />
  );
}

function FieldSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none font-medium"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ─── Bulk Upload Step ─── */

function StepBulkUpload({
  queue, isDragOver, fileInputRef,
  onDragOver, onDragLeave, onDrop, onAddFiles, onRemove,
}: {
  queue: TrackEntry[];
  isDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Upload Audio Files</h3>
        <p className="text-2xs text-muted-foreground">
          Drag & drop up to {MAX_TRACKS} tracks, or click to browse. Each track will be analyzed automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all group ${
          isDragOver
            ? "border-brand-orange bg-brand-orange/5 scale-[1.02]"
            : queue.length >= MAX_TRACKS
            ? "border-border/50 opacity-50 cursor-not-allowed"
            : "border-border hover:border-brand-orange/30"
        }`}
      >
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
          isDragOver ? "bg-brand-orange/15" : "bg-secondary group-hover:bg-brand-orange/10"
        }`}>
          <Upload className={`w-6 h-6 transition-colors ${
            isDragOver ? "text-brand-orange" : "text-muted-foreground group-hover:text-brand-orange"
          }`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {isDragOver ? "Drop files here" : "Drag & drop audio files"}
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            or click to browse · WAV, MP3, FLAC, AIFF · up to {MAX_TRACKS} tracks
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              onAddFiles(Array.from(e.target.files));
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
              Upload Queue ({queue.length})
            </p>
            {queue.length >= MAX_TRACKS && (
              <span className="text-2xs text-brand-orange font-semibold">Maximum reached</span>
            )}
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
            {queue.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border group">
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                  <FileAudio className="w-3.5 h-3.5 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{entry.fileName}</p>
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    <span>{entry.fileSize}</span>
                    {entry.analyzing && (
                      <span className="flex items-center gap-1 text-brand-purple">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing…
                      </span>
                    )}
                    {entry.analysisResult && !entry.analyzing && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-2.5 h-2.5" /> {entry.analysisResult.bpm} BPM · {entry.analysisResult.key}
                      </span>
                    )}
                    {entry.analysisError && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="w-2.5 h-2.5" /> Analysis failed
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                  className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Info Step ─── */

const DETAIL_FIELDS = [
  { key: "producers", label: "Producer(s)" },
  { key: "songwriters", label: "Songwriter(s)" },
  { key: "recordingEngineer", label: "Recording Engineer" },
  { key: "mixingEngineer", label: "Mixing Engineer" },
  { key: "masteringEngineer", label: "Mastering Engineer" },
  { key: "drumsBy", label: "Drums By" },
  { key: "synthsBy", label: "Synths By" },
  { key: "keysBy", label: "Keys By" },
  { key: "guitarsBy", label: "Guitars By" },
  { key: "bassBy", label: "Bass By" },
  { key: "programmingBy", label: "Programming By" },
  { key: "vocalsBy", label: "Vocals By" },
  { key: "backgroundVocalsBy", label: "Background Vocals By" },
  { key: "mixingStudio", label: "Mixing Studio" },
  { key: "recordingStudio", label: "Recording Studio" },
  { key: "recordingDate", label: "Recording Date" },
];

function StepInfo({
  title, setTitle, artist, setArtist, bpm, setBpm,
  trackKey, setTrackKey, genre, setGenre, mood, toggleMood,
  voice, setVoice,
  language, setLanguage, notes, setNotes,
  details, updateDetail, addDetailEntry, removeDetailEntry,
  analysisResult, analyzing,
}: {
  title: string; setTitle: (v: string) => void;
  artist: string; setArtist: (v: string) => void;
  bpm: string; setBpm: (v: string) => void;
  trackKey: string; setTrackKey: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  mood: string[]; toggleMood: (v: string) => void;
  voice: string; setVoice: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  details: Record<string, string[]>; updateDetail: (key: string, index: number, value: string) => void;
  addDetailEntry: (key: string) => void; removeDetailEntry: (key: string, index: number) => void;
  analysisResult: AudioAnalysisResult | null;
  analyzing: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      {/* Smart analysis banner */}
      {(analyzing || analysisResult) && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-brand-purple/15 flex items-center justify-center">
              {analyzing ? (
                <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
              ) : (
                <Check className="w-3 h-3 text-brand-purple" />
              )}
            </div>
            <span className="text-2xs font-semibold text-foreground">
              {analyzing ? "Analyzing audio…" : "Smart Analysis Complete"}
            </span>
          </div>
          {analysisResult && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-secondary p-2 text-center">
                <p className="text-2xs text-muted-foreground font-medium">BPM</p>
                <p className="text-sm font-bold text-brand-orange">{analysisResult.bpm}</p>
              </div>
              <div className="rounded-lg bg-secondary p-2 text-center">
                <p className="text-2xs text-muted-foreground font-medium">Key</p>
                <p className="text-sm font-bold text-brand-pink">{analysisResult.key}</p>
              </div>
              <div className="rounded-lg bg-secondary p-2 text-center">
                <p className="text-2xs text-muted-foreground font-medium">Duration</p>
                <p className="text-sm font-bold text-brand-purple">{analysisResult.duration}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Track Title *</FieldLabel>
          <FieldInput value={title} onChange={setTitle} placeholder="e.g. Velvet Hour" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Artist *</FieldLabel>
          <FieldInput value={artist} onChange={setArtist} placeholder="e.g. Kira Nomura" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>BPM {analysisResult && <span className="text-brand-orange text-[9px] ml-1">AUTO</span>}</FieldLabel>
          <FieldInput value={bpm} onChange={setBpm} placeholder="120" type="number" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Key {analysisResult && <span className="text-brand-orange text-[9px] ml-1">AUTO</span>}</FieldLabel>
          <FieldSelect value={trackKey} onChange={setTrackKey} options={KEYS} placeholder="Select key" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Genre</FieldLabel>
          {genre === "__other__" || (!GENRES.includes(genre) && genre !== "") ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={genre === "__other__" ? "" : genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Enter custom genre"
                autoFocus
                className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
              />
              <button
                onClick={() => setGenre("")}
                className="shrink-0 h-9 px-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none font-medium"
            >
              <option value="">Select genre</option>
              {GENRES.map((o) => <option key={o} value={o}>{o}</option>)}
              <option value="__other__">Other…</option>
            </select>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Mood</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMood(m)}
              className={`px-2.5 py-1 rounded-full text-2xs font-semibold transition-all ${
                mood.includes(m)
                  ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                  : "bg-secondary text-muted-foreground border border-border hover:border-brand-orange/20 hover:text-foreground"
              }`}
            >
              #{m}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Gender</FieldLabel>
          <FieldSelect value={voice} onChange={setVoice} options={["Male", "Female", "Duet", "N/A"]} placeholder="Select gender" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Language</FieldLabel>
          <FieldSelect value={language} onChange={setLanguage} options={LANGUAGES} placeholder="Select language" />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes about this track…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40 resize-none"
        />
      </div>

      {/* More Details */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-90" : ""}`} />
          More Details
          <span className="text-2xs text-muted-foreground/50 font-normal">— credits, studios, dates</span>
        </button>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DETAIL_FIELDS.map((f) => {
                const raw = details[f.key];
                const entries = Array.isArray(raw) ? raw : raw ? [raw] : [""];
                const isDate = f.key === "recordingDate";
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-2xs text-muted-foreground font-medium">{f.label}</label>
                    {entries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input
                          type={isDate ? "date" : "text"}
                          value={entry}
                          onChange={(e) => updateDetail(f.key, idx, e.target.value)}
                          placeholder={isDate ? "" : `Enter ${f.label.toLowerCase()}`}
                          className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                        />
                        {entries.length > 1 && (
                          <button
                            onClick={() => removeDetailEntry(f.key, idx)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!isDate && entries[0]?.trim() && (
                      <button
                        onClick={() => addDetailEntry(f.key)}
                        className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors mt-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add another
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── Stems Step ─── */

function StepStems({
  stems, stemsInputRef, onUpload, onRemove,
}: {
  stems: StemFile[];
  stemsInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Stem Files</h3>
        <p className="text-2xs text-muted-foreground">Upload individual stems (Kick, Snare, Bass, Guitar, Vocals, etc.)</p>
      </div>
      <div
        onClick={() => stemsInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-brand-orange/30 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all group"
      >
        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand-orange transition-colors" />
        <p className="text-[13px] font-semibold text-foreground">Add stem files</p>
        <p className="text-2xs text-muted-foreground">Select one or multiple audio files</p>
        <input
          ref={stemsInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {stems.length > 0 && (
        <div className="space-y-1.5">
          {stems.map((stem) => (
            <div key={stem.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
              <FileAudio className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="text-[13px] font-medium text-foreground truncate flex-1">{stem.name}</span>
              <span className="text-2xs text-muted-foreground shrink-0">{stem.size}</span>
              <button onClick={() => onRemove(stem.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <p className="text-2xs text-muted-foreground pt-1">{stems.length} stem{stems.length !== 1 ? "s" : ""} added</p>
        </div>
      )}
    </div>
  );
}

/* ─── Splits Step ─── */

function StepSplits({
  splits, totalSplit, onAdd, onUpdate, onRemove,
}: {
  splits: Split[];
  totalSplit: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Split, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Splits & Credits</h3>
          <p className="text-2xs text-muted-foreground">Add collaborators and assign ownership splits</p>
        </div>
        <div className={`text-xs font-bold tabular-nums ${totalSplit === 100 ? "text-emerald-400" : totalSplit > 100 ? "text-destructive" : "text-brand-orange"}`}>
          {totalSplit}%
        </div>
      </div>
      <div className="space-y-3">
        {splits.map((split, idx) => (
          <div key={split.id} className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-brand-orange" />
                </div>
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Contributor {idx + 1}</span>
              </div>
              {splits.length > 1 && (
                <button onClick={() => onRemove(split.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">Name</label>
                <input value={split.name} onChange={(e) => onUpdate(split.id, "name", e.target.value)} placeholder="Full name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">Role</label>
                <input value={split.role} onChange={(e) => onUpdate(split.id, "role", e.target.value)} placeholder="e.g. Producer" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">Split %</label>
                <input type="number" min={0} max={100} step={0.01} value={split.percentage} onChange={(e) => onUpdate(split.id, "percentage", parseFloat(e.target.value) || 0)} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-mono font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">PRO</label>
                <input value={split.pro} onChange={(e) => onUpdate(split.id, "pro", e.target.value)} placeholder="e.g. ASCAP" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">IPI</label>
                <input value={split.ipi} onChange={(e) => onUpdate(split.id, "ipi", e.target.value)} placeholder="IPI number" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">Publisher</label>
                <input value={split.publisher} onChange={(e) => onUpdate(split.id, "publisher", e.target.value)} placeholder="Publisher name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-brand-orange/30 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all w-full justify-center"
      >
        <Plus className="w-3.5 h-3.5" /> Add Contributor
      </button>
    </div>
  );
}

/* ─── Lyrics Step ─── */

function StepLyrics({
  lyrics, onUpdate, fileInputRef,
}: {
  lyrics: string;
  onUpdate: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith(".txt")) {
      const text = await file.text();
      onUpdate(text);
    } else if (file.name.toLowerCase().endsWith(".pdf")) {
      // Attempt text extraction from PDF
      try {
        const text = await file.text();
        const cleaned = text
          .replace(/[^\x20-\x7E\n\r]/g, " ")
          .replace(/\s{3,}/g, "\n")
          .trim();
        const extracted = cleaned.length > 20 ? cleaned : `[Lyrics imported from ${file.name}]\n\nPaste your lyrics here to replace this placeholder.`;
        onUpdate(extracted);
      } catch {
        onUpdate(`[Lyrics imported from ${file.name}]\n\nPaste your lyrics here.`);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Lyrics</h3>
        <p className="text-2xs text-muted-foreground">Type your lyrics directly or import from a .pdf / .txt file</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-border hover:border-brand-orange/30 text-muted-foreground hover:text-foreground transition-all"
        >
          <Upload className="w-3.5 h-3.5" /> Import .pdf or .txt
        </button>
      </div>

      <textarea
        value={lyrics}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={"[Verse 1]\nYour lyrics here...\n\n[Chorus]\nYour chorus here..."}
        className="w-full min-h-[300px] px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono leading-relaxed outline-none focus:border-brand-orange/30 transition-all resize-y placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

/* ─── Review Step ─── */

function StepReview({
  title, artist, bpm, trackKey, genre, mood, voice, language, notes,
  audioFile, stems, splits, totalSplit, details, lyrics,
}: {
  title: string; artist: string; bpm: string; trackKey: string;
  genre: string; mood: string[]; voice: string; language: string; notes: string;
  audioFile: File | null; stems: StemFile[]; splits: Split[]; totalSplit: number;
  details: Record<string, string[]>;
  lyrics?: string;
}) {
  const filledDetails = DETAIL_FIELDS.filter((f) => details[f.key]?.some((v) => v.trim()));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Review & Save</h3>
        <p className="text-2xs text-muted-foreground">Review your track details before adding to catalog</p>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Info</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <ReviewRow label="Title" value={title} />
          <ReviewRow label="Artist" value={artist} />
          <ReviewRow label="BPM" value={bpm || "—"} />
          <ReviewRow label="Key" value={trackKey || "—"} />
          <ReviewRow label="Genre" value={genre || "—"} />
          <ReviewRow label="Gender" value={voice || "—"} />
          <ReviewRow label="Language" value={language || "—"} />
        </div>
        {mood.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <span className="text-2xs text-muted-foreground font-medium">Mood:</span>
            {mood.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{m}</span>
            ))}
          </div>
        )}
        {notes && <p className="text-2xs text-muted-foreground pt-1 italic">"{notes}"</p>}
      </div>

      {/* Credits */}
      {filledDetails.length > 0 && (
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Credits & Details</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {filledDetails.map((f) => (
              <ReviewRow key={f.key} label={f.label} value={details[f.key].filter((v) => v.trim()).join(", ")} />
            ))}
          </div>
        </div>
      )}

      {/* Audio */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Audio</p>
        {audioFile ? (
          <div className="flex items-center gap-2">
            <FileAudio className="w-3.5 h-3.5 text-brand-orange" />
            <span className="text-[13px] font-medium text-foreground">{audioFile.name}</span>
            <span className="text-2xs text-muted-foreground">({formatFileSize(audioFile.size)})</span>
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">No audio file uploaded</p>
        )}
      </div>

      {/* Stems */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Stems ({stems.length})</p>
        {stems.length > 0 ? (
          <div className="space-y-1">
            {stems.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-[13px]">
                <FileAudio className="w-3 h-3 text-brand-orange" />
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-2xs text-muted-foreground">({s.size})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">No stems uploaded</p>
        )}
      </div>

      {/* Lyrics */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Lyrics</p>
        {lyrics?.trim() ? (
          <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-mono leading-relaxed max-h-32 overflow-y-auto">
            {lyrics}
          </pre>
        ) : (
          <p className="text-2xs text-muted-foreground italic">No lyrics added</p>
        )}
      </div>

      {/* Splits */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Splits ({splits.length})</p>
          <span className={`text-xs font-bold tabular-nums ${totalSplit === 100 ? "text-emerald-400" : "text-brand-orange"}`}>{totalSplit}%</span>
        </div>
        {splits.filter((s) => s.name).length > 0 ? (
          <div className="space-y-1">
            {splits.filter((s) => s.name).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.role && <span className="text-2xs text-muted-foreground">· {s.role}</span>}
                </div>
                <span className="font-mono text-xs font-semibold text-foreground">{s.percentage}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">No contributors added</p>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
