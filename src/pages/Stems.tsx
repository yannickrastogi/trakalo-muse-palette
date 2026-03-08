import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Upload, Play, Download, ExternalLink, Layers, Music, ChevronDown } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useTrack, type TrackStem } from "@/contexts/TrackContext";
import { useNavigate } from "react-router-dom";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

interface FlatStem extends TrackStem {
  trackId: number;
  trackTitle: string;
  trackArtist: string;
  trackGenre: string;
  trackBpm: number;
  trackKey: string;
  trackCoverIdx: number;
  trackCover?: string;
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
};

const allStemTypes = ["vocal", "background vocal", "drums", "kick", "snare", "bass", "synth", "guitar", "fx"];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function Stems() {
  const { tracks } = useTrack();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Flatten all stems across tracks
  const allStems = useMemo<FlatStem[]>(() => {
    const result: FlatStem[] = [];
    tracks.forEach((track) => {
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

  const genres = useMemo(() => [...new Set(allStems.map((s) => s.trackGenre))].sort(), [allStems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allStems.filter((s) => {
      const matchSearch =
        !q ||
        s.fileName.toLowerCase().includes(q) ||
        s.trackTitle.toLowerCase().includes(q) ||
        s.trackArtist.toLowerCase().includes(q) ||
        s.trackGenre.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || s.type === typeFilter;
      const matchGenre = genreFilter === "all" || s.trackGenre === genreFilter;
      return matchSearch && matchType && matchGenre;
    });
  }, [allStems, search, typeFilter, genreFilter]);

  const stemTypesInUse = useMemo(() => [...new Set(allStems.map((s) => s.type))].sort(), [allStems]);

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Stems</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Browse and manage all stems across your catalog.</p>
          </div>
          <button className="btn-brand px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
            <Upload className="w-3.5 h-3.5" />
            Upload Stems
          </button>
        </motion.div>

        {/* Search & Filters */}
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by stem name, track, artist, genre…"
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors ${
                showFilters || typeFilter !== "all" || genreFilter !== "all"
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Stem Type</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30"
                >
                  <option value="all">All Types</option>
                  {stemTypesInUse.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Genre</span>
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30"
                >
                  <option value="all">All Genres</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              {(typeFilter !== "all" || genreFilter !== "all") && (
                <button
                  onClick={() => { setTypeFilter("all"); setGenreFilter("all"); }}
                  className="self-end h-8 px-3 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-secondary transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </motion.div>
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
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Track</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Artist</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Genre</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">BPM</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden xl:table-cell">Key</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Size</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Uploaded</th>
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
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border/50">
                              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{stem.fileName}</span>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${typeClass}`}>
                            {stem.type}
                          </span>
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

                        {/* Artist */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{stem.trackArtist}</span>
                        </td>

                        {/* Genre */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{stem.trackGenre}</span>
                        </td>

                        {/* BPM */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{stem.trackBpm}</span>
                        </td>

                        {/* Key */}
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-xs text-muted-foreground">{stem.trackKey}</span>
                        </td>

                        {/* Size */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground font-mono">{stem.fileSize}</span>
                        </td>

                        {/* Upload Date */}
                        <td className="px-4 py-3 hidden lg:table-cell">
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
    </PageShell>
  );
}
