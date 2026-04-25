import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ChevronRight,
  Plus,
  Save,
  User,
  Trash2,
  Scale,
} from "lucide-react";
import { useTrack, type TrackData, type TrackSplit } from "@/contexts/TrackContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { GENRES, KEYS, MOODS, LANGUAGES } from "@/lib/constants";
import { equalSplit } from "@/lib/split-utils";
import { NameAutocomplete } from "@/components/NameAutocomplete";
import { CollaboratorAutocomplete } from "@/components/CollaboratorAutocomplete";
import { useContacts } from "@/contexts/ContactsContext";
import type { CustomCreditEntry } from "@/components/PerformerCreditsSection";
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

function LanguageMultiSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(", ").filter(Boolean) : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = LANGUAGES.filter((l) => !selected.includes(l) && l.toLowerCase().includes(search.toLowerCase()));

  const add = (lang: string) => {
    const next = [...selected, lang].join(", ");
    onChange(next);
    setSearch("");
  };
  const remove = (lang: string) => {
    const next = selected.filter((s) => s !== lang).join(", ");
    onChange(next);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((lang) => (
            <span key={lang} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-orange/10 text-brand-orange">
              {lang}
              <button type="button" onClick={() => remove(lang)} className="hover:text-foreground transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selected.length > 0 ? "" : placeholder}
        className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-secondary border border-border shadow-lg">
          {filtered.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => add(lang)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/10 transition-colors font-medium"
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditTrackModal({ open, onClose, trackId }: EditTrackModalProps) {
  const { getTrack, updateTrack, updateTrackSplits } = useTrack();
  const { user } = useAuth();
  const { contacts, refreshContacts } = useContacts();
  const { activeWorkspace } = useWorkspace();
  const { t } = useTranslation();
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
  const [publishers, setPublishers] = useState<string[]>([]);
  const [copyright, setCopyright] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [details, setDetails] = useState<Record<string, string[]>>({});
  const [showDetails, setShowDetails] = useState(false);
  const [customPerformers, setCustomPerformers] = useState<CustomCreditEntry[]>([]);
  const [customProduction, setCustomProduction] = useState<CustomCreditEntry[]>([]);
  const [splits, setSplits] = useState<TrackSplit[]>([]);
  const [initialBpm, setInitialBpm] = useState("");
  const [initialKey, setInitialKey] = useState("");
  const populatedRef = useRef(false);

  // Reset populated flag when modal closes
  useEffect(() => {
    if (!open) populatedRef.current = false;
  }, [open]);

  // Populate form when modal opens (or when trackData arrives)
  useEffect(() => {
    if (open && trackData && !populatedRef.current) {
      populatedRef.current = true;
      setTitle(trackData.title);
      setArtist(trackData.artist);
      setFeaturedArtists(trackData.featuredArtists.join(", "));
      setAlbum(trackData.album);
      const bpmStr = String(trackData.bpm || "");
      setBpm(bpmStr);
      setInitialBpm(bpmStr);
      setTrackKey(trackData.key);
      setInitialKey(trackData.key);
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
      setPublishers(trackData.publishers.length ? [...trackData.publishers] : [""]);
      setCopyright(trackData.copyright);
      setExplicit(trackData.explicit);
      const credits = trackData.credits || {};
      setDetails(JSON.parse(JSON.stringify(credits)));
      setCustomPerformers(Array.isArray(credits.customPerformers) ? (credits.customPerformers as unknown as CustomCreditEntry[]).map(e => ({ ...e })) : []);
      setCustomProduction(Array.isArray(credits.customProduction) ? (credits.customProduction as unknown as CustomCreditEntry[]).map(e => ({ ...e })) : []);
      setSplits(trackData.splits?.length ? trackData.splits.map(s => ({ ...s })) : [{ id: "1", name: "", role: "", share: 100, pro: "", ipi: "", publisher: "" }]);
    }
  }, [open, trackId, trackData]);

  const toggleMood = (m: string) => {
    setMood((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : prev.length < 8 ? [...prev, m] : prev);
  };

  const addCustomMood = (tag: string) => {
    const normalized = tag.trim().toLowerCase().replace(/^#/, "");
    if (!normalized) return;
    setMood((prev) => {
      if (prev.includes(normalized)) return prev;
      if (prev.length >= 8) return prev;
      return [...prev, normalized];
    });
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

  // ─── Splits logic ───
  const [splitsManuallyEdited, setSplitsManuallyEdited] = useState(false);

  const addSplit = useCallback(() => {
    const newSplits = [...splits, { id: crypto.randomUUID(), name: "", role: "", share: 0, pro: "", ipi: "", publisher: "" }];
    if (splitsManuallyEdited) {
      setSplits(newSplits);
    } else {
      setSplits(equalSplit(newSplits, "share"));
    }
  }, [splits, splitsManuallyEdited]);

  const updateSplit = useCallback((id: string, field: keyof TrackSplit, value: string | number) => {
    const updated = splits.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    if (field === "share") setSplitsManuallyEdited(true);
    setSplits(updated);
  }, [splits]);

  const removeSplit = useCallback((id: string) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter((s) => s.id !== id));
  }, [splits]);

  const equalSplitAll = useCallback(() => {
    setSplits(equalSplit(splits, "share"));
    setSplitsManuallyEdited(false);
  }, [splits]);

  const totalSplit = splits.reduce((sum, s) => sum + (Number(s.share) || 0), 0);

  const handleSave = async () => {
    if (!title.trim() || !artist.trim()) {
      toast.error(t("editTrack.titleRequired"));
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
      publishers: publishers.filter(Boolean).map(p => p.trim()),
      copyright: copyright.trim(),
      explicit,
      credits: {
        ...details,
        customPerformers: customPerformers.filter((e) => e.role.trim() && e.values.some((v) => v.trim())),
        customProduction: customProduction.filter((e) => e.role.trim() && e.values.some((v) => v.trim())),
      },
    };

    updateTrack(trackId, updates);
    var filteredSplits = splits.filter(s => s.name.trim());
    updateTrackSplits(trackId, filteredSplits);

    // Auto-save collaborators to contacts (direct RPC, fire-and-forget)
    if (user && activeWorkspace) {
      (async () => {
        for (var i = 0; i < filteredSplits.length; i++) {
          var sp = filteredSplits[i];
          var parts = sp.name.trim().split(" ");
          var proArray = sp.pro ? sp.pro.split(", ").filter(Boolean) : null;
          try {
            var { error } = await supabase.rpc("upsert_contact", {
              _user_id: user.id,
              _workspace_id: activeWorkspace.id,
              _first_name: parts[0] || "",
              _last_name: parts.slice(1).join(" ") || null,
              _email: (sp as any).email && (sp as any).email.trim() !== "" ? (sp as any).email.trim() : null,
              _role: sp.role && sp.role.trim() !== "" ? sp.role.trim() : null,
              _stage_name: sp.stage_name && sp.stage_name.trim() !== "" ? sp.stage_name.trim() : null,
              _company: null,
              _phone: null,
              _pro: proArray && proArray.length > 0 ? proArray : null,
              _ipi: sp.ipi && sp.ipi.trim() !== "" ? sp.ipi.trim() : null,
              _publisher: sp.publisher && sp.publisher.trim() !== "" ? sp.publisher.trim() : null,
            });
            if (error) console.error("[SPLITS SAVE-BACK] upsert_contact error for", sp.name, ":", error);
          } catch (err) {
            console.error("[SPLITS SAVE-BACK] Failed for", sp.name, ":", err);
          }
        }
        refreshContacts();
      })();
    }

    // Sync user metadata + mood descriptors to sonic_dna
    if (trackData?.uuid) {
      try {
        const { data: row } = await supabase
          .from("tracks")
          .select("sonic_dna")
          .eq("id", trackData.uuid)
          .single();

        const existingSonicDna = row?.sonic_dna as Record<string, unknown> | null;
        if (existingSonicDna) {
          const updatedSonicDna = {
            ...existingSonicDna,
            mood: {
              ...(existingSonicDna.mood as Record<string, unknown> || {}),
              descriptors: mood,
            },
            user_metadata: {
              genre,
              type: trackType,
              gender: voice,
              language,
              mood,
              bpm: Number(bpm) || 0,
              key: trackKey,
              title: title.trim(),
              artist: artist.trim(),
              featuring: featuredArtists.split(",").map((s) => s.trim()).filter(Boolean),
            },
          };
          const { error } = await supabase.rpc("update_track", {
            _user_id: user?.id || null,
            _track_id: trackData.uuid,
            _updates: { sonic_dna: updatedSonicDna },
          });

          if (!error) {
            toast.success("Sonic DNA updated");
          } else {
            console.error("Failed to sync sonic_dna:", error);
          }
        }
      } catch (err) {
        console.error("Failed to sync sonic_dna:", err);
      }
    }

    toast.success(t("editTrack.trackUpdated"));
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
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative z-10 w-full md:max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95dvh] md:max-h-[90vh] flex flex-col"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("editTrack.title")}</h3>
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
                  <FieldLabel>{t("editTrack.trackTitle") + " *"}</FieldLabel>
                  <FieldInput value={title} onChange={setTitle} placeholder={t("editTrack.titlePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.artist") + " *"}</FieldLabel>
                  <FieldInput value={artist} onChange={setArtist} placeholder={t("editTrack.artistPlaceholder")} />
                </div>
              </div>

              {/* Featured Artists & Album */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.featuredArtists")}</FieldLabel>
                  <FieldInput value={featuredArtists} onChange={setFeaturedArtists} placeholder={t("editTrack.commaSeparated")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.albumEp")}</FieldLabel>
                  <FieldInput value={album} onChange={setAlbum} placeholder={t("editTrack.albumPlaceholder")} />
                </div>
              </div>

              {/* BPM, Key, Genre */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.bpm")}</FieldLabel>
                  <FieldInput value={bpm} onChange={setBpm} placeholder="120" type="number" />
                  {initialBpm && bpm !== initialBpm && (
                    <p className="text-2xs text-amber-500 mt-0.5">⚠️ Sonic DNA detected {initialBpm}. Are you sure you want to change this?</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.key")}</FieldLabel>
                  <FieldSelect value={trackKey} onChange={setTrackKey} options={trackKey && !(KEYS as readonly string[]).includes(trackKey) ? [trackKey, ...KEYS] : KEYS} placeholder={t("editTrack.selectKey")} />
                  {initialKey && trackKey !== initialKey && (
                    <p className="text-2xs text-amber-500 mt-0.5">⚠️ Sonic DNA detected {initialKey}. Are you sure you want to change this?</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.genre")}</FieldLabel>
                  {genre === "__other__" || (!(GENRES as readonly string[]).includes(genre) && genre !== "") ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={genre === "__other__" ? "" : genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder={t("editTrack.customGenre")}
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
                      <option value="">{t("editTrack.selectGenre")}</option>
                      {GENRES.map((o) => <option key={o} value={o}>{o}</option>)}
                      <option value="__other__">{t("editTrack.other")}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Type, Gender & Language */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.type")}</FieldLabel>
                  <FieldSelect value={trackType} onChange={setTrackType} options={TYPES} placeholder={t("editTrack.selectType")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.gender")}</FieldLabel>
                  <FieldSelect value={voice} onChange={setVoice} options={["Male", "Female", "Duet", "N/A"]} placeholder={t("editTrack.selectGender")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.language")}</FieldLabel>
                  <LanguageMultiSelect value={language} onChange={setLanguage} placeholder={t("editTrack.selectLanguage")} />
                </div>
              </div>

              {/* Mood Tags */}
              <div className="space-y-1.5">
                <FieldLabel>{t("editTrack.mood")} <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">({mood.length}/8)</span></FieldLabel>
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
                  {mood.filter((m) => !(MOODS as readonly string[]).includes(m)).map((m) => (
                    <button
                      key={m}
                      onClick={() => toggleMood(m)}
                      className="px-2.5 py-1 rounded-full text-2xs font-semibold transition-all bg-brand-orange/15 text-brand-orange border border-brand-orange/30 flex items-center gap-1"
                    >
                      #{m}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add custom tag..."
                  className="h-7 px-2.5 rounded-full bg-secondary border border-border text-2xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40 w-36"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomMood((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>

              {/* ISRC, UPC, Release Date */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.isrc")}</FieldLabel>
                  <FieldInput value={isrc} onChange={setIsrc} placeholder={t("editTrack.isrcPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.upc")}</FieldLabel>
                  <FieldInput value={upc} onChange={setUpc} placeholder={t("editTrack.upcPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.releaseDate")}</FieldLabel>
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
                  <FieldLabel>{t("editTrack.label")}</FieldLabel>
                  <FieldInput value={label} onChange={setLabel} placeholder={t("editTrack.labelPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t("editTrack.publisher")}</FieldLabel>
                  {publishers.map((pub, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <input
                        type="text"
                        value={pub}
                        onChange={(e) => { const updated = [...publishers]; updated[idx] = e.target.value; setPublishers(updated); }}
                        placeholder={t("editTrack.publisherPlaceholder")}
                        className="h-9 flex-1 px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                      />
                      {publishers.length > 1 && (
                        <button type="button" onClick={() => setPublishers(publishers.filter((_, i) => i !== idx))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setPublishers([...publishers, ""])} className="text-2xs text-primary hover:text-primary/80 font-medium">
                    + {t("uploadTrack.addAnother", "Add another")}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("editTrack.copyright")}</FieldLabel>
                <FieldInput value={copyright} onChange={setCopyright} placeholder={t("editTrack.copyrightPlaceholder")} />
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
                <span className="text-xs font-medium text-foreground">{t("editTrack.explicit")}</span>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <FieldLabel>{t("editTrack.notes")}</FieldLabel>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this track…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40 resize-none"
                />
              </div>

              {/* Splits */}
              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Splits & Credits</h4>
                  <p className="text-2xs text-muted-foreground">Add collaborators and assign ownership splits</p>
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
                          <button onClick={() => removeSplit(split.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.name")}</label>
                          <CollaboratorAutocomplete value={split.name} onChange={(v) => updateSplit(split.id, "name", v)} onSelect={(s) => { var patch: Partial<TrackSplit> = { name: s.fullName }; if (s.stage_name && !split.stage_name) patch.stage_name = s.stage_name; if (s.role && !split.role) patch.role = s.role; if (s.pro && !split.pro) patch.pro = s.pro; if (s.ipi && !split.ipi) patch.ipi = s.ipi; if (s.publisher && !split.publisher) patch.publisher = s.publisher; setSplits(function (prev) { return prev.map(function (sp) { return sp.id === split.id ? { ...sp, ...patch } : sp; }); }); }} contacts={contacts} placeholder="Full name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.role")}</label>
                          <input value={split.role} onChange={(e) => updateSplit(split.id, "role", e.target.value)} placeholder={t("editTrack.rolePlaceholder")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.share")}</label>
                          <div className="flex items-center gap-1">
                            <input type="text" inputMode="decimal" value={split.share === 0 ? "0" : String(split.share)} onChange={(e) => { var v = e.target.value.replace(/[^0-9.]/g, ""); if (v.length > 1 && v.startsWith("0") && v[1] !== ".") v = v.replace(/^0+/, ""); var n = parseFloat(v); if (!isNaN(n) && n > 100) v = "100"; updateSplit(split.id, "share", v === "" ? 0 : parseFloat(v) || 0); }} onFocus={(e) => { if (split.share === 0) e.target.select(); }} className="h-8 w-[70px] px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-mono font-medium text-right" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.pro")}</label>
                          <input value={split.pro} onChange={(e) => updateSplit(split.id, "pro", e.target.value)} placeholder={t("editTrack.proPlaceholder")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.ipi")}</label>
                          <input value={split.ipi} onChange={(e) => updateSplit(split.id, "ipi", e.target.value)} placeholder="IPI number" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.publisher")}</label>
                          <input value={split.publisher} onChange={(e) => updateSplit(split.id, "publisher", e.target.value)} placeholder="Publisher name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addSplit}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-brand-orange/30 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5" /> {t("editTrack.addCollaborator")}
                </button>

                {/* Total bar */}
                <div className="space-y-2 mt-2">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${totalSplit === 100 ? "bg-emerald-500" : totalSplit > 100 ? "bg-destructive" : "bg-brand-orange"}`} style={{ width: Math.min(totalSplit, 100) + "%" }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-medium ${totalSplit === 100 ? "text-emerald-400" : totalSplit > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                      {totalSplit === 100 ? "Total: 100% \u2713 Fully allocated" : totalSplit > 100 ? "Total: " + parseFloat(totalSplit.toFixed(2)) + "% \u2014 exceeds 100%!" : "Total: " + parseFloat(totalSplit.toFixed(2)) + "% \u2014 " + parseFloat((100 - totalSplit).toFixed(2)) + "% remaining"}
                    </span>
                    <button type="button" onClick={equalSplitAll} className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <Scale className="w-3 h-3" /> Equal Split
                    </button>
                  </div>
                </div>
              </div>

              {/* Credits */}
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-90" : ""}`} />
                  Credits
                  <span className="text-2xs text-muted-foreground/50 font-normal">— performers, production, studios</span>
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
                        const isStudio = f.key === "mixingStudio" || f.key === "recordingStudio";
                        const isNameField = !isDate && !isStudio;
                        return (
                          <div key={f.key} className="space-y-1">
                            <label className="text-2xs text-muted-foreground font-medium">{f.label}</label>
                            {entries.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                {isNameField ? (
                                  <NameAutocomplete
                                    value={entry}
                                    onChange={(v) => updateDetail(f.key, idx, v)}
                                    placeholder={`Enter ${f.label.toLowerCase()}`}
                                    className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                                    extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))}
                                  />
                                ) : (
                                  <input
                                    type={isDate ? "date" : "text"}
                                    value={entry}
                                    onChange={(e) => updateDetail(f.key, idx, e.target.value)}
                                    placeholder={isDate ? "" : `Enter ${f.label.toLowerCase()}`}
                                    className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
                                  />
                                )}
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

                    {/* Custom Performers */}
                    <div className="space-y-3 pt-3 border-t border-border/50 mt-3">
                      <h5 className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Custom Performer Credits</h5>
                      {customPerformers.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-dashed border-border/60 bg-secondary/30 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={entry.role}
                              onChange={(e) => setCustomPerformers((prev) => prev.map((p) => p.id === entry.id ? { ...p, role: e.target.value } : p))}
                              placeholder="Role name (e.g. Strings By)"
                              className="h-8 flex-1 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-pink-500/30 transition-all font-semibold placeholder:text-muted-foreground/40 placeholder:font-normal"
                            />
                            <button
                              onClick={() => setCustomPerformers((prev) => prev.filter((p) => p.id !== entry.id))}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {entry.values.map((val, idx) => (
                            <div key={idx} className="flex items-center gap-1 pl-1">
                              <NameAutocomplete
                                value={val}
                                onChange={(v) => setCustomPerformers((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: p.values.map((vv, ii) => ii === idx ? v : vv) } : p))}
                                placeholder="Enter name"
                                className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-pink-500/30 transition-all font-medium placeholder:text-muted-foreground/40"
                                extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))}
                              />
                              {entry.values.length > 1 && (
                                <button onClick={() => setCustomPerformers((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: p.values.filter((_, i) => i !== idx) } : p))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {entry.values[0]?.trim() && (
                            <button onClick={() => setCustomPerformers((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: [...p.values, ""] } : p))} className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors ml-1">
                              <Plus className="w-3 h-3" /> Add another
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setCustomPerformers((prev) => [...prev, { id: crypto.randomUUID(), role: "", values: [""] }])}
                        className="flex items-center gap-1.5 text-xs text-pink-500 hover:text-pink-400 font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Custom Performer
                      </button>
                    </div>

                    {/* Custom Production Credits */}
                    <div className="space-y-3 pt-3 border-t border-border/50 mt-3">
                      <h5 className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Custom Production Credits</h5>
                      {customProduction.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-dashed border-border/60 bg-secondary/30 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={entry.role}
                              onChange={(e) => setCustomProduction((prev) => prev.map((p) => p.id === entry.id ? { ...p, role: e.target.value } : p))}
                              placeholder="Role name (e.g. Sound Design By)"
                              className="h-8 flex-1 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-purple-500/30 transition-all font-semibold placeholder:text-muted-foreground/40 placeholder:font-normal"
                            />
                            <button
                              onClick={() => setCustomProduction((prev) => prev.filter((p) => p.id !== entry.id))}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {entry.values.map((val, idx) => (
                            <div key={idx} className="flex items-center gap-1 pl-1">
                              <NameAutocomplete
                                value={val}
                                onChange={(v) => setCustomProduction((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: p.values.map((vv, ii) => ii === idx ? v : vv) } : p))}
                                placeholder="Enter name"
                                className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-purple-500/30 transition-all font-medium placeholder:text-muted-foreground/40"
                                extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))}
                              />
                              {entry.values.length > 1 && (
                                <button onClick={() => setCustomProduction((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: p.values.filter((_, i) => i !== idx) } : p))} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {entry.values[0]?.trim() && (
                            <button onClick={() => setCustomProduction((prev) => prev.map((p) => p.id === entry.id ? { ...p, values: [...p.values, ""] } : p))} className="flex items-center gap-1 text-2xs text-brand-orange hover:text-brand-orange/80 font-semibold transition-colors ml-1">
                              <Plus className="w-3 h-3" /> Add another
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setCustomProduction((prev) => [...prev, { id: crypto.randomUUID(), role: "", values: [""] }])}
                        className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-400 font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Custom Production Credit
                      </button>
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
                <Save className="w-3.5 h-3.5" /> {t("editTrack.saveChanges")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
