import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  MoreHorizontal,
  Plus,
  Share2,
  Edit3,
  Music,
  Clock,
  ChevronRight,
  ListMusic,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { MiniWaveform } from "@/components/MiniWaveform";
import { useIsMobile } from "@/hooks/use-mobile";
import { playlistsData } from "./Playlists";
import { allTracks, statusColors } from "./Catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

// Build initial playlist track assignments from allTracks
function getInitialTracks(playlistId: string, count: number) {
  return allTracks.slice(0, Math.min(count, allTracks.length));
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const playlist = playlistsData.find((p) => p.id === id);

  const [tracks, setTracks] = useState(() =>
    playlist ? getInitialTracks(playlist.id, playlist.tracks) : []
  );
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(playlist?.name || "");
  const [playlistName, setPlaylistName] = useState(playlist?.name || "");
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [duplicateToast, setDuplicateToast] = useState(false);

  const moveTrack = useCallback((fromIdx: number, toIdx: number) => {
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const removeTrack = useCallback((trackId: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const availableToAdd = allTracks.filter(
    (t) => !tracks.some((pt) => pt.id === t.id)
  );
  const filteredAvailable = addSearch
    ? availableToAdd.filter(
        (t) =>
          t.title.toLowerCase().includes(addSearch.toLowerCase()) ||
          t.artist.toLowerCase().includes(addSearch.toLowerCase())
      )
    : availableToAdd;

  const handleDuplicate = () => {
    setDuplicateToast(true);
    setTimeout(() => setDuplicateToast(false), 2500);
  };

  if (!playlist) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <ListMusic className="w-12 h-12 text-muted-foreground/15 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Playlist not found</h2>
          <p className="text-sm text-muted-foreground mt-1">This playlist may have been removed.</p>
          <Link to="/playlists" className="mt-4 text-sm gradient-text font-semibold hover:opacity-80 transition-opacity">
            ← Back to Playlists
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]"
      >
        {/* Breadcrumb */}
        <motion.div variants={item} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/playlists" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Playlists
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate">{playlistName}</span>
        </motion.div>

        {/* Hero */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          {/* Cover mosaic */}
          <div className="w-full sm:w-52 lg:w-60 shrink-0">
            <div
              className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${playlist.color}`}
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                {playlist.coverIdxs.slice(0, 4).map((ci, i) => (
                  <img key={i} src={covers[ci]} alt="" className="w-full h-full object-cover" />
                ))}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/12 text-accent/80 mb-2">
                #{playlist.mood}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                {playlistName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg">
                {playlist.description}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Music className="w-3.5 h-3.5" />
                {tracks.length} tracks
              </span>
              <span className="w-px h-4 bg-border" />
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {playlist.duration}
              </span>
              <span className="w-px h-4 bg-border hidden sm:block" />
              <span className="text-xs font-medium hidden sm:inline">
                Updated {playlist.updated}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setPlayingTrackId(playingTrackId ? null : tracks[0]?.id || null)}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
              >
                {playingTrackId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                {playingTrackId ? "Pause" : "Play All"}
              </button>
              <button
                onClick={() => setAddTrackOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
              >
                <Plus className="w-4 h-4" /> Add Track
              </button>
              <button
                onClick={() => {
                  setRenameValue(playlistName);
                  setRenameOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
              >
                <Edit3 className="w-4 h-4" /> Rename
              </button>
              <button
                onClick={handleDuplicate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
              >
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Track list */}
        <motion.div variants={item}>
          {isMobile ? (
            <MobileTrackList
              tracks={tracks}
              playingTrackId={playingTrackId}
              setPlayingTrackId={setPlayingTrackId}
              moveTrack={moveTrack}
              removeTrack={removeTrack}
            />
          ) : (
            <DesktopTrackTable
              tracks={tracks}
              playingTrackId={playingTrackId}
              setPlayingTrackId={setPlayingTrackId}
              moveTrack={moveTrack}
              removeTrack={removeTrack}
              totalDuration={playlist.duration}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Rename Playlist</DialogTitle>
            <DialogDescription>Enter a new name for this playlist.</DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/40 transition-colors font-medium"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => setRenameOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (renameValue.trim()) {
                  setPlaylistName(renameValue.trim());
                  setRenameOpen(false);
                }
              }}
              className="btn-brand px-5 py-2 rounded-lg text-sm font-semibold"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Track Dialog */}
      <Dialog open={addTrackOpen} onOpenChange={setAddTrackOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Tracks</DialogTitle>
            <DialogDescription>Select tracks from your catalog to add to this playlist.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
            <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search tracks…"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 -mx-6 px-6">
            {filteredAvailable.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <p className="text-sm font-medium">No tracks available</p>
                <p className="text-xs mt-1 text-muted-foreground/60">All catalog tracks are already in this playlist</p>
              </div>
            ) : (
              filteredAvailable.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group/add"
                  onClick={() => {
                    setTracks((prev) => [...prev, track]);
                  }}
                >
                  <img
                    src={covers[track.coverIdx]}
                    alt={track.title}
                    className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <span className="text-2xs text-muted-foreground">{track.genre}</span>
                  <Plus className="w-4 h-4 text-muted-foreground/40 group-hover/add:text-brand-orange transition-colors shrink-0" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate toast */}
      {duplicateToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg text-sm font-medium text-foreground"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          Playlist duplicated successfully
        </motion.div>
      )}
    </PageShell>
  );
}

/* ─── Desktop Table (matches Catalog exactly) ─── */
function DesktopTrackTable({
  tracks,
  playingTrackId,
  setPlayingTrackId,
  moveTrack,
  removeTrack,
  totalDuration,
}: {
  tracks: typeof allTracks;
  playingTrackId: number | null;
  setPlayingTrackId: (id: number | null) => void;
  moveTrack: (from: number, to: number) => void;
  removeTrack: (id: number) => void;
  totalDuration: string;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pl-3 pr-1 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-6"></th>
              <th className="text-left pl-2 pr-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-8">#</th>
              <th className="text-left px-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Genre</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">BPM</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Key</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Mood</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Language</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
              <th className="px-2 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-20 text-center text-muted-foreground">
                  <Music className="w-10 h-10 mx-auto mb-4 opacity-15" />
                  <p className="text-sm font-semibold">No tracks in this playlist</p>
                  <p className="text-xs mt-1.5 text-muted-foreground/70">Add tracks from your catalog</p>
                </td>
              </tr>
            ) : (
              tracks.map((track, idx) => {
                const isPlaying = playingTrackId === track.id;
                return (
                  <tr
                    key={track.id}
                    className="border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 group/row"
                  >
                    {/* Reorder */}
                    <td className="pl-3 pr-1 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => idx > 0 && moveTrack(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <GripVertical className="w-3 h-3 text-muted-foreground/20" />
                        <button
                          onClick={() => idx < tracks.length - 1 && moveTrack(idx, idx + 1)}
                          disabled={idx === tracks.length - 1}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* # / Play */}
                    <td className="pl-2 pr-2 py-3">
                      <button
                        onClick={() => setPlayingTrackId(isPlaying ? null : track.id)}
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

                    {/* Track info */}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <img src={covers[track.coverIdx]} alt={track.title} className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate text-[13px] tracking-tight leading-tight">{track.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
                        </div>
                        <div className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${isPlaying ? "opacity-100" : "opacity-20 group-hover/row:opacity-50"}`}>
                          <MiniWaveform seed={track.id * 13 + 7} bars={22} />
                          <span className="text-2xs text-muted-foreground font-mono tabular-nums w-8 text-right">{track.duration}</span>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{track.type}</td>
                    {/* Genre */}
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{track.genre}</span></td>
                    {/* BPM */}
                    <td className="px-4 py-3 hidden lg:table-cell"><span className="font-mono text-2xs text-foreground/60 tabular-nums">{track.bpm}</span></td>
                    {/* Key */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
                        <Music className="w-2.5 h-2.5 text-brand-orange/50" />{track.key}
                      </span>
                    </td>
                    {/* Mood */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {track.mood.map((tag) => (
                          <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{tag}</span>
                        ))}
                      </div>
                    </td>
                    {/* Language */}
                    <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{track.language}</span></td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-2 py-3">
                      <button
                        onClick={() => removeTrack(track.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/row:opacity-100"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
        style={{
          borderTop: "1px solid transparent",
          borderImage: "linear-gradient(90deg, hsl(24 100% 55% / 0.1), hsl(330 80% 60% / 0.06), transparent) 1",
        }}
      >
        <span>{tracks.length} tracks · {totalDuration}</span>
        <span className="text-2xs text-muted-foreground/50">TRAKALOG Playlist</span>
      </div>
    </div>
  );
}

/* ─── Mobile Card List ─── */
function MobileTrackList({
  tracks,
  playingTrackId,
  setPlayingTrackId,
  moveTrack,
  removeTrack,
}: {
  tracks: typeof allTracks;
  playingTrackId: number | null;
  setPlayingTrackId: (id: number | null) => void;
  moveTrack: (from: number, to: number) => void;
  removeTrack: (id: number) => void;
}) {
  if (tracks.length === 0) {
    return (
      <div className="card-premium py-16 text-center">
        <Music className="w-10 h-10 mx-auto mb-4 text-muted-foreground/15" />
        <p className="text-sm font-semibold text-foreground">No tracks yet</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Add tracks from your catalog</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tracks.map((track, idx) => {
        const isPlaying = playingTrackId === track.id;
        return (
          <div key={track.id} className="card-premium p-3.5 flex items-center gap-3">
            {/* Reorder arrows */}
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <button
                onClick={() => idx > 0 && moveTrack(idx, idx - 1)}
                disabled={idx === 0}
                className="p-1 rounded hover:bg-muted text-muted-foreground/40 disabled:opacity-20 min-h-[28px] min-w-[28px] flex items-center justify-center"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => idx < tracks.length - 1 && moveTrack(idx, idx + 1)}
                disabled={idx === tracks.length - 1}
                className="p-1 rounded hover:bg-muted text-muted-foreground/40 disabled:opacity-20 min-h-[28px] min-w-[28px] flex items-center justify-center"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Play button */}
            <button
              onClick={() => setPlayingTrackId(isPlaying ? null : track.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] transition-all ${
                isPlaying ? "btn-brand shadow-none" : "bg-secondary"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-primary-foreground" />
              ) : (
                <Play className="w-4 h-4 text-muted-foreground ml-0.5" />
              )}
            </button>

            {/* Cover */}
            <img src={covers[track.coverIdx]} alt={track.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">{track.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xs text-muted-foreground/60">{track.genre}</span>
                <span className="text-2xs text-muted-foreground/40">{track.bpm} BPM</span>
                <span className={`inline-flex px-1.5 py-0 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
              </div>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeTrack(track.id)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
