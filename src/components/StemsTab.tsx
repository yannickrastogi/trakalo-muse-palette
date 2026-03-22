import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack } from "@/contexts/TrackContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Download,
  Upload,
  Trash2,
  Music,
  Mic,
  Guitar as GuitarIcon,
  Layers,
  Plus,
  X,
  ChevronRight,
  Loader2,
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

import { STEM_TYPES } from "@/lib/constants";
import type { StemType } from "@/lib/constants";

interface StemRecord {
  id: string;
  fileName: string;
  type: StemType;
  fileUrl: string;
  fileSize: string;
  uploadDate: string;
}

interface StemsTabProps {
  trackId: number;
  autoOpenUpload?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

function guessType(name: string): StemType {
  const n = name.toLowerCase();
  if (n.includes("kick")) return "kick";
  if (n.includes("snare")) return "snare";
  if (n.includes("bass")) return "bass";
  if (n.includes("guitar")) return "guitar";
  if ((n.includes("vocal") && n.includes("bg")) || n.includes("backing")) return "background vocal";
  if (n.includes("vocal") || n.includes("vox")) return "vocal";
  if (n.includes("synth") || n.includes("pad") || n.includes("keys")) return "synth";
  if (n.includes("drum") || n.includes("perc")) return "drums";
  if (n.includes("fx") || n.includes("riser") || n.includes("effect")) return "fx";
  return "other";
}

function stemTypeToDb(type: StemType): string {
  switch (type) {
    case "background vocal": return "background_vocal";
    default: return type;
  }
}

function dbToStemType(type: string): StemType {
  switch (type) {
    case "background_vocal": return "background vocal";
    default: return type as StemType;
  }
}

function stemTypeIcon(type: StemType) {
  switch (type) {
    case "vocal":
    case "background vocal":
      return <Mic className="w-3.5 h-3.5" />;
    case "guitar":
      return <GuitarIcon className="w-3.5 h-3.5" />;
    default:
      return <Music className="w-3.5 h-3.5" />;
  }
}

export function StemsTab({ trackId, autoOpenUpload = false }: StemsTabProps) {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { getTrack } = useTrack();
  const { playTrack, currentTrack, isPlaying: globalIsPlaying, togglePlay, pause } = useAudioPlayer();
  const trackData = getTrack(trackId);

  const [stems, setStems] = useState<StemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(autoOpenUpload);
  const [modalDragOver, setModalDragOver] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: StemType; customName: string }[]>([]);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Track UUID for Supabase queries
  const trackUuid = trackData?.uuid;

  // Fetch stems from Supabase
  const fetchStems = useCallback(async () => {
    if (!trackUuid || !activeWorkspace) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stems")
        .select("*")
        .eq("track_id", trackUuid)
        .eq("workspace_id", activeWorkspace.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching stems:", error);
        setStems([]);
      } else {
        const mapped: StemRecord[] = (data || []).map((row) => ({
          id: row.id,
          fileName: row.file_name,
          type: dbToStemType(row.stem_type),
          fileUrl: row.file_url,
          fileSize: row.file_size_bytes ? formatFileSize(row.file_size_bytes) : "—",
          uploadDate: new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        }));
        setStems(mapped);
      }
    } catch (err) {
      console.error("Unexpected error fetching stems:", err);
    } finally {
      setLoading(false);
    }
  }, [trackUuid, activeWorkspace]);

  useEffect(() => {
    fetchStems();
  }, [fetchStems]);

  // Stage files for upload
  const stageFiles = (files: File[]) => {
    const audioFiles = files.filter((f) =>
      f.name.match(/\.(wav|mp3|aiff|flac|ogg|m4a)$/i)
    );
    setPendingFiles((prev) => [
      ...prev,
      ...audioFiles.map((f) => ({ file: f, type: guessType(f.name), customName: f.name.replace(/\.[^.]+$/, "") })),
    ]);
  };

  const updatePendingType = (index: number, type: StemType) => {
    setPendingFiles((prev) => prev.map((p, i) => i === index ? { ...p, type } : p));
  };

  const updatePendingName = (index: number, customName: string) => {
    setPendingFiles((prev) => prev.map((p, i) => i === index ? { ...p, customName } : p));
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload stems to Supabase
  const confirmUpload = useCallback(async () => {
    if (!activeWorkspace || !user || !trackUuid || pendingFiles.length === 0) return;
    setUploading(true);

    try {
      for (const pf of pendingFiles) {
        const fileExt = pf.file.name.split(".").pop() || "wav";
        const filePath = activeWorkspace.id + "/" + trackUuid + "/" + crypto.randomUUID() + "." + fileExt;

        // Upload file to Storage
        const { error: uploadError } = await supabase.storage
          .from("stems")
          .upload(filePath, pf.file, {
            contentType: pf.file.type || "audio/wav",
            upsert: false,
          });

        if (uploadError) {
          console.error("Error uploading stem:", uploadError);
          continue;
        }

        // Get signed URL
        const { data: signedData } = await supabase.storage
          .from("stems")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        const fileUrl = signedData?.signedUrl || "";

        // Insert record in stems table
        const { error: insertError } = await supabase
          .from("stems")
          .insert({
            workspace_id: activeWorkspace.id,
            track_id: trackUuid,
            uploaded_by: user.id,
            file_name: pf.customName.trim() ? pf.customName.trim() + "." + fileExt : pf.file.name,
            stem_type: stemTypeToDb(pf.type),
            file_url: fileUrl,
            file_size_bytes: pf.file.size,
          });

        if (insertError) {
          console.error("Error inserting stem record:", insertError);
        }
      }

      // Refresh stems list
      await fetchStems();
      setPendingFiles([]);
      setShowUploadModal(false);
    } catch (err) {
      console.error("Error during stem upload:", err);
    } finally {
      setUploading(false);
    }
  }, [activeWorkspace, user, trackUuid, pendingFiles, fetchStems]);

  // Delete stem
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const stem = stems.find((s) => s.id === deleteConfirmId);
    if (!stem) return;

    // Delete from database
    const { error } = await supabase
      .from("stems")
      .delete()
      .eq("id", deleteConfirmId);

    if (error) {
      console.error("Error deleting stem:", error);
    } else {
      setStems((prev) => prev.filter((s) => s.id !== deleteConfirmId));
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, stems]);

  // Play stem via global player
  const handlePlayStem = useCallback((stem: StemRecord) => {
    if (!stem.fileUrl) return;

    // Create a fake TrackData to play via global player
    const stemAsTrack = {
      id: stem.id.hashCode ? stem.id.hashCode() : Math.abs(stem.id.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
      uuid: stem.id,
      workspace_id: activeWorkspace?.id || "",
      title: stem.fileName,
      artist: trackData?.artist || "Stem",
      featuredArtists: [],
      album: "",
      genre: "",
      bpm: 0,
      key: "",
      duration: "0:00",
      mood: [],
      voice: "",
      status: "Available",
      isrc: "",
      upc: "",
      releaseDate: "",
      label: "",
      publisher: "",
      writtenBy: [],
      producedBy: [],
      mixedBy: "",
      masteredBy: "",
      copyright: "",
      language: "",
      explicit: false,
      type: "Stem",
      coverIdx: 0,
      previewUrl: stem.fileUrl,
      notes: "",
      details: {},
      stems: [],
      splits: [],
      statusHistory: [],
    };

    // Check if this stem is currently playing
    const stemNumericId = stemAsTrack.id;
    if (currentTrack?.id === stemNumericId && globalIsPlaying) {
      togglePlay();
    } else if (currentTrack?.id === stemNumericId && !globalIsPlaying) {
      togglePlay();
    } else {
      playTrack(stemAsTrack as any);
    }
  }, [activeWorkspace, trackData, currentTrack, globalIsPlaying, togglePlay, playTrack]);

  const isStemPlaying = useCallback((stemId: string) => {
    const numId = Math.abs(stemId.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
    return currentTrack?.id === numId && globalIsPlaying;
  }, [currentTrack, globalIsPlaying]);

  // Change stem type
  const handleChangeType = useCallback(async (stemId: string, newType: StemType) => {
    setStems((prev) => prev.map((s) => s.id === stemId ? { ...s, type: newType } : s));
    setEditingTypeId(null);

    const { error } = await supabase
      .from("stems")
      .update({ stem_type: stemTypeToDb(newType) })
      .eq("id", stemId);

    if (error) {
      console.error("Error updating stem type:", error);
    }
  }, []);

  // Drop handler
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    stageFiles(files);
    setShowUploadModal(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("stemsTab.title", { count: stems.length })}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("stemsTab.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold btn-brand"
          >
            <Upload className="w-3.5 h-3.5" /> {t("stemsTab.uploadStems")}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        className={"relative rounded-xl border-2 border-dashed transition-all duration-200 " + (isDragOver ? "border-primary bg-primary/5 scale-[1.005]" : "border-border hover:border-muted-foreground/30")}
      >
        {/* Drop overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center"
              style={{ background: "var(--gradient-brand-soft)" }}
            >
              <Upload className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">{t("stemsTab.dropHere")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("stemsTab.fileFormats")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {stems.length === 0 ? (
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-full py-16 flex flex-col items-center justify-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-2xl icon-brand flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("stemsTab.noStems")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("stemsTab.dragDrop")}</p>
            </div>
          </button>
        ) : (
          <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-5 py-3 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>{t("stemsTab.file")}</span>
              <span>{t("stemsTab.type")}</span>
              <span>{t("stemsTab.size")}</span>
              <span>{t("stemsTab.uploaded")}</span>
              <span className="text-right">{t("stemsTab.actions")}</span>
            </div>

            {/* Stem rows */}
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {stems.map((stem) => {
                  const playing = isStemPlaying(stem.id);
                  return (
                    <motion.div
                      key={stem.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                      className="grid grid-cols-[1fr_120px_80px_100px_110px] gap-3 px-5 py-3 items-center hover:bg-secondary/30 transition-colors group"
                    >
                      {/* File name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
                          {stemTypeIcon(stem.type)}
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{stem.fileName}</span>
                      </div>

                      {/* Type badge */}
                      <div className="relative">
                        <button
                          onClick={() => setEditingTypeId(editingTypeId === stem.id ? null : stem.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[11px] font-medium text-secondary-foreground capitalize hover:bg-muted transition-colors cursor-pointer"
                        >
                          {stem.type}
                          <ChevronRight className={"w-3 h-3 transition-transform " + (editingTypeId === stem.id ? "rotate-90" : "")} />
                        </button>
                        <AnimatePresence>
                          {editingTypeId === stem.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute z-30 top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1"
                            >
                              {STEM_TYPES.map((t) => (
                                <button
                                  key={t}
                                  onClick={() => handleChangeType(stem.id, t)}
                                  className={"w-full text-left px-3 py-1.5 text-xs capitalize transition-colors " + (stem.type === t ? "bg-primary/10 text-primary font-semibold" : "text-popover-foreground hover:bg-secondary")}
                                >
                                  {t}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Size */}
                      <span className="text-xs text-muted-foreground font-mono">{stem.fileSize}</span>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground">{stem.uploadDate}</span>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePlayStem(stem)}
                          className={"p-1.5 rounded-lg transition-colors " + (playing ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                          title={t("stemsTab.playPreview")}
                        >
                          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(stem.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          title={t("stemsTab.delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-secondary/30 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {t("stemsTab.uploadMore")}
            </button>
          </div>
        )}
      </div>

      {/* Upload modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative z-10 w-full md:max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95dvh]"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("stemsTab.uploadModalTitle")}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("stemsTab.uploadModalDesc")}</p>
                </div>
                <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setModalDragOver(true); }}
                onDragLeave={() => setModalDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setModalDragOver(false);
                  stageFiles(Array.from(e.dataTransfer.files));
                }}
                onClick={() => modalFileInputRef.current?.click()}
                className={"mx-6 mt-4 mb-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 " + (modalDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40 hover:bg-secondary/30")}
              >
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Upload className={"w-5 h-5 " + (modalDragOver ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {modalDragOver ? t("stemsTab.dropFilesHere") : t("stemsTab.dropStemsHere")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("stemsTab.orClickBrowse")}</p>
                </div>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept=".wav,.mp3,.aiff,.flac,.ogg,.m4a"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      stageFiles(Array.from(e.target.files));
                      e.target.value = "";
                    }
                  }}
                />
              </div>

              {/* Staged files */}
              {pendingFiles.length > 0 && (
                <>
                  <div className="px-6 pt-2 pb-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {t("stemsTab.filesReady", { count: pendingFiles.length })}
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-border mx-2">
                    {pendingFiles.map((pf, index) => (
                      <div key={index} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Music className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={pf.customName}
                            onChange={(e) => updatePendingName(index, e.target.value)}
                            placeholder={pf.file.name.replace(/\.[^.]+$/, "")}
                            className="text-sm font-medium text-foreground bg-transparent border-0 outline-none w-full rounded px-1 -ml-1 hover:bg-secondary focus:bg-secondary focus:ring-1 focus:ring-ring transition-colors"
                          />
                          <p className="text-[11px] text-muted-foreground px-1">{formatFileSize(pf.file.size)}</p>
                        </div>
                        <select
                          value={pf.type}
                          onChange={(e) => updatePendingType(index, e.target.value as StemType)}
                          className="h-8 px-2.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground capitalize appearance-none cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                          style={{ minWidth: "120px" }}
                        >
                          {STEM_TYPES.map((t) => (
                            <option key={t} value={t} className="capitalize">{t}</option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => { e.stopPropagation(); removePending(index); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between mt-2">
                <button
                  onClick={() => { setShowUploadModal(false); setPendingFiles([]); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors"
                >
                  {t("stemsTab.cancel")}
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={pendingFiles.length === 0 || uploading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-brand disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("stemsTab.uploading")}</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /> {pendingFiles.length > 0 ? t("stemsTab.uploadCount", { count: pendingFiles.length }) : t("stemsTab.uploadStems")}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stemsTab.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("stemsTab.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("stemsTab.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t("stemsTab.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
