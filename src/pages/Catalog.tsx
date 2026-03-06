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
import { PageShell } from "@/components/PageShell";

const allTracks = [
  { id: 1, title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Maj", mood: ["emotional", "dreamy"], status: "Available", language: "English", type: "Song" },
  { id: 2, title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Min", mood: ["energetic", "dark"], status: "On Hold", language: "English", type: "Sample" },
  { id: 3, title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Min", mood: ["nostalgic", "driving"], status: "Available", language: "Portuguese", type: "Song" },
  { id: 4, title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Maj", mood: ["calm", "uplifting"], status: "Released", language: "Instrumental", type: "Instrumental" },
  { id: 5, title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Maj", mood: ["happy", "playful"], status: "On Hold", language: "Japanese", type: "Song" },
  { id: 6, title: "Static Bloom", artist: "JVNE", album: "Singles 2026", genre: "Glitch Hop", duration: "2:59", bpm: 140, key: "E Min", mood: ["aggressive", "experimental"], status: "Available", language: "English", type: "Acapella" },
  { id: 7, title: "Golden Frequency", artist: "Alina Voss × Marco", album: "Neon Archive", genre: "House", duration: "5:33", bpm: 124, key: "G Maj", mood: ["euphoric", "warm"], status: "Released", language: "Spanish", type: "Song" },
  { id: 8, title: "Daybreak", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "3:55", bpm: 88, key: "Eb Maj", mood: ["hopeful", "smooth"], status: "Released", language: "English", type: "Instrumental" },
  { id: 9, title: "Obsidian", artist: "Dex Moraes", album: "Singles 2026", genre: "Techno", duration: "6:12", bpm: 136, key: "A Min", mood: ["dark", "hypnotic"], status: "On Hold", language: "Instrumental", type: "Sample" },
  { id: 10, title: "Slow Drift", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "7:08", bpm: 65, key: "F Maj", mood: ["meditative", "calm"], status: "Released", language: "Instrumental", type: "Instrumental" },
  { id: 11, title: "Neon Pulse", artist: "JVNE × Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "4:28", bpm: 110, key: "B Min", mood: ["energetic", "nostalgic"], status: "Available", language: "French", type: "Song" },
  { id: 12, title: "Afterglow", artist: "Kira Nomura × Dex", album: "Late Bloom EP", genre: "R&B", duration: "3:47", bpm: 96, key: "C# Min", mood: ["romantic", "emotional"], status: "On Hold", language: "English", type: "Acapella" },
];

const types = [...new Set(allTracks.map((t) => t.type))].sort();
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
  Released: "bg-primary/12 text-primary",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } } };

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bpmFilter, setBpmFilter] = useState<{ label: string; min: number; max: number } | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  const activeFilterCount = [typeFilter, genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter].filter(Boolean).length;

  const filteredTracks = useMemo(() => {
    return allTracks.filter((track) => {
      if (search && !track.title.toLowerCase().includes(search.toLowerCase()) && !track.artist.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter && track.type !== typeFilter) return false;
      if (genreFilter && track.genre !== genreFilter) return false;
      if (keyFilter && track.key !== keyFilter) return false;
      if (statusFilter && track.status !== statusFilter) return false;
      if (bpmFilter && (track.bpm < bpmFilter.min || track.bpm > bpmFilter.max)) return false;
      if (moodFilter && !track.mood.includes(moodFilter)) return false;
      if (languageFilter && track.language !== languageFilter) return false;
      return true;
    });
  }, [search, typeFilter, genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter]);

  const clearFilters = () => { setTypeFilter(null); setGenreFilter(null); setKeyFilter(null); setStatusFilter(null); setBpmFilter(null); setMoodFilter(null); setLanguageFilter(null); };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tracks</h1>
            <p className="text-muted-foreground text-sm mt-1">{allTracks.length} tracks in your library</p>
          </div>
          <button className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start">
            <Plus className="w-3.5 h-3.5" /> New Track
          </button>
        </motion.div>

        {/* Search & Filter */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-3.5 py-2.5 flex-1 border border-border/50 focus-within:border-primary/25 transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Search by title or artist…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium" />
            {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold border transition-all shrink-0 ${
              showFilters || activeFilterCount > 0 ? "border-primary/25 bg-primary/8 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/15"
            }`}>
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-2xs flex items-center justify-center font-bold">{activeFilterCount}</span>}
          </button>
        </motion.div>

        {/* Filter row */}
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-3 items-end">
            <FilterSelect label="Type" value={typeFilter} options={types} onChange={setTypeFilter} />
            <FilterSelect label="Genre" value={genreFilter} options={genres} onChange={setGenreFilter} />
            <FilterSelect label="Key" value={keyFilter} options={keys} onChange={setKeyFilter} />
            <div className="flex flex-col gap-1.5">
              <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">BPM</label>
              <div className="relative">
                <select value={bpmFilter?.label ?? ""} onChange={(e) => { const f = bpmRanges.find((r) => r.label === e.target.value); setBpmFilter(f ?? null); }}
                  className="h-9 px-3 pr-7 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-primary/30 transition-all appearance-none min-w-[140px] font-medium">
                  <option value="">All</option>
                  {bpmRanges.map((r) => <option key={r.label} value={r.label}>{r.label}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <FilterSelect label="Mood" value={moodFilter} options={moods} onChange={setMoodFilter} />
            <FilterSelect label="Language" value={languageFilter} options={languages} onChange={setLanguageFilter} />
            <FilterSelect label="Status" value={statusFilter} options={statuses} onChange={setStatusFilter} />
            {activeFilterCount > 0 && <button onClick={clearFilters} className="h-9 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Clear all</button>}
          </motion.div>
        )}

        {/* Filter tags */}
        {activeFilterCount > 0 && !showFilters && (
          <motion.div variants={item} className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground mr-1 font-medium">Filters:</span>
            {typeFilter && <FilterTag label={typeFilter} onRemove={() => setTypeFilter(null)} />}
            {genreFilter && <FilterTag label={genreFilter} onRemove={() => setGenreFilter(null)} />}
            {keyFilter && <FilterTag label={keyFilter} onRemove={() => setKeyFilter(null)} />}
            {bpmFilter && <FilterTag label={bpmFilter.label} onRemove={() => setBpmFilter(null)} />}
            {moodFilter && <FilterTag label={moodFilter} onRemove={() => setMoodFilter(null)} />}
            {languageFilter && <FilterTag label={languageFilter} onRemove={() => setLanguageFilter(null)} />}
            {statusFilter && <FilterTag label={statusFilter} onRemove={() => setStatusFilter(null)} />}
            <button onClick={clearFilters} className="text-xs text-primary/80 hover:text-primary ml-1 font-semibold">Clear</button>
          </motion.div>
        )}

        {/* Table */}
        <motion.div variants={item}>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Type</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Genre</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Key</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">BPM</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Mood</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Language</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-16 text-center text-muted-foreground">
                      <Music className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-semibold">No tracks found</p>
                      <p className="text-xs mt-1 text-muted-foreground/70">Try adjusting your search or filters</p>
                    </td></tr>
                  ) : filteredTracks.map((track) => (
                    <tr key={track.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors group/row cursor-pointer" onClick={() => navigate(`/track/${track.id}`)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover/row:bg-primary/8 transition-colors shrink-0">
                            <Disc3 className="w-4 h-4 text-muted-foreground group-hover/row:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate text-[13px] tracking-tight">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">{track.type}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{track.genre}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
                          <Music className="w-2.5 h-2.5 text-primary/50" />{track.key}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell font-mono text-2xs">{track.bpm}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {track.mood.map((tag) => <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{tag}</span>)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{track.language}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}><Play className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground font-medium">
              <span>Showing {filteredTracks.length} of {allTracks.length} tracks</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
          className="h-9 px-3 pr-7 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-primary/30 transition-all appearance-none min-w-[140px] font-medium">
          <option value="">All</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
      {label}
      <button onClick={onRemove} className="hover:text-primary-foreground transition-colors"><X className="w-3 h-3" /></button>
    </span>
  );
}
