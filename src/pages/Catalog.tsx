import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Music,
  Upload,
  Search,
  Filter,
  Play,
  Pause,
  MoreHorizontal,
  ChevronDown,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MiniWaveform } from "@/components/MiniWaveform";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

const allTracks = [
  { id: 1, title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Maj", mood: ["emotional", "dreamy"], status: "Available", language: "English", type: "Song", coverIdx: 0 },
  { id: 2, title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Min", mood: ["energetic", "dark"], status: "On Hold", language: "English", type: "Sample", coverIdx: 1 },
  { id: 3, title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Min", mood: ["nostalgic", "driving"], status: "Available", language: "Portuguese", type: "Song", coverIdx: 2 },
  { id: 4, title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Maj", mood: ["calm", "uplifting"], status: "Released", language: "Instrumental", type: "Instrumental", coverIdx: 3 },
  { id: 5, title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Maj", mood: ["happy", "playful"], status: "On Hold", language: "Japanese", type: "Song", coverIdx: 4 },
  { id: 6, title: "Static Bloom", artist: "JVNE", album: "Singles 2026", genre: "Glitch Hop", duration: "2:59", bpm: 140, key: "E Min", mood: ["aggressive", "experimental"], status: "Available", language: "English", type: "Acapella", coverIdx: 5 },
  { id: 7, title: "Golden Frequency", artist: "Alina Voss × Marco", album: "Neon Archive", genre: "House", duration: "5:33", bpm: 124, key: "G Maj", mood: ["euphoric", "warm"], status: "Released", language: "Spanish", type: "Song", coverIdx: 2 },
  { id: 8, title: "Daybreak", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "3:55", bpm: 88, key: "Eb Maj", mood: ["hopeful", "smooth"], status: "Released", language: "English", type: "Instrumental", coverIdx: 0 },
  { id: 9, title: "Obsidian", artist: "Dex Moraes", album: "Singles 2026", genre: "Techno", duration: "6:12", bpm: 136, key: "A Min", mood: ["dark", "hypnotic"], status: "On Hold", language: "Instrumental", type: "Sample", coverIdx: 1 },
  { id: 10, title: "Slow Drift", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "7:08", bpm: 65, key: "F Maj", mood: ["meditative", "calm"], status: "Released", language: "Instrumental", type: "Instrumental", coverIdx: 3 },
  { id: 11, title: "Neon Pulse", artist: "JVNE × Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "4:28", bpm: 110, key: "B Min", mood: ["energetic", "nostalgic"], status: "Available", language: "French", type: "Song", coverIdx: 2 },
  { id: 12, title: "Afterglow", artist: "Kira Nomura × Dex", album: "Late Bloom EP", genre: "R&B", duration: "3:47", bpm: 96, key: "C# Min", mood: ["romantic", "emotional"], status: "On Hold", language: "English", type: "Acapella", coverIdx: 0 },
];

const genres = [...new Set(allTracks.map((t) => t.genre))].sort();
const keys = [...new Set(allTracks.map((t) => t.key))].sort();
const moods = [...new Set(allTracks.flatMap((t) => t.mood))].sort();
const languages = [...new Set(allTracks.map((t) => t.language))].sort();
const statuses = ["Available", "On Hold", "Released"];
const bpmRanges = [
  { label: "Slow (< 90)", min: 0, max: 89 },
  { label: "Mid (90–120)", min: 90, max: 120 },
  { label: "Fast (121–140)", min: 121, max: 140 },
  { label: "Very Fast (> 140)", min: 141, max: 999 },
];

const statusColors: Record<string, string> = {
  Available: "bg-emerald-500/12 text-emerald-400",
  "On Hold": "bg-brand-orange/12 text-brand-orange",
  Released: "bg-brand-purple/12 text-brand-purple",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bpmFilter, setBpmFilter] = useState<{ label: string; min: number; max: number } | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [playingTrack, setPlayingTrack] = useState<number | null>(null);
  const navigate = useNavigate();

  const activeFilterCount = [genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter].filter(Boolean).length;

  const filteredTracks = useMemo(() => {
    return allTracks.filter((track) => {
      if (search && !track.title.toLowerCase().includes(search.toLowerCase()) && !track.artist.toLowerCase().includes(search.toLowerCase())) return false;
      if (genreFilter && track.genre !== genreFilter) return false;
      if (keyFilter && track.key !== keyFilter) return false;
      if (statusFilter && track.status !== statusFilter) return false;
      if (bpmFilter && (track.bpm < bpmFilter.min || track.bpm > bpmFilter.max)) return false;
      if (moodFilter && !track.mood.includes(moodFilter)) return false;
      if (languageFilter && track.language !== languageFilter) return false;
      return true;
    });
  }, [search, genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter]);

  const clearFilters = () => {
    setGenreFilter(null);
    setKeyFilter(null);
    setStatusFilter(null);
    setBpmFilter(null);
    setMoodFilter(null);
    setLanguageFilter(null);
  };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tracks</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allTracks.length} tracks in your catalog · {filteredTracks.length} shown
            </p>
          </div>
          <button className="btn-brand flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 self-start">
            <Upload className="w-4 h-4" /> Upload Track
          </button>
        </motion.div>

        {/* Search & Filter bar */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 border border-border/50 focus-brand transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search by title, artist, or album…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all shrink-0 ${
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
        </motion.div>

        {/* Expanded filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card-premium p-5"
          >
            <div className="flex flex-wrap gap-4 items-end">
              <FilterSelect label="Genre" value={genreFilter} options={genres} onChange={setGenreFilter} />
              <FilterSelect label="Key" value={keyFilter} options={keys} onChange={setKeyFilter} />
              <div className="flex flex-col gap-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">BPM Range</label>
                <div className="relative">
                  <select
                    value={bpmFilter?.label ?? ""}
                    onChange={(e) => {
                      const f = bpmRanges.find((r) => r.label === e.target.value);
                      setBpmFilter(f ?? null);
                    }}
                    className="h-9 px-3 pr-7 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none min-w-[150px] font-medium"
                  >
                    <option value="">All BPMs</option>
                    {bpmRanges.map((r) => (
                      <option key={r.label} value={r.label}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <FilterSelect label="Mood" value={moodFilter} options={moods} onChange={setMoodFilter} />
              <FilterSelect label="Language" value={languageFilter} options={languages} onChange={setLanguageFilter} />
              <FilterSelect label="Status" value={statusFilter} options={statuses} onChange={setStatusFilter} />
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Active filter tags */}
        {activeFilterCount > 0 && !showFilters && (
          <motion.div variants={item} className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground mr-1 font-medium">Active filters:</span>
            {genreFilter && <FilterTag label={`Genre: ${genreFilter}`} onRemove={() => setGenreFilter(null)} />}
            {keyFilter && <FilterTag label={`Key: ${keyFilter}`} onRemove={() => setKeyFilter(null)} />}
            {bpmFilter && <FilterTag label={`BPM: ${bpmFilter.label}`} onRemove={() => setBpmFilter(null)} />}
            {moodFilter && <FilterTag label={`Mood: ${moodFilter}`} onRemove={() => setMoodFilter(null)} />}
            {languageFilter && <FilterTag label={`Lang: ${languageFilter}`} onRemove={() => setLanguageFilter(null)} />}
            {statusFilter && <FilterTag label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter(null)} />}
            <button onClick={clearFilters} className="text-xs gradient-text hover:opacity-80 ml-1.5 font-semibold transition-opacity">
              Clear
            </button>
          </motion.div>
        )}

        {/* Track Table */}
        <motion.div variants={item}>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pl-5 pr-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-8">#</th>
                    <th className="text-left px-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Genre</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">BPM</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Key</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden xl:table-cell">Mood</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden xl:table-cell">Language</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-20 text-center text-muted-foreground">
                        <Music className="w-10 h-10 mx-auto mb-4 opacity-15" />
                        <p className="text-sm font-semibold">No tracks found</p>
                        <p className="text-xs mt-1.5 text-muted-foreground/70">Try adjusting your search or filters</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTracks.map((track, idx) => {
                      const isPlaying = playingTrack === track.id;
                      return (
                        <tr
                          key={track.id}
                          className="border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 group/row cursor-pointer"
                          onClick={() => navigate(`/track/${track.id}`)}
                        >
                          {/* Row number / play */}
                          <td className="pl-5 pr-2 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlayingTrack(isPlaying ? null : track.id);
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                isPlaying
                                  ? "btn-brand shadow-none"
                                  : "text-muted-foreground/40 group-hover/row:text-foreground"
                              }`}
                            >
                              {isPlaying ? (
                                <Pause className="w-3 h-3 text-primary-foreground" />
                              ) : (
                                <>
                                  <span className="group-hover/row:hidden text-2xs font-mono font-medium">{idx + 1}</span>
                                  <Play className="w-3 h-3 hidden group-hover/row:block" />
                                </>
                              )}
                            </button>
                          </td>

                          {/* Track info with cover + waveform */}
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              {/* Cover art */}
                              <img
                                src={covers[track.coverIdx]}
                                alt={track.title}
                                className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
                              />
                              {/* Title + Artist */}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate text-[13px] tracking-tight leading-tight">
                                  {track.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
                              </div>
                              {/* Mini waveform */}
                              <div
                                className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${
                                  isPlaying ? "opacity-100" : "opacity-20 group-hover/row:opacity-50"
                                }`}
                              >
                                <MiniWaveform seed={track.id * 13 + 7} bars={22} />
                                <span className="text-2xs text-muted-foreground font-mono tabular-nums w-8 text-right">
                                  {track.duration}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Genre */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{track.genre}</span>
                          </td>

                          {/* BPM */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="font-mono text-2xs text-foreground/60 tabular-nums">{track.bpm}</span>
                          </td>

                          {/* Key */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
                              <Music className="w-2.5 h-2.5 text-brand-orange/50" />
                              {track.key}
                            </span>
                          </td>

                          {/* Mood */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {track.mood.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Language */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">{track.language}</span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>
                              {track.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <button
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground font-medium"
              style={{ borderTop: "1px solid transparent", borderImage: "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1" }}
            >
              <span>
                Showing {filteredTracks.length} of {allTracks.length} tracks
              </span>
              <span className="text-2xs text-muted-foreground/50">TRAKALOG Catalog</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 px-3 pr-7 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none min-w-[140px] font-medium"
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-semibold">
      {label}
      <button onClick={onRemove} className="hover:text-foreground transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
