import { useState, useMemo, useRef, useEffect, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ListMusic,
  Plus,
  Play,
  Pause,
  MoreHorizontal,
  Search,
  X,
  Clock,
  Music,
  Edit3,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { EmptyState } from "@/components/EmptyState";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { DEFAULT_COVER, GENRES } from "@/lib/constants";
import { useTrack } from "@/contexts/TrackContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useRole } from "@/contexts/RoleContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const trackCountRanges = [
  { label: "All", min: 0, max: Infinity },
  { label: "1-5 tracks", min: 1, max: 5 },
  { label: "6-15 tracks", min: 6, max: 15 },
  { label: "15+ tracks", min: 16, max: Infinity },
];

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    var handler = function (e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return function () { document.removeEventListener("mousedown", handler); };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={function () { setOpen(!open); }}
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
                  onClick={function () { onChange(null); setOpen(false); }}
                  className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (!value ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                >
                  All
                </button>
                {options.map(function (opt) {
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={function () { onChange(opt); setOpen(false); }}
                      className={"w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-colors " + (value === opt ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                    >
                      {opt}
                    </button>
                  );
                })}
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

const MiniCoverGrid = forwardRef<HTMLDivElement, { covers: string[] }>(
  function MiniCoverGridInner({ covers }, ref) {
    if (covers.length === 1) {
      return (
        <div ref={ref} className="w-full aspect-square rounded-xl overflow-hidden">
          <img src={covers[0]} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }
    var gridCovers = covers.length >= 4 ? covers.slice(0, 4) : [DEFAULT_COVER, DEFAULT_COVER, DEFAULT_COVER, DEFAULT_COVER];
    return (
      <div ref={ref} className="grid grid-cols-2 gap-0.5 w-full aspect-square rounded-xl overflow-hidden">
        {gridCovers.map(function (src, i) {
          return <img key={i} src={src} alt="" className="w-full h-full object-cover" />;
        })}
      </div>
    );
  }
);
MiniCoverGrid.displayName = "MiniCoverGrid";

export default function Playlists() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [trackCountFilter, setTrackCountFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; description: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { playlists, addPlaylist, deletePlaylist, updatePlaylist } = usePlaylists();
  const { tracks: allTracks } = useTrack();
  const { playTrack, togglePlay, setQueue, isPlaying: audioIsPlaying, currentTrack, queue } = useAudioPlayer();
  const { permissions } = useRole();

  // Derive moods from tracks in playlists
  var playlistMoods = useMemo(function () {
    var moods = new Set<string>();
    playlists.forEach(function (pl) {
      if (pl.trackIds) {
        pl.trackIds.forEach(function (tid) {
          var track = allTracks.find(function (t) { return t.id === tid; });
          if (track && track.mood) {
            track.mood.forEach(function (m) { if (m) moods.add(m); });
          }
        });
      }
    });
    return Array.from(moods).sort();
  }, [playlists, allTracks]);

  // Build cover map for each playlist from real track covers
  var playlistCovers = useMemo(function () {
    var map: Record<string, string[]> = {};
    playlists.forEach(function (pl) {
      var covers: string[] = [];
      if (pl.coverImage) {
        covers = [pl.coverImage];
      } else if (pl.trackIds) {
        pl.trackIds.forEach(function (tid) {
          var track = allTracks.find(function (t) { return t.id === tid; });
          if (track && track.coverImage) covers.push(track.coverImage);
        });
      }
      if (covers.length === 0) covers = [DEFAULT_COVER, DEFAULT_COVER, DEFAULT_COVER, DEFAULT_COVER];
      map[pl.id] = covers;
    });
    return map;
  }, [playlists, allTracks]);

  // Derive dominant mood per playlist
  var playlistDominantMood = useMemo(function () {
    var map: Record<string, string> = {};
    playlists.forEach(function (pl) {
      if (pl.trackIds) {
        var moodCounts: Record<string, number> = {};
        pl.trackIds.forEach(function (tid) {
          var track = allTracks.find(function (t) { return t.id === tid; });
          if (track && track.mood) {
            track.mood.forEach(function (m) {
              if (m) moodCounts[m] = (moodCounts[m] || 0) + 1;
            });
          }
        });
        var best = "";
        var bestCount = 0;
        Object.keys(moodCounts).forEach(function (m) {
          if (moodCounts[m] > bestCount) { best = m; bestCount = moodCounts[m]; }
        });
        if (best) map[pl.id] = best;
      }
    });
    return map;
  }, [playlists, allTracks]);

  // Derive dominant genre/style per playlist
  var playlistDominantStyle = useMemo(function () {
    var map: Record<string, string> = {};
    playlists.forEach(function (pl) {
      if (pl.trackIds) {
        var genreCounts: Record<string, number> = {};
        pl.trackIds.forEach(function (tid) {
          var track = allTracks.find(function (t) { return t.id === tid; });
          if (track && track.genre) {
            genreCounts[track.genre] = (genreCounts[track.genre] || 0) + 1;
          }
        });
        var best = "";
        var bestCount = 0;
        Object.keys(genreCounts).forEach(function (g) {
          if (genreCounts[g] > bestCount) { best = g; bestCount = genreCounts[g]; }
        });
        if (best) map[pl.id] = best;
      }
    });
    return map;
  }, [playlists, allTracks]);

  var activeFilterCount = [moodFilter, styleFilter, trackCountFilter].filter(Boolean).length;

  var clearFilters = function () {
    setMoodFilter(null);
    setStyleFilter(null);
    setTrackCountFilter(null);
  };

  var filtered = useMemo(function () {
    return playlists.filter(function (pl) {
      // Search
      if (search) {
        var q = search.toLowerCase();
        if (
          !pl.name.toLowerCase().includes(q) &&
          !pl.mood.toLowerCase().includes(q) &&
          !pl.description.toLowerCase().includes(q)
        ) return false;
      }
      // Mood filter
      if (moodFilter) {
        var dominant = playlistDominantMood[pl.id];
        if (dominant !== moodFilter) return false;
      }
      // Style filter
      if (styleFilter) {
        var style = playlistDominantStyle[pl.id];
        if (style !== styleFilter) return false;
      }
      // Track count filter
      if (trackCountFilter) {
        var range = trackCountRanges.find(function (r) { return r.label === trackCountFilter; });
        if (range && (pl.tracks < range.min || pl.tracks > range.max)) return false;
      }
      return true;
    });
  }, [search, playlists, moodFilter, styleFilter, trackCountFilter, playlistDominantMood, playlistDominantStyle]);

  var totalTracks = playlists.reduce(function (s, p) { return s + p.tracks; }, 0);

  return (
    <PageShell>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-7 max-w-[1400px]"
      >
        {/* Header */}
        <motion.div
          variants={item}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                <ListMusic className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {t("playlists.title")}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                <ListMusic className="w-3 h-3" />
                {playlists.length + " collections"}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                <Music className="w-3 h-3" />
                {totalTracks + " tracks"}
              </span>
            </div>
          </div>
          {permissions.canCreatePlaylists && (
            <button onClick={function () { setCreateOpen(true); }} className="btn-brand flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 self-start min-h-[44px]">
              <Plus className="w-4 h-4" /> {t("playlists.createPlaylist")}
            </button>
          )}
        </motion.div>

        {/* Search + Filter Toggle */}
        <motion.div variants={item} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 border border-border/50 focus-brand transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder={t("playlists.searchPlaceholder")}
              value={search}
              onChange={function (e) { setSearch(e.target.value); }}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button
                onClick={function () { setSearch(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={function () { setShowFilters(!showFilters); }}
            className={"flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all min-h-[44px] shrink-0 " + (
              showFilters || activeFilterCount > 0
                ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-pink/20"
            )}
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
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <div className="card-premium p-5" style={{ overflow: "visible" }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <FilterSelect label="Mood" value={moodFilter} options={playlistMoods} onChange={setMoodFilter} />
                  <FilterSelect label="Style" value={styleFilter} options={[...GENRES]} onChange={setStyleFilter} />
                  <FilterSelect label="Tracks" value={trackCountFilter} options={trackCountRanges.slice(1).map(function (r) { return r.label; })} onChange={setTrackCountFilter} />
                </div>
                {activeFilterCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-brand-pink transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear all
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
            <span className="text-xs text-muted-foreground mr-1 font-medium">Active filters:</span>
            <AnimatePresence>
              {moodFilter && <FilterTag key="mood" label={"Mood: " + moodFilter} onRemove={function () { setMoodFilter(null); }} />}
              {styleFilter && <FilterTag key="style" label={"Style: " + styleFilter} onRemove={function () { setStyleFilter(null); }} />}
              {trackCountFilter && <FilterTag key="tracks" label={trackCountFilter} onRemove={function () { setTrackCountFilter(null); }} />}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Playlist Grid */}
        {playlists.length === 0 ? (
          <motion.div variants={item}>
            <EmptyState
              icon={ListMusic}
              title="No playlists yet"
              description="Create a playlist to organize and pitch your tracks together."
              actionLabel="Create Playlist"
              onAction={() => setCreateOpen(true)}
              note={allTracks.length === 0 ? "You need at least one track to create a playlist." : undefined}
            />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div variants={item} className="card-premium py-20 text-center">
            <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mx-auto mb-4">
              <ListMusic className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-semibold text-foreground">{t("playlists.noPlaylists")}</p>
            <p className="text-xs mt-1.5 text-muted-foreground/70 max-w-sm mx-auto">
              No playlists match your filters.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map(function (pl) {
              var plTracks = pl.trackIds
                ? allTracks.filter(function (t) { return pl.trackIds!.includes(t.id); })
                : [];
              var isPlaying = audioIsPlaying && currentTrack != null && plTracks.some(function (t) { return t.id === currentTrack.id; });
              var covers = playlistCovers[pl.id] || [DEFAULT_COVER];
              var dominantMood = playlistDominantMood[pl.id];
              var isSmartAR = pl.description.toLowerCase().includes("smart a&r");
              return (
                <motion.div
                  key={pl.id}
                  variants={item}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="card-premium group cursor-pointer flex flex-col hover:ring-1 hover:ring-border/60 transition-all"
                  onClick={function () { navigate("/playlist/" + pl.id); }}
                >
                  {/* Cover art */}
                  <div className="relative p-4 pb-0">
                    <div className={"absolute inset-0 bg-gradient-to-br " + pl.color + " opacity-60 group-hover:opacity-75 transition-opacity duration-500 rounded-t-[var(--radius)]"} />
                    <div className="relative w-full max-w-[200px] mx-auto">
                      <MiniCoverGrid covers={covers} />
                      {/* Smart A&R badge */}
                      {isSmartAR && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/80 text-white backdrop-blur-sm">
                            <Sparkles className="w-3 h-3" />
                            Smart A&R
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={function (e) {
                            e.stopPropagation();
                            if (plTracks.length === 0) return;
                            if (isPlaying) {
                              togglePlay();
                            } else {
                              var alreadyQueued = currentTrack != null && plTracks.some(function (t) { return t.id === currentTrack.id; });
                              if (alreadyQueued) {
                                togglePlay();
                              } else {
                                setQueue(plTracks);
                                playTrack(plTracks[0]);
                              }
                            }
                          }}
                          className={"w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg min-h-[48px] min-w-[48px] " + (
                            isPlaying ? "btn-brand scale-100" : "bg-foreground/80 backdrop-blur-sm scale-90 hover:scale-100"
                          )}
                        >
                          {isPlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-background ml-0.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 pt-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm tracking-tight leading-snug line-clamp-2">{pl.name}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={function (e) { e.stopPropagation(); }}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center -mt-1 -mr-1"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {permissions.canEditPlaylists && (
                            <DropdownMenuItem
                              onClick={function (e) {
                                e.stopPropagation();
                                setEditTarget({ id: pl.id, name: pl.name, description: pl.description });
                                setEditName(pl.name);
                                setEditDesc(pl.description);
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {permissions.canEditPlaylists && (
                            <DropdownMenuItem
                              onClick={function (e) {
                                e.stopPropagation();
                                setDeleteTarget({ id: pl.id, name: pl.name });
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed line-clamp-2">{pl.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-muted-foreground">
                      <span className="flex items-center gap-1 text-2xs font-medium"><Music className="w-3 h-3" />{pl.tracks} tracks</span>
                      <span className="w-px h-3 bg-border" />
                      <span className="flex items-center gap-1 text-2xs font-medium"><Clock className="w-3 h-3" />{pl.duration}</span>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-border/50 mt-3.5">
                      <span className="text-2xs text-muted-foreground/60 font-medium">Updated {pl.updated}</span>
                      {dominantMood && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-brand-purple/12 text-brand-purple">#{dominantMood}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
      <CreatePlaylistModal open={createOpen} onOpenChange={setCreateOpen} onCreate={addPlaylist} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={function (open) { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Playlist</AlertDialogTitle>
            <AlertDialogDescription>
              {"Are you sure you want to delete \"" + (deleteTarget?.name || "") + "\"? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm border border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm"
              onClick={function () {
                if (deleteTarget) {
                  deletePlaylist(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={function (open) { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Name</label>
              <input
                type="text"
                value={editName}
                onChange={function (e) { setEditName(e.target.value); }}
                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-colors font-medium"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Description</label>
              <textarea
                value={editDesc}
                onChange={function (e) { setEditDesc(e.target.value); }}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 transition-colors resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={function () { setEditTarget(null); }} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border">Cancel</button>
            <button
              onClick={function () {
                if (editTarget && editName.trim()) {
                  updatePlaylist(editTarget.id, { name: editName.trim(), description: editDesc.trim() });
                  setEditTarget(null);
                }
              }}
              className="btn-brand px-5 py-2 rounded-lg text-sm font-semibold"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
