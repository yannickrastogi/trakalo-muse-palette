import { useState, useRef } from "react";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const STEPS = ["Audio", "Info", "Stems", "Splits", "Review"];

const GENRES = ["Ambient", "Electronic", "Glitch Hop", "House", "Indie Pop", "Neo-Soul", "R&B", "Synthwave", "Techno"];
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

interface UploadTrackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadTrackModal({ open, onOpenChange }: UploadTrackModalProps) {
  const [step, setStep] = useState(0);

  // Step 1 (Info)
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [bpm, setBpm] = useState("");
  const [trackKey, setTrackKey] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [notes, setNotes] = useState("");

  // More Details
  const [details, setDetails] = useState<Record<string, string[]>>({});

  // Step 2: Audio
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Stems
  const [stems, setStems] = useState<StemFile[]>([]);
  const stemsInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Splits
  const [splits, setSplits] = useState<Split[]>([
    { id: "1", name: "", role: "", percentage: 100, pro: "", ipi: "", publisher: "" },
  ]);

  const handleAudioUpload = (file: File) => {
    setAudioFile(file);
    setAudioUploading(true);
    setAudioProgress(0);

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setAudioUploading(false);
        setAudioPreviewUrl(URL.createObjectURL(file));
      }
      setAudioProgress(Math.min(progress, 100));
    }, 300);
  };

  const togglePreview = () => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  const handleStemsUpload = (files: FileList) => {
    const newStems: StemFile[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      size: formatFileSize(f.size),
    }));
    setStems((prev) => [...prev, ...newStems]);
  };

  const removeStem = (id: string) => {
    setStems((prev) => prev.filter((s) => s.id !== id));
  };

  const redistributeSplits = (updatedSplits: Split[], changedId?: string) => {
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

  const addSplit = () => {
    setSplits((prev) => {
      const newSplits = [
        ...prev,
        { id: crypto.randomUUID(), name: "", role: "", percentage: 0, pro: "", ipi: "", publisher: "" },
      ];
      return redistributeSplits(newSplits);
    });
  };

  const updateSplit = (id: string, field: keyof Split, value: string | number) => {
    setSplits((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, [field]: value } : s));
      if (field === "percentage") return redistributeSplits(updated, id);
      return updated;
    });
  };

  const removeSplit = (id: string) => {
    if (splits.length <= 1) return;
    setSplits((prev) => redistributeSplits(prev.filter((s) => s.id !== id)));
  };

  const totalSplit = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);

  const toggleMood = (m: string) => {
    setMood((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleReset = () => {
    setStep(0);
    setTitle(""); setArtist(""); setBpm(""); setTrackKey(""); setGenre(""); setMood([]); setLanguage(""); setNotes(""); setDetails({});
    setAudioFile(null); setAudioUploading(false); setAudioProgress(0); setAudioPreviewUrl(null); setIsPlayingPreview(false);
    setStems([]);
    setSplits([{ id: "1", name: "", role: "", percentage: 100, pro: "", ipi: "", publisher: "" }]);
  };

  const handleSave = () => {
    // In a real app this would persist data
    onOpenChange(false);
    handleReset();
  };

  const updateDetail = (key: string, index: number, value: string) => {
    setDetails((prev) => {
      const arr = [...(prev[key] || [])];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const addDetailEntry = (key: string) => {
    setDetails((prev) => ({
      ...prev,
      [key]: [...(prev[key] || [""]), ""],
    }));
  };

  const removeDetailEntry = (key: string, index: number) => {
    setDetails((prev) => {
      const arr = (prev[key] || []).filter((_, i) => i !== index);
      return { ...prev, [key]: arr };
    });
  };

  const canProceed = () => {
    if (step === 1) return title.trim() && artist.trim();
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleReset(); onOpenChange(val); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-card border-border">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight">Upload Track</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-1.5 text-2xs font-semibold transition-colors ${
                    i === step
                      ? "text-foreground"
                      : i < step
                      ? "text-brand-orange cursor-pointer hover:text-foreground"
                      : "text-muted-foreground/40"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold transition-all ${
                      i < step
                        ? "btn-brand shadow-none text-primary-foreground"
                        : i === step
                        ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                        : "bg-secondary text-muted-foreground/40"
                    }`}
                  >
                    {i < step ? <Check className="w-2.5 h-2.5" /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-1 transition-colors ${i < step ? "bg-brand-orange/40" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <StepAudio
                  audioFile={audioFile}
                  audioUploading={audioUploading}
                  audioProgress={audioProgress}
                  audioPreviewUrl={audioPreviewUrl}
                  isPlayingPreview={isPlayingPreview}
                  togglePreview={togglePreview}
                  audioRef={audioRef}
                  audioInputRef={audioInputRef}
                  onUpload={handleAudioUpload}
                  onRemove={() => { setAudioFile(null); setAudioPreviewUrl(null); setAudioProgress(0); }}
                />
              )}
              {step === 1 && (
                <StepInfo
                  title={title} setTitle={setTitle}
                  artist={artist} setArtist={setArtist}
                  bpm={bpm} setBpm={setBpm}
                  trackKey={trackKey} setTrackKey={setTrackKey}
                  genre={genre} setGenre={setGenre}
                  mood={mood} toggleMood={toggleMood}
                  language={language} setLanguage={setLanguage}
                  notes={notes} setNotes={setNotes}
                  details={details} updateDetail={updateDetail}
                  addDetailEntry={addDetailEntry} removeDetailEntry={removeDetailEntry}
                />
              )}
              {step === 2 && (
                <StepStems
                  stems={stems}
                  stemsInputRef={stemsInputRef}
                  onUpload={handleStemsUpload}
                  onRemove={removeStem}
                />
              )}
              {step === 3 && (
                <StepSplits
                  splits={splits}
                  totalSplit={totalSplit}
                  onAdd={addSplit}
                  onUpdate={updateSplit}
                  onRemove={removeSplit}
                />
              )}
              {step === 4 && (
                <StepReview
                  title={title} artist={artist} bpm={bpm} trackKey={trackKey}
                  genre={genre} mood={mood} language={language} notes={notes}
                  audioFile={audioFile} stems={stems} splits={splits} totalSplit={totalSplit}
                  details={details}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => canProceed() && setStep(step + 1)}
              disabled={!canProceed()}
              className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
            >
              <Check className="w-3.5 h-3.5" /> Save Track to Catalog
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Step Components ─── */

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
  language, setLanguage, notes, setNotes,
  details, updateDetail, addDetailEntry, removeDetailEntry,
}: {
  title: string; setTitle: (v: string) => void;
  artist: string; setArtist: (v: string) => void;
  bpm: string; setBpm: (v: string) => void;
  trackKey: string; setTrackKey: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  mood: string[]; toggleMood: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  details: Record<string, string[]>; updateDetail: (key: string, index: number, value: string) => void;
  addDetailEntry: (key: string) => void; removeDetailEntry: (key: string, index: number) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
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
          <FieldLabel>BPM</FieldLabel>
          <FieldInput value={bpm} onChange={setBpm} placeholder="120" type="number" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Key</FieldLabel>
          <FieldSelect value={trackKey} onChange={setTrackKey} options={KEYS} placeholder="Select key" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Genre</FieldLabel>
          <FieldSelect value={genre} onChange={setGenre} options={GENRES} placeholder="Select genre" />
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
      <div className="space-y-1.5">
        <FieldLabel>Language</FieldLabel>
        <FieldSelect value={language} onChange={setLanguage} options={LANGUAGES} placeholder="Select language" />
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
                const entries = details[f.key] || [""];
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

function StepAudio({
  audioFile, audioUploading, audioProgress, audioPreviewUrl,
  isPlayingPreview, togglePreview, audioRef, audioInputRef,
  onUpload, onRemove,
}: {
  audioFile: File | null;
  audioUploading: boolean;
  audioProgress: number;
  audioPreviewUrl: string | null;
  isPlayingPreview: boolean;
  togglePreview: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  audioInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Main Track File</h3>
        <p className="text-2xs text-muted-foreground">Upload the master audio file (WAV, MP3, FLAC, AIFF)</p>
      </div>

      {!audioFile ? (
        <div
          onClick={() => audioInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-brand-orange/30 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-brand-orange/10 transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground group-hover:text-brand-orange transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Click to upload</p>
            <p className="text-2xs text-muted-foreground mt-1">WAV, MP3, FLAC, or AIFF up to 100 MB</p>
          </div>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
              <FileAudio className="w-4 h-4 text-brand-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{audioFile.name}</p>
              <p className="text-2xs text-muted-foreground">{formatFileSize(audioFile.size)}</p>
            </div>
            {!audioUploading && (
              <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {audioUploading && (
            <div className="space-y-1.5">
              <Progress value={audioProgress} className="h-1.5 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-brand-orange [&>div]:to-brand-pink" />
              <p className="text-2xs text-muted-foreground text-right">{Math.round(audioProgress)}%</p>
            </div>
          )}

          {audioPreviewUrl && !audioUploading && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={togglePreview}
                className="w-8 h-8 rounded-full btn-brand shadow-none flex items-center justify-center shrink-0"
              >
                {isPlayingPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
              </button>
              <div className="flex-1 h-8 rounded-lg bg-secondary flex items-center px-3">
                <div className="flex items-center gap-[2px] h-4">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-brand-orange/40"
                      style={{ height: `${Math.random() * 100}%`, minHeight: 3 }}
                    />
                  ))}
                </div>
              </div>
              <audio ref={audioRef} src={audioPreviewUrl} />
            </div>
          )}

          {!audioUploading && (
            <div className="flex items-center gap-1.5 text-2xs text-emerald-400 font-semibold">
              <Check className="w-3 h-3" /> Upload complete
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

function StepReview({
  title, artist, bpm, trackKey, genre, mood, language, notes,
  audioFile, stems, splits, totalSplit, details,
}: {
  title: string; artist: string; bpm: string; trackKey: string;
  genre: string; mood: string[]; language: string; notes: string;
  audioFile: File | null; stems: StemFile[]; splits: Split[]; totalSplit: number;
  details: Record<string, string>;
}) {
  const filledDetails = DETAIL_FIELDS.filter((f) => details[f.key]?.trim());

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

      {/* More Details */}
      {filledDetails.length > 0 && (
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Credits & Details</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {filledDetails.map((f) => (
              <ReviewRow key={f.key} label={f.label} value={details[f.key]} />
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
