import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Plus,
  Music,
  Check,
  ListMusic,
  ImagePlus,
  Hash,
  Play,
  Pause,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { DEFAULT_COVER, KEYS, TRACK_TYPES } from "@/lib/constants";
import { GenreMultiSelect } from "@/components/GenreMultiSelect";

type Track = TrackData;

export interface NewPlaylistData {
  id: string;
  name: string;
  description: string;
  tracks: number;
  duration: string;
  updated: string;
  mood: string;
  coverIdxs: number[];
  color: string;
  trackIds: number[];
  genre?: string[];
  moods?: string[];
  coverImage?: string;
}

interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: NewPlaylistData) => void;
}

const gradientColors = [
  "from-brand-orange/20 to-brand-pink/10",
  "from-brand-purple/20 to-brand-pink/10",
  "from-brand-pink/15 to-brand-purple/15",
  "from-brand-orange/25 to-brand-purple/10",
  "from-brand-pink/20 to-brand-orange/10",
  "from-brand-purple/15 to-brand-orange/15",
];

export function CreatePlaylistModal({ open, onOpenChange, onCreate }: CreatePlaylistModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"details" | "tracks">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [trackSearch, setTrackSearch] = useState("");
  // Track-list filters (step "tracks")
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [moodFilter, setMoodFilter] = useState<string[]>([]);
  const [bpmMin, setBpmMin] = useState<number | null>(null);
  const [bpmMax, setBpmMax] = useState<number | null>(null);
  const [keyFilter, setKeyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [genres, setGenres] = useState<string[]>([]);
  const [moodInput, setMoodInput] = useState("");
  const [moods, setMoods] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setStep("details");
    setName("");
    setDescription("");
    setSelectedTracks([]);
    setTrackSearch("");
    setGenreFilter([]);
    setMoodFilter([]);
    setBpmMin(null);
    setBpmMax(null);
    setKeyFilter("");
    setTypeFilter("");
    setGenres([]);
    setMoodInput("");
    setMoods([]);
    setCoverImage(null);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addMood = (tag: string) => {
    const cleaned = tag.replace(/^#+/, "").trim().toLowerCase();
    if (cleaned && !moods.includes(cleaned)) {
      setMoods((prev) => [...prev, cleaned]);
    }
    setMoodInput("");
  };

  const handleMoodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === " ") && moodInput.trim()) {
      e.preventDefault();
      addMood(moodInput);
    }
    if (e.key === "Backspace" && !moodInput && moods.length > 0) {
      setMoods((prev) => prev.slice(0, -1));
    }
  };

  const removeMood = (tag: string) => {
    setMoods((prev) => prev.filter((m) => m !== tag));
  };

  const { tracks: allTracks } = useTrack();
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();

  // Filter options derived from the catalog (only values actually present)
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    allTracks.forEach((t) => (t.genre || []).forEach((g) => g && set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allTracks]);

  const availableMoods = useMemo(() => {
    const set = new Set<string>();
    allTracks.forEach((t) => (t.mood || []).forEach((m) => m && set.add(m)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allTracks]);

  const availableKeys = useMemo(() => {
    const present = new Set(allTracks.map((t) => t.key).filter(Boolean));
    return KEYS.filter((k) => present.has(k));
  }, [allTracks]);

  const availableTypes = useMemo(() => {
    const present = new Set(allTracks.map((t) => t.type).filter(Boolean));
    return TRACK_TYPES.filter((ty) => present.has(ty));
  }, [allTracks]);

  const availableTracks = useMemo(() => {
    const selectedIds = new Set(selectedTracks.map((t) => t.id));
    let filtered = allTracks.filter((t) => !selectedIds.has(t.id));
    if (trackSearch) {
      const q = trackSearch.toLowerCase();
      filtered = filtered.filter(
        (t) => {
          const genreText = Array.isArray(t.genre) ? t.genre.join(" ") : (t.genre as unknown as string) || "";
          return (
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            genreText.toLowerCase().includes(q)
          );
        }
      );
    }
    if (genreFilter.length) {
      filtered = filtered.filter((t) => (t.genre || []).some((g) => genreFilter.includes(g)));
    }
    if (moodFilter.length) {
      filtered = filtered.filter((t) => (t.mood || []).some((m) => moodFilter.includes(m)));
    }
    if (bpmMin !== null) filtered = filtered.filter((t) => t.bpm != null && t.bpm >= bpmMin);
    if (bpmMax !== null) filtered = filtered.filter((t) => t.bpm != null && t.bpm <= bpmMax);
    if (keyFilter) filtered = filtered.filter((t) => t.key === keyFilter);
    if (typeFilter) filtered = filtered.filter((t) => t.type === typeFilter);
    return filtered;
  }, [trackSearch, selectedTracks, allTracks, genreFilter, moodFilter, bpmMin, bpmMax, keyFilter, typeFilter]);

  const hasActiveFilters =
    genreFilter.length > 0 ||
    moodFilter.length > 0 ||
    bpmMin !== null ||
    bpmMax !== null ||
    !!keyFilter ||
    !!typeFilter;

  const clearFilters = () => {
    setGenreFilter([]);
    setMoodFilter([]);
    setBpmMin(null);
    setBpmMax(null);
    setKeyFilter("");
    setTypeFilter("");
  };

  const addTrack = (track: Track) => setSelectedTracks((prev) => [...prev, track]);
  const removeTrack = (trackId: number) => setSelectedTracks((prev) => prev.filter((t) => t.id !== trackId));

  const canProceed = name.trim().length > 0;
  const canCreate = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="md:max-w-xl bg-card border-border p-0 gap-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg tracking-tight">{t("createPlaylist.title")}</DialogTitle>
            <DialogDescription className="text-muted-foreground/70 text-xs mt-1">
              {step === "details"
                ? t("createPlaylist.detailsDesc")
                : t("createPlaylist.tracksDesc", { count: selectedTracks.length })}
            </DialogDescription>
          </DialogHeader>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setStep("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "details" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "details" ? "btn-brand" : "bg-secondary text-muted-foreground"
              }`}>
                {step === "tracks" && canProceed ? <Check className="w-3 h-3" /> : "1"}
              </span>
              {t("createPlaylist.details")}
            </button>
            <div className="w-6 h-px bg-border" />
            <button
              onClick={() => canProceed && setStep("tracks")}
              disabled={!canProceed}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === "tracks"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold ${
                step === "tracks" ? "btn-brand" : "bg-secondary text-muted-foreground"
              }`}>2</span>
              {t("createPlaylist.tracks")}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {step === "details" ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                {/* Cover Upload + Name row */}
                <div className="flex gap-5">
                  {/* Cover Upload */}
                  <div className="shrink-0">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
                      {t("createPlaylist.cover")}
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-28 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-secondary/50 flex flex-col items-center justify-center gap-1.5 transition-all group overflow-hidden relative"
                    >
                      {coverImage ? (
                        <>
                          <img
                            src={coverImage}
                            alt="Cover"
                            className="absolute inset-0 w-full h-full object-cover rounded-xl"
                          />
                          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <ImagePlus className="w-5 h-5 text-primary" />
                          </div>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-6 h-6 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                          <span className="text-2xs text-muted-foreground/40 group-hover:text-primary/60 font-medium transition-colors">
                            Upload
                          </span>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="hidden"
                    />
                    <p className="text-2xs text-muted-foreground/40 mt-1.5 text-center">Square</p>
                  </div>

                  {/* Name + Description */}
                  <div className="flex-1 space-y-4 min-w-0">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        {t("createPlaylist.playlistName")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("createPlaylist.namePlaceholder")}
                        className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        {t("createPlaylist.description")}
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t("createPlaylist.descPlaceholder")}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors font-medium placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Genre */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t("createPlaylist.genre")}
                  </label>
                  <GenreMultiSelect value={genres} onChange={setGenres} placeholder={t("createPlaylist.selectGenre")} />
                </div>

                {/* Mood hashtags */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t("createPlaylist.mood")}
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl bg-secondary border border-border focus-within:border-primary/40 transition-colors">
                    {moods.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg bg-primary/10 border border-primary/15 text-xs font-medium text-primary"
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeMood(tag)}
                          className="p-0.5 rounded hover:bg-destructive/15 text-primary/60 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={moodInput}
                      onChange={(e) => setMoodInput(e.target.value)}
                      onKeyDown={handleMoodKeyDown}
                      placeholder={moods.length === 0 ? t("createPlaylist.moodPlaceholder") : t("createPlaylist.addMore")}
                      className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none flex-1 min-w-[120px] font-medium py-0.5"
                    />
                  </div>
                  <p className="text-2xs text-muted-foreground/40">
                    {t("createPlaylist.moodHint")}
                  </p>
                </div>

                {/* Preview */}
                {name.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-border/50 bg-secondary/30"
                  >
                    <p className="text-2xs text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">{t("createPlaylist.preview")}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        {coverImage ? (
                          <img src={coverImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <ListMusic className="w-5 h-5 text-primary/60" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {genres.length > 0 && (
                            <span className="text-2xs text-accent font-medium">{genres.join(", ")}</span>
                          )}
                          {description && (
                            <span className="text-xs text-muted-foreground truncate">{description}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-2xs text-muted-foreground/50">0 tracks · Just now</span>
                          {moods.length > 0 && (
                            <span className="text-2xs text-primary/60">
                              {moods.map((m) => `#${m}`).join(" ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="tracks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Selected tracks */}
                {selectedTracks.length > 0 && (
                  <div className="px-6 pt-4 pb-3 border-b border-border/50">
                    <p className="text-2xs text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">
                      {t("createPlaylist.selected")} · {selectedTracks.length}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTracks.map((track) => (
                        <motion.span
                          key={track.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-primary/8 border border-primary/15 text-xs font-medium text-foreground"
                        >
                          <img src={track.coverImage || DEFAULT_COVER} alt="" className="w-5 h-5 rounded object-cover" />
                          <span className="truncate max-w-[120px]">{track.title}</span>
                          <button
                            onClick={() => removeTrack(track.id)}
                            className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="px-6 pt-3 pb-2">
                  <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3.5 py-2.5 border border-border/50 focus-within:border-primary/30 transition-colors">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder={t("createPlaylist.searchTracks")}
                      value={trackSearch}
                      onChange={(e) => setTrackSearch(e.target.value)}
                      className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none w-full font-medium"
                    />
                    {trackSearch && (
                      <button onClick={() => setTrackSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filters row */}
                <div className="px-6 pb-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <FilterMultiSelect
                      label={t("createPlaylist.filterGenre")}
                      options={availableGenres}
                      values={genreFilter}
                      onChange={setGenreFilter}
                    />
                    <FilterMultiSelect
                      label={t("createPlaylist.filterMood")}
                      options={availableMoods}
                      values={moodFilter}
                      onChange={setMoodFilter}
                      capitalize
                    />
                    {/* BPM range */}
                    <div className="flex items-center gap-1 shrink-0 h-8 px-2 rounded-lg border border-border bg-card">
                      <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide mr-0.5">{t("createPlaylist.filterBpm")}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder={t("createPlaylist.bpmMin")}
                        value={bpmMin ?? ""}
                        onChange={(e) => setBpmMin(e.target.value === "" ? null : Number(e.target.value))}
                        className="w-12 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none text-center font-mono tabular-nums"
                      />
                      <span className="text-muted-foreground/40 text-xs">—</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder={t("createPlaylist.bpmMax")}
                        value={bpmMax ?? ""}
                        onChange={(e) => setBpmMax(e.target.value === "" ? null : Number(e.target.value))}
                        className="w-12 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none text-center font-mono tabular-nums"
                      />
                    </div>
                    <FilterSingleSelect
                      label={t("createPlaylist.filterKey")}
                      options={availableKeys}
                      value={keyFilter}
                      onChange={setKeyFilter}
                    />
                    <FilterSingleSelect
                      label={t("createPlaylist.filterType")}
                      options={availableTypes}
                      value={typeFilter}
                      onChange={setTypeFilter}
                    />
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-lg text-2xs font-semibold text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3 h-3" />
                        {t("createPlaylist.clearFilters")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Track list */}
                <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-0.5">
                  {availableTracks.length === 0 ? (
                    <div className="py-12 text-center">
                      <Music className="w-8 h-8 mx-auto mb-3 text-muted-foreground/15" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {hasActiveFilters || trackSearch
                          ? t("createPlaylist.noTracksMatch")
                          : t("createPlaylist.noTracksFound")}
                      </p>
                    </div>
                  ) : (
                    availableTracks.map((track) => {
                      const isCurrentTrack = currentTrack?.uuid === track.uuid;
                      const isCurrentlyPlaying = isCurrentTrack && isPlaying;
                      const trackGenres = Array.isArray(track.genre) ? track.genre.filter(Boolean) : [];
                      const trackMoods = Array.isArray(track.mood) ? track.mood.filter(Boolean) : [];
                      return (
                      <motion.div
                        key={track.id}
                        layout
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-all cursor-pointer group/track"
                        onClick={() => addTrack(track)}
                      >
                        {/* Cover + play overlay */}
                        <div className="relative w-10 h-10 shrink-0">
                          <img src={track.coverImage || DEFAULT_COVER} alt={track.title} className="w-10 h-10 rounded-lg object-cover ring-1 ring-border/50" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              isCurrentTrack ? togglePlay() : playTrack(track);
                            }}
                            title={t("createPlaylist.previewTrack")}
                            className={
                              "absolute inset-0 flex items-center justify-center rounded-lg bg-background/55 backdrop-blur-[1px] transition-opacity " +
                              (isCurrentlyPlaying
                                ? "opacity-100"
                                : "opacity-100 sm:opacity-0 sm:group-hover/track:opacity-100")
                            }
                          >
                            {isCurrentlyPlaying ? (
                              <Pause className="w-4 h-4 text-foreground" />
                            ) : (
                              <Play className="w-4 h-4 text-foreground" />
                            )}
                          </button>
                        </div>

                        {/* Title + meta */}
                        <div className="min-w-0 flex-1">
                          <p className={"text-[13px] font-semibold truncate tracking-tight " + (isCurrentTrack ? "text-primary" : "text-foreground")}>{track.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {[
                              track.artist,
                              track.bpm ? `${track.bpm} BPM` : null,
                              track.key || null,
                              track.duration && track.duration !== "0:00" ? track.duration : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {(trackGenres.length > 0 || trackMoods.length > 0) && (
                            <div className="flex items-center flex-wrap gap-1 mt-1">
                              {trackGenres.slice(0, 3).map((g) => (
                                <span key={"g-" + g} className="text-[9px] leading-none px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                                  {g}
                                </span>
                              ))}
                              {trackMoods.slice(0, 2).map((m) => (
                                <span key={"m-" + m} className="text-[9px] leading-none px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium capitalize">
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Add */}
                        <div className="flex items-center shrink-0">
                          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center group-hover/track:bg-primary/15 transition-colors">
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/50 group-hover/track:text-primary transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0 bg-card">
          <div className="text-xs text-muted-foreground/50">
            {step === "tracks" && selectedTracks.length > 0 && (
              <span>{selectedTracks.length + " " + t("common.tracks") + " " + t("createPlaylist.selected").toLowerCase()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "tracks" && (
              <button
                onClick={() => setStep("details")}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                {t("common.back")}
              </button>
            )}
            {step === "details" ? (
              <button
                onClick={() => setStep("tracks")}
                disabled={!canProceed}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                {t("common.next") + ": " + t("createPlaylist.addFromCatalog")}
              </button>
            ) : (
              <button
                onClick={() => {
                  const coverIdxs = selectedTracks.length >= 4
                    ? selectedTracks.slice(0, 4).map((t) => t.coverIdx)
                    : [0, 1, 2, 3];
                  const pl: NewPlaylistData = {
                    id: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                    name: name.trim(),
                    description: description.trim() || "No description",
                    tracks: selectedTracks.length,
                    duration: `${selectedTracks.length * 4} min`,
                    updated: "Just now",
                    mood: moods.length > 0 ? moods[0].charAt(0).toUpperCase() + moods[0].slice(1) : "Custom",
                    coverIdxs,
                    color: gradientColors[Math.floor(Math.random() * gradientColors.length)],
                    trackIds: selectedTracks.map((t) => t.id),
                    genre: genres.length > 0 ? genres : undefined,
                    moods: moods.length > 0 ? moods : undefined,
                    coverImage: coverImage || undefined,
                  };
                  onCreate(pl);
                  handleOpenChange(false);
                }}
                disabled={!canCreate}
                className="btn-brand px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                {t("createPlaylist.create")}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact single-select dropdown for the playlist track filters. */
function FilterSingleSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (options.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "flex items-center gap-1 h-8 px-2.5 rounded-lg text-2xs font-semibold transition-all whitespace-nowrap " +
          (value
            ? "border-2 border-brand-orange/40 text-brand-orange"
            : "border border-border text-muted-foreground hover:text-foreground")
        }
      >
        <span>{value || label}</span>
        <ChevronDown className={"w-3 h-3 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 left-0 min-w-[140px] max-h-52 overflow-y-auto bg-popover border border-border rounded-xl shadow-xl p-1"
          >
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={"w-full text-left px-3 py-2 rounded-lg text-xs transition-colors " + (!value ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
            >
              {t("common.all")}
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={"w-full text-left px-3 py-2 rounded-lg text-xs transition-colors " + (value === opt ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compact multi-select dropdown for the playlist track filters. */
function FilterMultiSelect({
  label,
  values,
  options,
  onChange,
  capitalize = false,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  capitalize?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (options.length === 0) return null;

  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };

  const active = values.length > 0;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "flex items-center gap-1 h-8 px-2.5 rounded-lg text-2xs font-semibold transition-all whitespace-nowrap " +
          (active
            ? "border-2 border-brand-orange/40 text-brand-orange"
            : "border border-border text-muted-foreground hover:text-foreground")
        }
      >
        <span>{label}</span>
        {active && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-orange/20 text-brand-orange text-[9px] font-bold">
            {values.length}
          </span>
        )}
        <ChevronDown className={"w-3 h-3 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 left-0 min-w-[160px] max-h-52 overflow-y-auto bg-popover border border-border rounded-xl shadow-xl p-1"
          >
            {options.map((opt) => {
              const checked = values.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={"w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs transition-colors " + (checked ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60") + (capitalize ? " capitalize" : "")}
                >
                  <span className={"w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border " + (checked ? "bg-brand-orange border-brand-orange" : "border-border")}>
                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  {opt}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
