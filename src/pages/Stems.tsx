import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Upload, Play, Download, ExternalLink, Layers, ChevronDown, X, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useTrack, type TrackStem } from "@/contexts/TrackContext";
import { useNavigate } from "react-router-dom";
import { SelectTrackForStemsModal } from "@/components/SelectTrackForStemsModal";

// Use centralized constants
import { STEM_TYPES, GENRES, DEFAULT_COVER } from "@/lib/constants";
import type { StemType } from "@/lib/constants";

interface FlatStem extends TrackStem {
  trackId: number;
  trackUuid: string;
  trackTitle: string;
  trackArtist: string;
  trackGenre: string;
  trackBpm: number;
  trackKey: string;
  trackCoverIdx: number;
  trackCover?: string;
  isPack?: boolean;
  stemCount?: number;
}

const stemTypeColors: Record<string, string> = {
  vocal: "bg-brand-pink/15 text-brand-pink",
  "background vocal": "bg-brand-purple/15 text-brand-purple",
  drums: "bg-primary/15 text-primary",
  kick: "bg-primary/15 text-primary",
  snare: "bg-primary/15 text-primary",
  bass: "bg-chart-4/15 text-chart-4",
  synth: "bg-brand-orange/15 text-brand-orange",
  guitar: "bg-chart-5/15 text-chart-5",
  fx: "bg-accent/15 text-accent",
  other: "bg-muted text-muted-foreground",
  pack: "bg-brand-orange/15 text-brand-orange",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

// Custom filter dropdown matching Catalog premium style
function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const isActive = value !== "all";
  const displayLabel = options.find((o) => o.value === value)?.label || "All";

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={"flex items-center justify-between w-full h-10 px-3 rounded-xl bg-card text-[13px] font-medium transition-all " + (isActive ? "border-2 border-brand-orange/40 text-brand-orange" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground")}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className={"w-3.5 h-3.5 shrink-0 ml-2 transition-transform duration-200 " + (open ? "rotate-180" : "")} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute z-50 mt-1.5 w-full bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm max-h-60 overflow-y-auto"
            >
              <div className="p-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (value === opt.value ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Stems() {
  const { tracks } = useTrack();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showTrackPicker, setShowTrackPicker] = useState(false);

  // Filter states
  const [trackFilter, setTrackFilter] = useState("all");
  const [artistFilter, setArtistFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [keyFilter, setKeyFilter] = useState("all");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");

  // Flatten all stems + add pack entries for tracks that have stems
  const allStems = useMemo<FlatStem[]>(() => {
    const result: FlatStem[] = [];
    tracks.forEach((track) => {
      if (track.stems.length === 0) return;
      // Add a "Stems Pack" entry for this track
      result.push({
        id: `pack-${track.id}`,
        fileName: `${track.title} — Full Stems Pack`,
        type: "pack",
        fileSize: track.stems.reduce((acc, s) => {
          const num = parseFloat(s.fileSize);
          return acc + (isNaN(num) ? 0 : num);
        }, 0).toFixed(1) + " MB",
        uploadDate: track.stems[0]?.uploadDate || "",
        color: "text-brand-orange",
        trackId: track.id,
        trackUuid: track.uuid,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackGenre: track.genre,
        trackBpm: track.bpm,
        trackKey: track.key,
        trackCoverIdx: track.coverIdx,
        trackCover: track.coverImage,
        isPack: true,
        stemCount: track.stems.length,
      });
      // Add individual stems
      track.stems.forEach((stem) => {
        result.push({
          ...stem,
          trackId: track.id,
          trackUuid: track.uuid,
          trackTitle: track.title,
          trackArtist: track.artist,
          trackGenre: track.genre,
          trackBpm: track.bpm,
          trackKey: track.key,
          trackCoverIdx: track.coverIdx,
          trackCover: track.coverImage,
        });
      });
    });
    return result;
  }, [tracks]);

  // Derive unique options — tracks & artists from ALL tracks so new additions auto-appear
  const uniqueTracks = useMemo(() => [...new Set(tracks.map((t) => t.title))].sort(), [tracks]);
  const uniqueArtists = useMemo(() => [...new Set(tracks.map((t) => t.artist))].sort(), [tracks]);
  // Genre & Keys: use centralized predefined lists from constants
  const uniqueGenres = [...GENRES];
  const uniqueKeys = useMemo(() => [...new Set(tracks.map((t) => t.key).filter(Boolean))].sort(), [tracks]);


  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (trackFilter !== "all") count++;
    if (artistFilter !== "all") count++;
    if (typeFilter !== "all") count++;
    if (genreFilter !== "all") count++;
    if (keyFilter !== "all") count++;
    if (bpmMin || bpmMax) count++;
    return count;
  }, [trackFilter, artistFilter, typeFilter, genreFilter, keyFilter, bpmMin, bpmMax]);

  const clearAllFilters = useCallback(() => {
    setTrackFilter("all");
    setArtistFilter("all");
    setTypeFilter("all");
    setGenreFilter("all");
    setKeyFilter("all");
    setBpmMax("");
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const bpmMinVal = bpmMin ? parseInt(bpmMin) : null;
    const bpmMaxVal = bpmMax ? parseInt(bpmMax) : null;

    return allStems.filter((s) => {
      if (q && !(
        s.fileName.toLowerCase().includes(q) ||
        s.trackTitle.toLowerCase().includes(q) ||
        s.trackArtist.toLowerCase().includes(q) ||
        s.trackGenre.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
      )) return false;

      if (trackFilter !== "all" && s.trackTitle !== trackFilter) return false;
      if (artistFilter !== "all" && s.trackArtist !== artistFilter) return false;
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (genreFilter !== "all" && s.trackGenre !== genreFilter) return false;
      if (keyFilter !== "all" && (s.key || s.trackKey) !== keyFilter) return false;
      if (bpmMinVal && s.trackBpm < bpmMinVal) return false;

      return true;
    });
  }, [allStems, search, trackFilter, artistFilter, typeFilter, genreFilter, keyFilter, bpmMin, bpmMax]);

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Stems</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Browse and manage all stems across your catalog.</p>
          </div>
          <button
            onClick={() => setShowTrackPicker(true)}
            className="btn-brand px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 shrink-0 min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            Upload Stems
          </button>
        </motion.div>

        {/* Search & Filter Toggle */}
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 border border-border/50 focus-brand transition-all">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by stem name, track, artist, genre…"
                className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${
                showFilters || activeFilterCount > 0
                  ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-pink/20"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold btn-brand" style={{ boxShadow: "none" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <div className="card-premium p-5" style={{ overflow: "visible" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <FilterSelect
                      label="Track"
                      value={trackFilter}
                      onChange={setTrackFilter}
                      options={[{ value: "all", label: "All Tracks" }, ...uniqueTracks.map((t) => ({ value: t, label: t }))]}
                    />
                    <FilterSelect
                      label="Artist"
                      value={artistFilter}
                      onChange={setArtistFilter}
                      options={[{ value: "all", label: "All Artists" }, ...uniqueArtists.map((a) => ({ value: a, label: a }))]}
                    />
                    <FilterSelect
                      label="Stem Type"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[
                        { value: "all", label: "All Types" },
                        { value: "pack", label: "Stems Pack" },
                        ...STEM_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
                      ]}
                    />
                    <FilterSelect
                      label="Genre"
                      value={genreFilter}
                      onChange={setGenreFilter}
                      options={[{ value: "all", label: "All Genres" }, ...uniqueGenres.map((g) => ({ value: g, label: g }))]}
                    />
                    <FilterSelect
                      label="Key"
                      value={keyFilter}
                      onChange={setKeyFilter}
                      options={[{ value: "all", label: "All Keys" }, ...uniqueKeys.map((k) => ({ value: k, label: k }))]}
                    />
                    {/* BPM Range */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">BPM Range</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={bpmMin}
                          onChange={(e) => setBpmMin(e.target.value)}
                          placeholder="Min"
                          className="w-full h-10 px-3 rounded-xl bg-card border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-colors font-mono placeholder:text-muted-foreground"
                        />
                        <span className="text-muted-foreground text-xs">–</span>
                        <input
                          type="number"
                          value={bpmMax}
                          onChange={(e) => setBpmMax(e.target.value)}
                          placeholder="Max"
                          className="w-full h-10 px-3 rounded-xl bg-card border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-colors font-mono placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-brand-pink transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Clear All
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter tags (when panel closed) */}
          {activeFilterCount > 0 && !showFilters && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground mr-1 font-medium">Active filters:</span>
              <AnimatePresence>
                {trackFilter !== "all" && <FilterTag key="track" label={"Track: " + trackFilter} onRemove={() => setTrackFilter("all")} />}
                {artistFilter !== "all" && <FilterTag key="artist" label={"Artist: " + artistFilter} onRemove={() => setArtistFilter("all")} />}
                {typeFilter !== "all" && <FilterTag key="type" label={"Type: " + typeFilter} onRemove={() => setTypeFilter("all")} />}
                {genreFilter !== "all" && <FilterTag key="genre" label={"Genre: " + genreFilter} onRemove={() => setGenreFilter("all")} />}
                {keyFilter !== "all" && <FilterTag key="key" label={"Key: " + keyFilter} onRemove={() => setKeyFilter("all")} />}
                {(bpmMin || bpmMax) && <FilterTag key="bpm" label={"BPM: " + (bpmMin || "–") + "–" + (bpmMax || "–")} onRemove={() => { setBpmMin(""); setBpmMax(""); }} />}
              </AnimatePresence>
              <button onClick={clearAllFilters} className="text-xs text-brand-orange hover:text-brand-pink ml-1.5 font-semibold transition-colors flex items-center gap-1">
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div variants={item} className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> stem{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== allStems.length && (
              <span className="ml-1">of {allStems.length} total</span>
            )}
          </span>
        </motion.div>

        {/* Table */}
        {filtered.length > 0 ? (
          <motion.div variants={item} className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Stem Name</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Artist</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Track</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">BPM</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Key</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Genre</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Size</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden xl:table-cell">Uploaded</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((stem, idx) => {
                    const coverSrc = stem.trackCover || DEFAULT_COVER;
                    const typeClass = stemTypeColors[stem.type] || "bg-muted text-muted-foreground";

                    return (
                      <motion.tr
                        key={`${stem.trackId}-${stem.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors group"
                      >
                        {/* Stem Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border/50 ${stem.isPack ? "ring-1 ring-brand-orange/40" : ""}`}>
                              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-xs font-medium truncate max-w-[200px] ${stem.isPack ? "text-brand-orange" : "text-foreground"}`}>{stem.fileName}</span>
                              {stem.isPack && stem.stemCount && (
                                <span className="text-[10px] text-muted-foreground">{stem.stemCount} stems included</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Artist */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{stem.trackArtist}</span>
                        </td>
                        {/* Track */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/track/${stem.trackUuid}`)}
                            className="text-xs text-foreground hover:text-primary transition-colors font-medium truncate max-w-[140px] block"
                          >
                            {stem.trackTitle}
                          </button>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${typeClass}`}>
                            {stem.isPack ? "Stems Pack" : stem.type}
                          </span>
                        </td>
                        {/* BPM */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{stem.trackBpm}</span>
                        </td>
                        {/* Key */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">{stem.key || stem.trackKey || "—"}</span>
                        </td>
                        {/* Genre */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{stem.trackGenre}</span>
                        </td>
                        {/* Size */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{stem.fileSize}</span>
                        </td>
                        {/* Uploaded */}
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-xs text-muted-foreground">{stem.uploadDate}</span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100" title="Play">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100" title="Download">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => navigate(`/track/${stem.trackUuid}`)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Open Track"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={item} className="card-premium flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
            <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mb-4">
              <Layers className="w-6 h-6 text-brand-orange" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              {allStems.length === 0 ? "No stems yet" : "No stems match your search"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-sm">
              {allStems.length === 0
                ? "Upload stems to your tracks to see them here."
                : "Try adjusting your search or filters."}
            </p>
          </motion.div>
        )}
      </motion.div>
      <SelectTrackForStemsModal open={showTrackPicker} onClose={() => setShowTrackPicker(false)} />
    </PageShell>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold"
    >
      {label}
      <button onClick={onRemove} className="hover:bg-brand-orange/20 rounded-full p-0.5 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}
