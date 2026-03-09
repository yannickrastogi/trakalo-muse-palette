import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Upload, Play, Download, ExternalLink, Layers, ChevronDown, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useTrack, type TrackStem } from "@/contexts/TrackContext";
import { useNavigate } from "react-router-dom";
import { SelectTrackForStemsModal } from "@/components/SelectTrackForStemsModal";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

// Use centralized constants
import { STEM_TYPES, GENRES } from "@/lib/constants";
import type { StemType } from "@/lib/constants";

interface FlatStem extends TrackStem {
  trackId: number;
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

// Reusable filter select
function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
              className={`h-10 px-4 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 w-4.5 h-4.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-xl bg-card border border-border space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
                  {/* Row 1: Dropdowns */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Stem Type</span>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="h-8 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-colors cursor-pointer"
                      >
                        <option value="all">All Types</option>
                        <option value="pack">🎛️ Stems Pack</option>
                        <option disabled>──────────</option>
                        {STEM_TYPES.map((t) => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
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
                  </div>

                  {/* Row 2: BPM range + Date range */}
                  <div className="flex flex-wrap items-end gap-3">
                    {/* BPM Range */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">BPM Range</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={bpmMin}
                          onChange={(e) => setBpmMin(e.target.value)}
                          placeholder="Min"
                          className="w-[72px] h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-colors font-mono placeholder:text-muted-foreground"
                        />
                        <span className="text-muted-foreground text-xs">–</span>
                        <input
                          type="number"
                          value={bpmMax}
                          onChange={(e) => setBpmMax(e.target.value)}
                          placeholder="Max"
                          className="w-[72px] h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-colors font-mono placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>



                    {/* Clear */}
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="h-8 px-3 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-secondary transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-3 h-3" />
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Active filter pills */}
                  {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {trackFilter !== "all" && (
                        <FilterPill label={`Track: ${trackFilter}`} onClear={() => setTrackFilter("all")} />
                      )}
                      {artistFilter !== "all" && (
                        <FilterPill label={`Artist: ${artistFilter}`} onClear={() => setArtistFilter("all")} />
                      )}
                      {typeFilter !== "all" && (
                        <FilterPill label={`Type: ${typeFilter}`} onClear={() => setTypeFilter("all")} />
                      )}
                      {genreFilter !== "all" && (
                        <FilterPill label={`Genre: ${genreFilter}`} onClear={() => setGenreFilter("all")} />
                      )}
                      {keyFilter !== "all" && (
                        <FilterPill label={`Key: ${keyFilter}`} onClear={() => setKeyFilter("all")} />
                      )}
                      {(bpmMin || bpmMax) && (
                        <FilterPill label={`BPM: ${bpmMin || "–"}–${bpmMax || "–"}`} onClear={() => { setBpmMin(""); setBpmMax(""); }} />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    const coverSrc = stem.trackCover || covers[stem.trackCoverIdx % covers.length];
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
                            onClick={() => navigate(`/track/${stem.trackId}`)}
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
                              onClick={() => navigate(`/track/${stem.trackId}`)}
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

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-medium text-primary">
      {label}
      <button onClick={onClear} className="hover:text-primary-foreground transition-colors">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
