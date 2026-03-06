import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Music,
  Plus,
  Search,
  Filter,
  Disc3,
  Play,
  MoreHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

const allTracks = [
  { id: 1, title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Major", mood: ["emotional", "dreamy"], status: "Master" },
  { id: 2, title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Minor", mood: ["energetic", "dark"], status: "Review" },
  { id: 3, title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Minor", mood: ["nostalgic", "driving"], status: "Draft" },
  { id: 4, title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Major", mood: ["calm", "uplifting"], status: "Master" },
  { id: 5, title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Major", mood: ["happy", "playful"], status: "Review" },
  { id: 6, title: "Static Bloom", artist: "JVNE", album: "Singles 2026", genre: "Glitch Hop", duration: "2:59", bpm: 140, key: "E Minor", mood: ["aggressive", "experimental"], status: "Draft" },
  { id: 7, title: "Golden Frequency", artist: "Alina Voss × Marco", album: "Neon Archive", genre: "House", duration: "5:33", bpm: 124, key: "G Major", mood: ["euphoric", "warm"], status: "Master" },
  { id: 8, title: "Daybreak", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "3:55", bpm: 88, key: "Eb Major", mood: ["hopeful", "smooth"], status: "Master" },
  { id: 9, title: "Obsidian", artist: "Dex Moraes", album: "Singles 2026", genre: "Techno", duration: "6:12", bpm: 136, key: "A Minor", mood: ["dark", "hypnotic"], status: "Review" },
  { id: 10, title: "Slow Drift", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "7:08", bpm: 65, key: "F Major", mood: ["meditative", "calm"], status: "Master" },
  { id: 11, title: "Neon Pulse", artist: "JVNE × Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "4:28", bpm: 110, key: "B Minor", mood: ["energetic", "nostalgic"], status: "Draft" },
  { id: 12, title: "Afterglow", artist: "Kira Nomura × Dex", album: "Late Bloom EP", genre: "R&B", duration: "3:47", bpm: 96, key: "C# Minor", mood: ["romantic", "emotional"], status: "Review" },
];

const genres = [...new Set(allTracks.map((t) => t.genre))].sort();
const keys = [...new Set(allTracks.map((t) => t.key))].sort();
const statuses = ["Draft", "Review", "Master"];
const bpmRanges = [
  { label: "Slow (< 90)", min: 0, max: 89 },
  { label: "Mid (90–120)", min: 90, max: 120 },
  { label: "Fast (121–140)", min: 121, max: 140 },
  { label: "Very Fast (> 140)", min: 141, max: 999 },
];

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Review: "bg-brand-orange/15 text-brand-orange",
  Master: "bg-emerald-500/15 text-emerald-400",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bpmFilter, setBpmFilter] = useState<{ label: string; min: number; max: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [genreFilter, keyFilter, statusFilter, bpmFilter].filter(Boolean).length;

  const filteredTracks = useMemo(() => {
    return allTracks.filter((track) => {
      if (search && !track.title.toLowerCase().includes(search.toLowerCase()) && !track.artist.toLowerCase().includes(search.toLowerCase())) return false;
      if (genreFilter && track.genre !== genreFilter) return false;
      if (keyFilter && track.key !== keyFilter) return false;
      if (statusFilter && track.status !== statusFilter) return false;
      if (bpmFilter && (track.bpm < bpmFilter.min || track.bpm > bpmFilter.max)) return false;
      return true;
    });
  }, [search, genreFilter, keyFilter, statusFilter, bpmFilter]);

  const clearFilters = () => {
    setGenreFilter(null);
    setKeyFilter(null);
    setStatusFilter(null);
    setBpmFilter(null);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
            {/* Header */}
            <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Catalog</h1>
                <p className="text-muted-foreground text-sm mt-1">{allTracks.length} tracks in your library</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0 self-start">
                <Plus className="w-4 h-4" />
                New Track
              </button>
            </motion.div>

            {/* Search & Filter bar */}
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2.5 flex-1">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search by title or artist…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
                  showFilters || activeFilterCount > 0
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/20"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </motion.div>

            {/* Filter dropdowns */}
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap gap-3 items-end">
                <FilterSelect label="Genre" value={genreFilter} options={genres} onChange={setGenreFilter} />
                <FilterSelect label="Key" value={keyFilter} options={keys} onChange={setKeyFilter} />
                <FilterSelect label="Status" value={statusFilter} options={statuses} onChange={setStatusFilter} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">BPM</label>
                  <select
                    value={bpmFilter?.label ?? ""}
                    onChange={(e) => {
                      const found = bpmRanges.find((r) => r.label === e.target.value);
                      setBpmFilter(found ?? null);
                    }}
                    className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors appearance-none min-w-[140px]"
                  >
                    <option value="">All</option>
                    {bpmRanges.map((r) => (
                      <option key={r.label} value={r.label}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    Clear all
                  </button>
                )}
              </motion.div>
            )}

            {/* Active filter tags */}
            {activeFilterCount > 0 && !showFilters && (
              <motion.div variants={item} className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {genreFilter && <FilterTag label={genreFilter} onRemove={() => setGenreFilter(null)} />}
                {keyFilter && <FilterTag label={keyFilter} onRemove={() => setKeyFilter(null)} />}
                {statusFilter && <FilterTag label={statusFilter} onRemove={() => setStatusFilter(null)} />}
                {bpmFilter && <FilterTag label={bpmFilter.label} onRemove={() => setBpmFilter(null)} />}
                <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-1">Clear all</button>
              </motion.div>
            )}

            {/* Tracks table */}
            <motion.div variants={item}>
              <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-5 py-3.5 font-medium">Track</th>
                        <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Genre</th>
                        <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Key</th>
                        <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">BPM</th>
                        <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Mood</th>
                        <th className="text-left px-5 py-3.5 font-medium">Status</th>
                        <th className="px-5 py-3.5 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTracks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                            <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="font-medium">No tracks found</p>
                            <p className="text-xs mt-1">Try adjusting your search or filters</p>
                          </td>
                        </tr>
                      ) : (
                        filteredTracks.map((track) => (
                          <tr key={track.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors group/row cursor-pointer" onClick={() => window.location.href = `/track/${track.id}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover/row:bg-primary/10 transition-colors shrink-0">
                                  <Disc3 className="w-4 h-4 text-muted-foreground group-hover/row:text-primary transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">{track.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{track.genre}</td>
                            <td className="px-5 py-3.5 hidden lg:table-cell">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs font-medium text-foreground/80">
                                <Music className="w-3 h-3 text-primary/70" />
                                {track.key}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell font-mono text-xs">{track.bpm}</td>
                            <td className="px-5 py-3.5 hidden sm:table-cell">
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {track.mood.map((tag) => (
                                  <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[track.status]}`}>
                                {track.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-1">
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <Play className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                  <span>Showing {filteredTracks.length} of {allTracks.length} tracks</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 px-3 pr-8 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors appearance-none min-w-[140px]"
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-primary-foreground transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
