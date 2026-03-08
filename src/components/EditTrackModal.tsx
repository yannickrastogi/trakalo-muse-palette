import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ChevronRight,
  Plus,
  Save,
  User,
  Trash2,
} from "lucide-react";
import { useTrack, type TrackData, type TrackSplit } from "@/contexts/TrackContext";
import { toast } from "sonner";

import { GENRES, KEYS, MOODS, LANGUAGES } from "@/lib/constants";
const TYPES = ["Song", "Instrumental", "Sample", "Acapella"];

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

interface EditTrackModalProps {
  open: boolean;
  onClose: () => void;
  trackId: number;
}

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

function FieldSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
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

export function EditTrackModal({ open, onClose, trackId }: EditTrackModalProps) {
  const { getTrack, updateTrack, updateTrackSplits } = useTrack();
  const trackData = getTrack(trackId);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [featuredArtists, setFeaturedArtists] = useState("");
  const [album, setAlbum] = useState("");
  const [bpm, setBpm] = useState("");
  const [trackKey, setTrackKey] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState<string[]>([]);
  const [voice, setVoice] = useState("");
  const [language, setLanguage] = useState("");
  const [trackType, setTrackType] = useState("");
  const [notes, setNotes] = useState("");
  const [isrc, setIsrc] = useState("");
  const [upc, setUpc] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [label, setLabel] = useState("");
  const [publisher, setPublisher] = useState("");
  const [copyright, setCopyright] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [details, setDetails] = useState<Record<string, string[]>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [splits, setSplits] = useState<TrackSplit[]>([]);

  // Populate form when modal opens
  useEffect(() => {
    if (open && trackData) {
      setTitle(trackData.title);
      setArtist(trackData.artist);
      setFeaturedArtists(trackData.featuredArtists.join(", "));
      setAlbum(trackData.album);
      setBpm(String(trackData.bpm || ""));
      setTrackKey(trackData.key);
      setGenre(trackData.genre);
      setMood([...trackData.mood]);
      setVoice(trackData.voice || "");
      setLanguage(trackData.language);
      setTrackType(trackData.type);
      setNotes(trackData.notes);
      setIsrc(trackData.isrc);
      setUpc(trackData.upc);
      setReleaseDate(trackData.releaseDate);
      setLabel(trackData.label);
      setPublisher(trackData.publisher);
      setCopyright(trackData.copyright);
      setExplicit(trackData.explicit);
      setDetails(JSON.parse(JSON.stringify(trackData.details || {})));
      setSplits(trackData.splits?.length ? trackData.splits.map(s => ({ ...s })) : [{ id: "1", name: "", role: "", share: 100, pro: "", ipi: "", publisher: "" }]);
    }
  }, [open, trackId]);

  const toggleMood = (m: string) => {
    setMood((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const updateDetail = (key: string, index: number, value: string) => {
    setDetails((prev) => {
      const arr = [...(prev[key] || [""])];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const addDetailEntry = (key: string) => {
    setDetails((prev) => ({ ...prev, [key]: [...(prev[key] || [""]), ""] }));
  };

  const removeDetailEntry = (key: string, index: number) => {
    setDetails((prev) => {
      const arr = [...(prev[key] || [])];
      arr.splice(index, 1);
      return { ...prev, [key]: arr.length ? arr : [""] };
    });
  };

  const handleSave = () => {
    if (!title.trim() || !artist.trim()) {
      toast.error("Title and Artist are required");
      return;
    }

    const updates: Partial<TrackData> = {
      title: title.trim(),
      artist: artist.trim(),
      featuredArtists: featuredArtists.split(",").map((s) => s.trim()).filter(Boolean),
      album: album.trim(),
      bpm: Number(bpm) || 0,
      key: trackKey,
      genre,
      mood,
      voice,
      language,
      type: trackType,
      notes: notes.trim(),
      isrc: isrc.trim(),
      upc: upc.trim(),
      releaseDate,
      label: label.trim(),
      publisher: publisher.trim(),
      copyright: copyright.trim(),
      explicit,
      details,
    };

    updateTrack(trackId, updates);
    toast.success("Track updated successfully");
    onClose();
  };

  if (!trackData) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Edit Track</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{trackData.title} — {trackData.artist}</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title & Artist */}
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

              {/* Featured Artists & Album */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Featured Artists</FieldLabel>
                  <FieldInput value={featuredArtists} onChange={setFeaturedArtists} placeholder="Comma separated" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Album / EP</FieldLabel>
                  <FieldInput value={album} onChange={setAlbum} placeholder="e.g. Late Bloom EP" />
                </div>
              </div>

              {/* BPM, Key, Genre */}
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
                  {genre === "__other__" || (!(GENRES as readonly string[]).includes(genre) && genre !== "") ? (
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

              {/* Type, Gender & Language */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Type</FieldLabel>
                  <FieldSelect value={trackType} onChange={setTrackType} options={TYPES} placeholder="Select type" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Gender</FieldLabel>
                  <FieldSelect value={voice} onChange={setVoice} options={["Male", "Female", "Duet", "N/A"]} placeholder="Select gender" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Language</FieldLabel>
                  <FieldSelect value={language} onChange={setLanguage} options={LANGUAGES} placeholder="Select language" />
                </div>
              </div>

              {/* Mood Tags */}
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

              {/* ISRC, UPC, Release Date */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>ISRC</FieldLabel>
                  <FieldInput value={isrc} onChange={setIsrc} placeholder="e.g. USRC12600001" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>UPC</FieldLabel>
                  <FieldInput value={upc} onChange={setUpc} placeholder="e.g. 0850123456789" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Release Date</FieldLabel>
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Label, Publisher, Copyright */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Label</FieldLabel>
                  <FieldInput value={label} onChange={setLabel} placeholder="e.g. Nightfall Records" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Publisher</FieldLabel>
                  <FieldInput value={publisher} onChange={setPublisher} placeholder="e.g. Nomura Publishing" />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Copyright</FieldLabel>
                <FieldInput value={copyright} onChange={setCopyright} placeholder="e.g. © 2026 Nightfall Records" />
              </div>

              {/* Explicit toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExplicit(!explicit)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    explicit ? "bg-brand-orange" : "bg-secondary border border-border"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-foreground absolute top-1 transition-all ${
                      explicit ? "left-5" : "left-1"
                    }`}
                  />
                </button>
                <span className="text-xs font-medium text-foreground">Explicit Content</span>
              </div>

              {/* Notes */}
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

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
