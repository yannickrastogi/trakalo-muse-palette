import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShareModal } from "@/components/ShareModal";
import { PlaylistWorkspaceShare } from "@/components/PlaylistWorkspaceShare";
import { useEngagement } from "@/contexts/EngagementContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  Plus,
  Share2,
  Edit3,
  Music,
  Clock,
  ChevronRight,
  ListMusic,
  GripVertical,
  CheckSquare,
  Square,
  Copy,
  Trash2,
  Check,
  Headphones,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageShell } from "@/components/PageShell";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useTranslation } from "react-i18next";
import { MiniWaveform } from "@/components/MiniWaveform";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlaylists, type PlaylistItem } from "@/contexts/PlaylistContext";
import { DEFAULT_COVER } from "@/lib/constants";
import { statusColors } from "./Catalog";
import { useTrack, mapRowToTrack, type TrackData } from "@/contexts/TrackContext";
import { BulkEditBar } from "@/components/BulkEditBar";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// covers imported from PlaylistContext

type Track = TrackData;

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const itemVariant = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function PlaylistDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { getPlaylist, updatePlaylist, deletePlaylist } = usePlaylists();
  const { permissions } = useRole();
  const { tracks: allTracks, bulkUpdateTracks } = useTrack();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { getTotalPlaysForTrack, getPlaylistEngagement } = useEngagement();
  const { playTrack, togglePlay, isTrackPlaying, isPlaying: audioIsPlaying, currentTrack, setQueue, progress } = useAudioPlayer();
  const { activeWorkspace } = useWorkspace();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const playlistData = getPlaylist(id || "");
  // Persistent DB fallback — survives context resets, tab switch, refresh
  const dbPlaylistRef = useRef<PlaylistItem | null>(null);
  const dbFetchedRef = useRef<string | null>(null);
  const [, setForceUpdate] = useState(0);

  // Reset refs when navigating to a different playlist
  if (id && dbFetchedRef.current && dbFetchedRef.current !== id) {
    dbFetchedRef.current = null;
    dbPlaylistRef.current = null;
  }

  useEffect(function() {
    if (!id || dbFetchedRef.current === id) return;
    dbFetchedRef.current = id;
    supabase.from("playlists").select("*").eq("id", id).single().then(function(res) {
      if (!res.data) return;
      var row = res.data as Record<string, any>;
      dbPlaylistRef.current = {
        id: row.id,
        name: row.name || "Untitled",
        description: row.description || "",
        tracks: 0,
        duration: "",
        updated: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "",
        mood: row.mood || "",
        coverIdxs: [0, 1, 2, 3],
        color: "from-brand-purple/20 to-brand-orange/20",
        coverImage: row.cover_url || undefined,
        workspace_id: row.workspace_id,
      } as PlaylistItem;
      setForceUpdate(function(n) { return n + 1; });
    }).catch(function (err) { console.error("Error:", err); });
  }, [id]);

  const playlist = playlistData || dbPlaylistRef.current;
  const hadPlaylistRef = useRef(false);
  if (playlist) hadPlaylistRef.current = true;

  const plEngagement = getPlaylistEngagement(id || "");

  const [tracks, setTracks] = useState<Track[]>(() => {
    if (!playlist) return [];
    if (playlist.trackIds && playlist.trackIds.length > 0) {
      return playlist.trackIds
        .map((numericId) => allTracks.find((t) => t.id === numericId))
        .filter((t): t is Track => !!t);
    }
    return [];
  });

  const [dbTracks, setDbTracks] = useState<Track[]>([]);
  // Ordered track UUIDs of this playlist (from playlist_tracks). Resolved against
  // the hydrated catalog below — that store includes catalog-shared tracks, which
  // a direct `from(tracks)` select can't see due to RLS.
  const [playlistUuids, setPlaylistUuids] = useState<string[]>([]);

  useEffect(function() {
    if (!id) return;
    (async function() {
      try {
        const res = await supabase.from("playlist_tracks").select("track_id, position").eq("playlist_id", id).order("position", { ascending: true });
        if (!res.data || res.data.length === 0) return;
        const uuids = res.data.map(function(r) { return r.track_id; });
        setPlaylistUuids(uuids as string[]);
        const res2 = await supabase.from("tracks").select("*").in("id", uuids);
        if (!res2.data) return;
        const map: Record<string, any> = {};
        res2.data.forEach(function(t: any) { map[t.id] = t; });
        const ordered = uuids.map(function(uid) { return map[uid]; }).filter(Boolean);
        setDbTracks(ordered.map(function(row: any, idx: number) {
          return mapRowToTrack(row as Record<string, unknown>, idx);
        }) as Track[]);
      } catch (err) { console.error("Error:", err); }
    })();
  }, [id]);

  // Once the catalog store (allTracks) has hydrated — including catalog-shared
  // tracks pulled in via RPC — resolve the playlist's tracks from it. This fixes
  // playlists in shared workspaces showing empty: the initial `tracks` seed runs
  // once at mount (before hydration) and the `dbTracks` fallback is RLS-blocked
  // for shared tracks. We only fill while `tracks` is empty, so manual
  // reorder/add edits are never clobbered.
  useEffect(function() {
    if (tracks.length > 0 || playlistUuids.length === 0) return;
    const resolved = playlistUuids
      .map(function(uuid) { return allTracks.find(function(t) { return t.uuid === uuid; }); })
      .filter(function(t): t is Track { return !!t; });
    if (resolved.length > 0) setTracks(resolved);
  }, [playlistUuids, allTracks, tracks.length]);

  var displayTracks = tracks.length > 0 ? tracks : dbTracks;

  const playingTrackId = currentTrack && displayTracks.some((t) => t.id === currentTrack.id) && audioIsPlaying ? currentTrack.id : null;

  const setPlayingTrackId = useCallback((trackId: number | null) => {
    if (trackId === null) {
      togglePlay();
      return;
    }
    const track = displayTracks.find((t) => t.id === trackId);
    if (!track) return;
    if (currentTrack?.id === trackId) {
      togglePlay();
    } else {
      setQueue(displayTracks);
      playTrack(track);
    }
  }, [displayTracks, currentTrack, togglePlay, playTrack, setQueue]);
  const [renameValue, setRenameValue] = useState(playlist?.name || "");
  const [playlistName, setPlaylistName] = useState(playlist?.name || "");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(playlist?.description || "");
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [duplicateToast, setDuplicateToast] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Sync name/description when playlist loads from DB fallback
  useEffect(function() {
    if (playlist && !playlistName) {
      setPlaylistName(playlist.name);
      setRenameValue(playlist.name);
      setDescValue(playlist.description || "");
    }
  }, [playlist, playlistName]);

  // Sync changes back to context (returns the underlying RPC promise so callers can lock)
  const syncToContext = useCallback((updatedTracks: Track[], updatedName?: string) => {
    if (!id) return Promise.resolve();
    return Promise.resolve(updatePlaylist(id, {
      tracks: updatedTracks.length,
      duration: `${updatedTracks.length * 4} min`,
      trackIds: updatedTracks.map((t) => t.id),
      updated: "Just now",
      ...(updatedName ? { name: updatedName } : {}),
    }));
  }, [id, updatePlaylist]);

  // RPC concurrency lock — only one replace_playlist_tracks in-flight at a time.
  // Latest pending order wins (squashes intermediate states).
  const reorderInFlightRef = useRef(false);
  const pendingReorderRef = useRef<Track[] | null>(null);

  const flushReorder = useCallback(async () => {
    if (reorderInFlightRef.current) return;
    while (pendingReorderRef.current) {
      const toSync = pendingReorderRef.current;
      pendingReorderRef.current = null;
      reorderInFlightRef.current = true;
      try {
        await syncToContext(toSync);
      } catch (e) {
        console.error("Playlist reorder sync failed:", e);
      } finally {
        reorderInFlightRef.current = false;
      }
    }
  }, [syncToContext]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Operate on the list actually rendered (displayTracks may differ from `tracks` while dbTracks is the source).
    const source = displayTracks.filter((t): t is Track => !!t && t.id != null);
    const oldIdx = source.findIndex((t) => t.id === active.id);
    const newIdx = source.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(source, oldIdx, newIdx);
    setTracks(reordered);
    setDbTracks(reordered);
    pendingReorderRef.current = reordered;
    flushReorder();
  }, [displayTracks, flushReorder]);

  const removeTrack = useCallback((trackId: number) => {
    const source = displayTracks.filter((t): t is Track => !!t && t.id != null);
    if (source.length === 0) return;
    const updated = source.filter((t) => t.id !== trackId);
    if (updated.length === source.length) return;
    setTracks(updated);
    setDbTracks(updated);
    pendingReorderRef.current = updated;
    flushReorder();
  }, [displayTracks, flushReorder]);

  // ─── Multi-select (bulk edit + bulk remove-from-playlist) ───
  const selectableTracks = displayTracks.filter((t): t is Track => !!t && t.id != null);
  const allSelected = selectableTracks.length > 0 && selectableTracks.every((t) => selectedIds.has(t.id));
  const toggleSelect = (tid: number) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(tid)) n.delete(tid); else n.add(tid); return n; });
  const toggleSelectAll = () => setSelectedIds(() => (allSelected ? new Set() : new Set(selectableTracks.map((t) => t.id))));
  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const bulkRemoveSelected = () => {
    const source = displayTracks.filter((t): t is Track => !!t && t.id != null);
    const updated = source.filter((t) => !selectedIds.has(t.id));
    const removed = source.length - updated.length;
    if (removed === 0) return;
    setTracks(updated);
    setDbTracks(updated);
    pendingReorderRef.current = updated;
    flushReorder();
    toast.success(t("playlistDetail.bulkRemoved", { count: removed, defaultValue: "Removed " + removed + " tracks from the playlist" }));
    exitSelection();
  };

  const bulkEditSelected = async (updates: Partial<TrackData>): Promise<number> => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return 0;
    const n = await bulkUpdateTracks(ids, updates);
    if (n > 0) { toast.success(t("catalog.bulkUpdated", { count: n, defaultValue: "Updated " + n + " tracks" })); exitSelection(); }
    return n;
  };

  const availableToAdd = allTracks.filter((t) => !displayTracks.some((pt) => pt.id === t.id));
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

  return (
    <PageShell>
      {!playlist ? (
        hadPlaylistRef.current ? (
          <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <ListMusic className="w-5 h-5 animate-pulse" />
            <span className="text-sm">{t("playlistDetail.loading")}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center px-4">
            <ListMusic className="w-12 h-12 text-muted-foreground/15 mb-4" />
            <h2 className="text-lg font-semibold text-foreground">{t("playlistDetail.notFound")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("playlistDetail.mayHaveBeenRemoved")}</p>
            <Link to="/playlists" className="mt-4 text-sm gradient-text font-semibold hover:opacity-80 transition-opacity">
              {t("playlistDetail.backToPlaylists")}
            </Link>
          </div>
        )
      ) : (
      <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]"
      >
        {/* Breadcrumb */}
        <motion.div variants={itemVariant}>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/playlists">{t("playlistDetail.playlists")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{playlistName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </motion.div>

        {/* Hero */}
        <motion.div variants={itemVariant} className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          <div className="w-full sm:w-52 lg:w-60 shrink-0">
            <div
              className={"relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br group " + playlist.color}
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              {playlist.coverImage ? (
                <img src={playlist.coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                  {playlist.coverIdxs.slice(0, 4).map((ci, i) => (
                    <img key={i} src={DEFAULT_COVER} alt="" className="w-full h-full object-cover" />
                  ))}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  var file = e.target.files?.[0];
                  if (!file || !id) return;
                  var path = activeWorkspace.id + "/playlist-" + id + ".jpg";
                  var { error: uploadErr } = await supabase.storage
                    .from("covers")
                    .upload(path, file, { upsert: true, contentType: file.type });
                  if (uploadErr) {
                    console.error("Error uploading playlist cover:", uploadErr);
                    return;
                  }
                  var { data: urlData } = supabase.storage
                    .from("covers")
                    .getPublicUrl(path);
                  updatePlaylist(id, { coverImage: urlData.publicUrl });
                  e.target.value = "";
                }}
              />
              {permissions.canEditPlaylists && (
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 z-10"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/12 text-accent/80 mb-2">
                #{playlist.mood}
              </span>
              {editingName ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim() && renameValue.trim() !== playlistName) {
                      setPlaylistName(renameValue.trim());
                      syncToContext(displayTracks, renameValue.trim());
                    }
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") { setRenameValue(playlistName); setEditingName(false); }
                  }}
                  className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight bg-transparent border-b-2 border-primary/40 outline-none w-full"
                />
              ) : (
                <h1
                  className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight cursor-pointer hover:text-primary/80 transition-colors group/name"
                  onClick={() => { if (permissions.canEditPlaylists) { setRenameValue(playlistName); setEditingName(true); } }}
                  title={permissions.canEditPlaylists ? t("playlistDetail.clickToEdit") : undefined}
                >
                  {playlistName}
                  {permissions.canEditPlaylists && <Edit3 className="w-4 h-4 inline ml-2 opacity-0 group-hover/name:opacity-40 transition-opacity" />}
                </h1>
              )}
              {editingDesc ? (
                <textarea
                  autoFocus
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={() => {
                    if (id && descValue !== playlist.description) {
                      updatePlaylist(id, { description: descValue.trim() });
                    }
                    setEditingDesc(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setDescValue(playlist.description); setEditingDesc(false); }
                  }}
                  rows={2}
                  className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg bg-transparent border-b-2 border-primary/40 outline-none w-full resize-none"
                />
              ) : (
                <p
                  className={"text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-lg" + (permissions.canEditPlaylists ? " cursor-pointer hover:text-foreground/70 transition-colors" : "")}
                  onClick={() => { if (permissions.canEditPlaylists) { setDescValue(playlist.description); setEditingDesc(true); } }}
                  title={permissions.canEditPlaylists ? t("playlistDetail.clickToEdit") : undefined}
                >
                  {playlist.description || (permissions.canEditPlaylists ? t("playlistDetail.clickToAddDescription") : "")}
                </p>
              )}
            </div>

             <div className="flex items-center gap-4 text-muted-foreground">
               <span className="flex items-center gap-1.5 text-xs font-medium">
                 <Music className="w-3.5 h-3.5" />
                 {displayTracks.length} {t("playlistDetail.tracksCount")}
               </span>
               <span className="w-px h-4 bg-border" />
               <span className="flex items-center gap-1.5 text-xs font-medium">
                 <Clock className="w-3.5 h-3.5" />
                 {playlist.duration}
               </span>
               {plEngagement && plEngagement.totalPlays > 0 && (
                 <>
                   <span className="w-px h-4 bg-border" />
                   <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-pink">
                     <Headphones className="w-3.5 h-3.5" />
                     {plEngagement.totalPlays} {t("playlistDetail.playsCount")}
                   </span>
                 </>
               )}
               <span className="w-px h-4 bg-border hidden sm:block" />
               <span className="text-xs font-medium hidden sm:inline">{t("playlistDetail.updated", { date: playlist.updated })}</span>
             </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => {
                  if (playingTrackId) {
                    togglePlay();
                  } else if (displayTracks.length > 0) {
                    setQueue(displayTracks);
                    playTrack(displayTracks[0]);
                  }
                }}
                className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
              >
                {playingTrackId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                {playingTrackId ? t("playlistDetail.pause") : t("playlistDetail.playAll")}
              </button>
              {permissions.canEditPlaylists && (
                <button
                  onClick={() => setAddTrackOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                >
                  <Plus className="w-4 h-4" /> {t("playlistDetail.addTrack")}
                </button>
              )}


              {permissions.canCreatePlaylists && (
                <button
                  onClick={handleDuplicate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                >
                  <Copy className="w-4 h-4" /> {t("playlistDetail.duplicate")}
                </button>
              )}
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px]"
              >
                <Share2 className="w-4 h-4" /> {t("playlistDetail.share")}
              </button>
              {permissions.canManageTeam && id && (
                <PlaylistWorkspaceShare playlistId={id} playlistName={playlistName} />
              )}
              {permissions.canEditPlaylists && (
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" /> {t("playlistDetail.delete")}
                </button>
              )}
              {permissions.canEditPlaylists && !isMobile && (
                <button
                  onClick={() => { if (selectionMode) exitSelection(); else setSelectionMode(true); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium border transition-colors min-h-[44px] ${
                    selectionMode ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} {selectionMode ? t("catalog.doneSelecting", "Done") : t("catalog.select", "Select")}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Track list */}
        <motion.div variants={itemVariant}>
          {selectionMode && selectedIds.size > 0 && (
            <BulkEditBar
              count={selectedIds.size}
              onApply={bulkEditSelected}
              onClear={exitSelection}
              extra={
                <button
                  onClick={bulkRemoveSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t("playlistDetail.removeSelected", "Remove from playlist")}
                </button>
              }
            />
          )}
          {(() => {
            const safeTracks = displayTracks.filter((t): t is Track => !!t && t.id != null);
            return (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={safeTracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {isMobile ? (
                    <MobileTrackList
                      tracks={safeTracks}
                      playingTrackId={playingTrackId}
                      setPlayingTrackId={setPlayingTrackId}
                      removeTrack={removeTrack}
                    />
                  ) : (
                    <DesktopTrackTable
                      tracks={safeTracks}
                      playingTrackId={playingTrackId}
                      setPlayingTrackId={setPlayingTrackId}
                      removeTrack={removeTrack}
                      totalDuration={playlist.duration}
                      selectionMode={selectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      allSelected={allSelected}
                      onToggleAll={toggleSelectAll}
                    />
                  )}
                </SortableContext>
              </DndContext>
            );
          })()}
        </motion.div>
      </motion.div>

      {/* Add Track Dialog */}
      <Dialog open={addTrackOpen} onOpenChange={setAddTrackOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t("playlistDetail.addTracks")}</DialogTitle>
            <DialogDescription>{t("playlistDetail.addTracksDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 border border-border/50">
            <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder={t("playlistDetail.searchTracks")}
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none w-full"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 -mx-6 px-6">
            {filteredAvailable.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <p className="text-sm font-medium">{t("playlistDetail.noTracksAvailable")}</p>
                <p className="text-xs mt-1 text-muted-foreground/60">{t("playlistDetail.allTracksAdded")}</p>
              </div>
            ) : (
              filteredAvailable.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group/add"
                  onClick={() => { const updated = [...displayTracks, track]; setTracks(updated); syncToContext(updated); }}
                >
                  <img src={track.coverImage || DEFAULT_COVER} alt={track.title} loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <span className="text-2xs text-muted-foreground">{Array.isArray(track.genre) ? track.genre.join(", ") : track.genre}</span>
                  <Plus className="w-4 h-4 text-muted-foreground/40 group-hover/add:text-brand-orange transition-colors shrink-0" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {duplicateToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border shadow-lg text-sm font-medium text-foreground"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          {t("playlistDetail.duplicatedSuccess")}
      </motion.div>
      )}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareType="playlist"
        playlistId={id}
        playlistName={playlistName}
        playlistCover={playlist.coverImage}
        playlistTracks={displayTracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          genre: t.genre,
          coverImage: t.coverImage,
        }))}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t("playlistDetail.deletePlaylist")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("playlistDetail.deleteConfirm", { name: playlistName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm">{t("playlistDetail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm"
              onClick={async () => {
                if (id) {
                  await deletePlaylist(id);
                  navigate("/playlists");
                }
              }}
            >
              {t("playlistDetail.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </PageShell>
  );
}

/* ─── Sortable Desktop Row ─── */
function SortableDesktopRow({
  track,
  idx,
  isPlaying,
  setPlayingTrackId,
  removeTrack,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  track: Track;
  idx: number;
  isPlaying: boolean;
  setPlayingTrackId: (id: number | null) => void;
  removeTrack: (id: number) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isTrackPlaying, progress } = useAudioPlayer();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/40 last:border-0 hover:bg-secondary/25 transition-all duration-200 group/row cursor-pointer ${
        isDragging ? "bg-secondary/40 shadow-lg opacity-90" : ""
      }`}
      onClick={() => { if (selectionMode) { onToggleSelect?.(track.id); } else navigate("/track/" + track.uuid); }}
    >
      {selectionMode && (
        <td className="pl-3 pr-1 py-3 w-6" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(track.id); }}>
          {selected ? <CheckSquare className="w-4 h-4 text-brand-orange cursor-pointer" /> : <Square className="w-4 h-4 text-muted-foreground/50 hover:text-foreground cursor-pointer" />}
        </td>
      )}
      {/* Drag handle */}
      <td className="pl-3 pr-1 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      {/* # / Play */}
      <td className="pl-2 pr-2 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); setPlayingTrackId(isPlaying ? null : track.id); }}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isPlaying ? "btn-brand shadow-none" : "text-muted-foreground/40 group-hover/row:text-foreground"
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
          <img src={track.coverImage || DEFAULT_COVER} alt={track.title} loading="lazy" className="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate text-[13px] tracking-tight leading-tight">{track.title}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
          </div>
          <div className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${isPlaying ? "opacity-100" : "opacity-20 group-hover/row:opacity-50"}`}>
            <MiniWaveform seed={track.id * 13 + 7} bars={40} peaks={track.waveformData} progress={isTrackPlaying(track.id) ? progress : undefined} />
            <span className="text-2xs text-muted-foreground font-mono tabular-nums w-8 text-right">{track.duration}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">{track.type}</td>
      <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{Array.isArray(track.genre) ? track.genre.join(", ") : track.genre}</span></td>
      <td className="px-4 py-3 hidden lg:table-cell"><span className="font-mono text-2xs text-foreground/60 tabular-nums">{track.bpm}</span></td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
          <Music className="w-2.5 h-2.5 text-brand-orange/50" />{track.key}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-wrap gap-1 max-w-[140px]">
          {track.mood.map((tag) => (
            <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{tag}</span>
          ))}
        </div>
      </td>
       <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{track.language}</span></td>
       <PlaysCell trackId={track.id} />
       <td className="px-4 py-3">
         <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
       </td>
      <td className="px-2 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/row:opacity-100"
          title={t("playlistDetail.removeFromPlaylist")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

/* ─── Desktop Table ─── */
function DesktopTrackTable({
  tracks,
  playingTrackId,
  setPlayingTrackId,
  removeTrack,
  totalDuration,
  selectionMode,
  selectedIds,
  onToggleSelect,
  allSelected,
  onToggleAll,
}: {
  tracks: Track[];
  playingTrackId: number | null;
  setPlayingTrackId: (id: number | null) => void;
  removeTrack: (id: number) => void;
  totalDuration: string;
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="card-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {selectionMode && (
                <th className="pl-3 pr-1 py-3 w-6">
                  <button onClick={onToggleAll} className="text-muted-foreground hover:text-foreground" title={t("catalog.selectAll", "Select all")}>
                    {allSelected ? <CheckSquare className="w-4 h-4 text-brand-orange" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
              )}
              <th className="text-left pl-3 pr-1 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-6"></th>
              <th className="text-left pl-2 pr-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest w-8">#</th>
              <th className="text-left px-2 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("playlistDetail.columns.track")}</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">{t("playlistDetail.columns.type")}</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">{t("playlistDetail.columns.genre")}</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("playlistDetail.columns.bpm")}</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("playlistDetail.columns.key")}</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">{t("playlistDetail.columns.mood")}</th>
               <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">{t("playlistDetail.columns.language")}</th>
               <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("playlistDetail.columns.plays")}</th>
               <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("playlistDetail.columns.status")}</th>
               <th className="px-2 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={selectionMode ? 13 : 12} className="px-5 py-20 text-center text-muted-foreground">
                  <Music className="w-10 h-10 mx-auto mb-4 opacity-15" />
                  <p className="text-sm font-semibold">{t("playlistDetail.noTracksInPlaylist")}</p>
                  <p className="text-xs mt-1.5 text-muted-foreground/70">{t("playlistDetail.addFromCatalog")}</p>
                </td>
              </tr>
            ) : (
              tracks.map((track, idx) => (
                <SortableDesktopRow
                  key={track.id}
                  track={track}
                  idx={idx}
                  isPlaying={playingTrackId === track.id}
                  setPlayingTrackId={setPlayingTrackId}
                  removeTrack={removeTrack}
                  selectionMode={selectionMode}
                  selected={selectedIds?.has(track.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))
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
        <span>{tracks.length} {t("playlistDetail.tracksCount")} · {totalDuration}</span>
        <span className="text-2xs text-muted-foreground/50">TRAKALOG Playlist</span>
      </div>
    </div>
  );
}

/* ─── Sortable Mobile Card ─── */
function SortableMobileCard({
  track,
  isPlaying,
  setPlayingTrackId,
  removeTrack,
}: {
  track: Track;
  isPlaying: boolean;
  setPlayingTrackId: (id: number | null) => void;
  removeTrack: (id: number) => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-premium p-3.5 flex items-center gap-3 cursor-pointer ${isDragging ? "shadow-lg opacity-90 ring-1 ring-brand-orange/20" : ""}`}
      onClick={() => navigate("/track/" + track.uuid)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors shrink-0 touch-none min-h-[44px] min-w-[28px] flex items-center justify-center"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setPlayingTrackId(isPlaying ? null : track.id); }}
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

      <img src={track.coverImage || DEFAULT_COVER} alt={track.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">{track.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-muted-foreground/60">{Array.isArray(track.genre) ? track.genre.join(", ") : track.genre}</span>
          <span className="text-2xs text-muted-foreground/40">{track.bpm} BPM</span>
          <span className={`inline-flex px-1.5 py-0 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>{track.status}</span>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Mobile Card List ─── */
function MobileTrackList({
  tracks,
  playingTrackId,
  setPlayingTrackId,
  removeTrack,
}: {
  tracks: Track[];
  playingTrackId: number | null;
  setPlayingTrackId: (id: number | null) => void;
  removeTrack: (id: number) => void;
}) {
  const { t } = useTranslation();
  if (tracks.length === 0) {
    return (
      <div className="card-premium py-16 text-center">
        <Music className="w-10 h-10 mx-auto mb-4 text-muted-foreground/15" />
        <p className="text-sm font-semibold text-foreground">{t("playlistDetail.noTracksYet")}</p>
        <p className="text-xs mt-1 text-muted-foreground/60">{t("playlistDetail.addFromCatalog")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tracks.map((track) => (
        <SortableMobileCard
          key={track.id}
          track={track}
          isPlaying={playingTrackId === track.id}
          setPlayingTrackId={setPlayingTrackId}
          removeTrack={removeTrack}
        />
      ))}
    </div>
  );
}

/* ─── Plays Cell (uses hook) ─── */
function PlaysCell({ trackId }: { trackId: number }) {
  const { getTotalPlaysForTrack } = useEngagement();
  const plays = getTotalPlaysForTrack(trackId);
  return (
    <td className="px-4 py-3 hidden lg:table-cell text-center">
      {plays > 0 ? (
        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-foreground/70">
          <Headphones className="w-3 h-3 text-brand-pink/60" />{plays}
        </span>
      ) : (
        <span className="text-2xs text-muted-foreground/40">—</span>
      )}
    </td>
  );
}
