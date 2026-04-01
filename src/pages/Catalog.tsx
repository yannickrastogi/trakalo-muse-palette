import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UploadTrackModal } from "@/components/UploadTrackModal";
import { useRole } from "@/contexts/RoleContext";
import { FirstUseTooltip } from "@/components/FirstUseTooltip";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useEngagement } from "@/contexts/EngagementContext";
import { GENRES, KEYS, MOODS, LANGUAGES, GENDERS, DEFAULT_COVER } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
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
  LayoutGrid,
  List,
  Headphones,
  Download,
  Edit3,
  Trash2,
  Send,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageShell } from "@/components/PageShell";
import { MiniWaveform } from "@/components/MiniWaveform";
import { useIsMobile } from "@/hooks/use-mobile";
import { StemsContent } from "@/pages/Stems";


const statuses = ["Available", "On Hold", "Released"];
const bpmRanges = [
  { label: "Slow (< 90)", min: 0, max: 89 },
  { label: "Mid (90–120)", min: 90, max: 120 },
  { label: "Fast (121–140)", min: 121, max: 140 },
  { label: "Very Fast (> 140)", min: 141, max: 999 },
];

export const statusColors: Record<string, string> = {
  Available: "bg-emerald-500/12 text-emerald-400",
  "On Hold": "bg-brand-orange/12 text-brand-orange",
  Released: "bg-brand-purple/12 text-brand-purple",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function Catalog() {
  const { t } = useTranslation();
  const { tracks: allTracks, deleteTrack } = useTrack();
  const { getTotalPlaysForTrack, getTotalDownloadsForTrack } = useEngagement();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [search, setSearch] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bpmFilter, setBpmFilter] = useState<{ label: string; min: number; max: number } | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [voiceFilter, setVoiceFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { currentTrack, isPlaying: globalIsPlaying, playTrack, togglePlay, isTrackPlaying, setQueue, progress } = useAudioPlayer();
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const { permissions } = useRole();
  const [deleteTarget, setDeleteTarget] = useState<TrackData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"tracks" | "stems">("tracks");
  // Force grid on mobile
  const effectiveViewMode = isMobile ? "grid" : viewMode;

  // Clear query param after consuming it
  useEffect(() => {
    if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const types = useMemo(() => [...new Set(allTracks.map((t) => t.type))].sort(), [allTracks]);
  const genres = [...GENRES];
  const keys = [...KEYS];
  const moods = [...MOODS];
  const languages = [...LANGUAGES];
  const voices = [...GENDERS];

  const activeFilterCount = [typeFilter, genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter, voiceFilter].filter(Boolean).length;

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
      if (voiceFilter && track.voice !== voiceFilter) return false;
      return true;
    });
  }, [allTracks, search, typeFilter, genreFilter, keyFilter, statusFilter, bpmFilter, moodFilter, languageFilter, voiceFilter]);

  const clearFilters = () => {
    setTypeFilter(null);
    setGenreFilter(null);
    setKeyFilter(null);
    setStatusFilter(null);
    setBpmFilter(null);
    setMoodFilter(null);
    setLanguageFilter(null);
    setVoiceFilter(null);
  };

  return (
    <PageShell>
      {/* Tab switcher */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 max-w-[1400px]">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/50">
          <button
            onClick={() => setActiveTab("tracks")}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " + (activeTab === "tracks" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Tracks
          </button>
          <button
            onClick={() => setActiveTab("stems")}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " + (activeTab === "stems" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Stems
          </button>
        </div>
      </div>

      {activeTab === "stems" ? (
        <StemsContent />
      ) : (
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
           <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("catalog.title")}</h1>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                {allTracks.length + " track" + (allTracks.length !== 1 ? "s" : "")}
              </span>
              <span className="text-muted-foreground/40 text-xs">&middot;</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                <Headphones className="w-3 h-3" />
                {allTracks.reduce((sum, t) => sum + getTotalPlaysForTrack(t.id), 0) + " plays"}
              </span>
              <span className="text-muted-foreground/40 text-xs">&middot;</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                <Send className="w-3 h-3" />
                {allTracks.reduce((sum, t) => sum + getTotalDownloadsForTrack(t.id), 0) + " pitches sent"}
              </span>
            </div>
          </div>
          {permissions.canUploadTracks && (
            <FirstUseTooltip id="upload-track" message="Upload your first track to start building your catalog" position="left">
              <button onClick={() => setUploadOpen(true)} className="btn-brand flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 self-start">
                <Upload className="w-4 h-4" /> {t("catalog.uploadTrack")}
              </button>
            </FirstUseTooltip>
          )}
        </motion.div>

        {/* Search & Filter bar */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 border border-border/50 focus-brand transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder={t("catalog.searchPlaceholder")}
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
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle — hidden on mobile (always grid) */}
            <div className="hidden md:flex items-center rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
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
              {t("catalog.filters")}
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full text-2xs flex items-center justify-center font-bold btn-brand" style={{ boxShadow: "none" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Expanded filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div className="card-premium p-5" style={{ overflow: "visible" }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  <FilterSelect label={t("catalog.type")} value={typeFilter} options={types} onChange={setTypeFilter} />
                  <FilterSelect label={t("catalog.genre")} value={genreFilter} options={genres} onChange={setGenreFilter} />
                  <FilterSelect label={t("catalog.key")} value={keyFilter} options={keys} onChange={setKeyFilter} />
                  <FilterSelect
                    label={t("catalog.bpmRange")}
                    value={bpmFilter?.label ?? null}
                    options={bpmRanges.map((r) => r.label)}
                    onChange={(v) => {
                      const f = bpmRanges.find((r) => r.label === v);
                      setBpmFilter(f ?? null);
                    }}
                  />
                  <FilterSelect label={t("catalog.mood")} value={moodFilter} options={moods} onChange={setMoodFilter} />
                  <FilterSelect label={t("catalog.language")} value={languageFilter} options={languages} onChange={setLanguageFilter} />
                  <FilterSelect label="Gender" value={voiceFilter} options={voices} onChange={setVoiceFilter} />
                  <FilterSelect label={t("catalog.status")} value={statusFilter} options={statuses} onChange={setStatusFilter} />
                </div>
                {activeFilterCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-brand-pink transition-colors"
                    >
                      <X className="w-3 h-3" />
                      {t("catalog.clearAll")}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter tags */}
        {activeFilterCount > 0 && !showFilters && (
          <motion.div variants={item} className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground mr-1 font-medium">{t("catalog.activeFilters")}</span>
            <AnimatePresence>
              {typeFilter && <FilterTag key="type" label={"Type: " + typeFilter} onRemove={() => setTypeFilter(null)} />}
              {genreFilter && <FilterTag key="genre" label={"Genre: " + genreFilter} onRemove={() => setGenreFilter(null)} />}
              {keyFilter && <FilterTag key="key" label={"Key: " + keyFilter} onRemove={() => setKeyFilter(null)} />}
              {bpmFilter && <FilterTag key="bpm" label={"BPM: " + bpmFilter.label} onRemove={() => setBpmFilter(null)} />}
              {moodFilter && <FilterTag key="mood" label={"Mood: " + moodFilter} onRemove={() => setMoodFilter(null)} />}
              {languageFilter && <FilterTag key="lang" label={"Lang: " + languageFilter} onRemove={() => setLanguageFilter(null)} />}
              {voiceFilter && <FilterTag key="voice" label={"Gender: " + voiceFilter} onRemove={() => setVoiceFilter(null)} />}
              {statusFilter && <FilterTag key="status" label={"Status: " + statusFilter} onRemove={() => setStatusFilter(null)} />}
            </AnimatePresence>
            <button onClick={clearFilters} className="text-xs text-brand-orange hover:text-brand-pink ml-1.5 font-semibold transition-colors flex items-center gap-1">
              <X className="w-3 h-3" />
              {t("catalog.clear")}
            </button>
          </motion.div>
        )}

        {/* Track Table / Grid */}
        <motion.div variants={item}>
          {effectiveViewMode === "table" ? (
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pl-5 pr-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-8">#</th>
                    <th className="text-left px-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Details</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Mood</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Plays</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-20 text-center text-muted-foreground">
                        <Music className="w-10 h-10 mx-auto mb-4 opacity-15" />
                        <p className="text-sm font-semibold">{t("catalog.noTracks")}</p>
                        <p className="text-xs mt-1.5 text-muted-foreground/70">{t("catalog.adjustFilters")}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTracks.map((track, idx) => {
                      const isPlaying = isTrackPlaying(track.id);
                      return (
                        <tr
                          key={track.id}
                          className="border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 group/row cursor-pointer"
                          onClick={() => navigate(`/track/${track.uuid}`)}
                        >
                          <td className="pl-5 pr-2 py-3">
                            <button
                              disabled={!track.previewUrl && !track.originalFileUrl && !isPlaying}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPlaying) { togglePlay(); } else { setQueue(filteredTracks); playTrack(track); }
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                !track.previewUrl && !track.originalFileUrl && !isPlaying
                                  ? "text-muted-foreground/20 cursor-default"
                                  : isPlaying
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
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              <img src={track.coverImage || DEFAULT_COVER} alt={track.title} className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground truncate text-[13px] tracking-tight leading-tight">{track.title}</p>
                                  {track.isShared && track.sharedFrom && (
                                    <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple">
                                      via {track.sharedFrom}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
                              </div>
                              <div className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${isPlaying ? "opacity-100" : "opacity-20 group-hover/row:opacity-50"}`}>
                                <MiniWaveform seed={track.id * 13 + 7} bars={40} peaks={track.waveformData} progress={isTrackPlaying(track.id) ? progress : undefined} />
                                <span className="text-2xs text-muted-foreground font-mono tabular-nums w-8 text-right">{track.duration}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {[track.type, track.genre, track.bpm ? track.bpm + " BPM" : null, track.key].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {track.mood.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[140px]">
                                {track.mood.slice(0, 2).map((tag) => (
                                  <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{tag}</span>
                                ))}
                                {track.mood.length > 2 && (
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-secondary text-muted-foreground">+{track.mood.length - 2}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-2xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-center">
                             {(() => {
                               const plays = getTotalPlaysForTrack(track.id);
                               return plays > 0 ? (
                                 <span className="inline-flex items-center gap-1 text-2xs font-semibold text-foreground/70">
                                   <Headphones className="w-3 h-3 text-brand-pink/60" />{plays}
                                 </span>
                               ) : (
                                 <span className="text-2xs text-muted-foreground/40">—</span>
                               );
                             })()}
                           </td>
                           <td className="px-4 py-3">
                             <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1.5 rounded-lg hover:bg-muted transition-all duration-200 text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100" onClick={(e) => e.stopPropagation()}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate("/track/" + track.uuid + "?edit=true"); }}>
                                  <Edit3 className="w-3.5 h-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(track); }}>
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div
              className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground font-medium"
              style={{ borderTop: "1px solid transparent", borderImage: "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1" }}
            >
              <span>Showing {filteredTracks.length} of {allTracks.length} tracks</span>
              <span className="text-2xs text-muted-foreground/50">TRAKALOG Catalog</span>
            </div>
          </div>
          ) : (
          /* Grid View */
          <div>
            {filteredTracks.length === 0 ? (
              <div className="card-premium px-5 py-20 text-center text-muted-foreground">
                <Music className="w-10 h-10 mx-auto mb-4 opacity-15" />
                <p className="text-sm font-semibold">No tracks found</p>
                <p className="text-xs mt-1.5 text-muted-foreground/70">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredTracks.map((track) => {
                  const isPlaying = isTrackPlaying(track.id);
                  return (
                    <motion.div
                      key={track.id}
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="card-premium overflow-hidden cursor-pointer group/card hover:ring-1 hover:ring-border/60 transition-shadow"
                      onClick={() => navigate(`/track/${track.uuid}`)}
                    >
                      {/* Cover art */}
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={track.coverImage || DEFAULT_COVER}
                          alt={track.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        />
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/30 transition-all duration-300 flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPlaying) { togglePlay(); } else { setQueue(filteredTracks); playTrack(track); }
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isPlaying
                                ? "btn-brand scale-100 opacity-100"
                                : "bg-foreground/80 backdrop-blur-sm scale-90 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100"
                            }`}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4 text-primary-foreground" />
                            ) : (
                              <Play className="w-4 h-4 text-background ml-0.5" />
                            )}
                          </button>
                        </div>
                        {/* Status badge */}
                        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-2xs font-semibold backdrop-blur-md ${statusColors[track.status]}`}>
                          {track.status}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="p-3 space-y-1.5">
                        <p className="font-semibold text-foreground text-[13px] tracking-tight truncate leading-tight">{track.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                        {track.isShared && track.sharedFrom && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple">
                            via {track.sharedFrom}
                          </span>
                        )}
                         <div className="flex items-center gap-2 pt-1 flex-wrap">
                           <span className="text-2xs text-muted-foreground shrink-0">{track.genre || "—"}</span>
                           <span className="w-px h-3 bg-border shrink-0" />
                           <span className="text-2xs font-mono text-foreground/50 tabular-nums shrink-0">{track.bpm ? `${track.bpm} BPM` : "—"}</span>
                           <span className="w-px h-3 bg-border shrink-0" />
                           <span className="text-2xs font-semibold text-foreground/50 shrink-0">{track.key || "—"}</span>
                           {track.voice && (
                             <>
                               <span className="w-px h-3 bg-border shrink-0" />
                               <span className="text-2xs text-muted-foreground shrink-0">{track.voice}</span>
                             </>
                           )}
                           {getTotalPlaysForTrack(track.id) > 0 && (
                             <>
                               <span className="w-px h-3 bg-border shrink-0" />
                               <span className="inline-flex items-center gap-0.5 text-2xs font-semibold text-brand-pink/70 shrink-0">
                                 <Headphones className="w-2.5 h-2.5" />{getTotalPlaysForTrack(track.id)}
                               </span>
                             </>
                           )}
                         </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <div
              className="flex items-center justify-between mt-4 px-1 text-xs text-muted-foreground font-medium"
            >
              <span>Showing {filteredTracks.length} of {allTracks.length} tracks</span>
              <span className="text-2xs text-muted-foreground/50">TRAKALOG Catalog</span>
            </div>
          </div>
          )}
        </motion.div>
      </motion.div>
      <UploadTrackModal open={uploadOpen} onOpenChange={setUploadOpen} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Track</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This will permanently remove the track, its stems, and all associated files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                setDeleting(true);
                await deleteTrack(deleteTarget.uuid);
                setDeleting(false);
                setDeleteTarget(null);
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
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
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
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
          className={"flex items-center justify-between w-full h-10 px-3 rounded-xl bg-card text-[13px] font-medium transition-all " + (value ? "border-2 border-brand-orange/40 text-brand-orange" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground")}
        >
          <span className="truncate">{value || "All"}</span>
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
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); }}
                  className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (!value ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                >
                  All
                </button>
                {options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); }}
                    className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (value === opt ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                  >
                    {opt}
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
