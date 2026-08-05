import { useState, useRef, useCallback, useMemo } from "react";
import { Star, Plus, MoreHorizontal, Loader2, StickyNote, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStorageUploadUrl } from "@/lib/audio";
import { sanitizeFileSizeBytes } from "@/lib/utils";
import { generateWaveform } from "@/lib/waveformGenerator";
import { encodeToMp3 } from "@/lib/mp3Encoder";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack, type TrackVersion } from "@/contexts/TrackContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".aiff", ".aif", ".m4a"];
const ACCEPTED_TYPES = ["audio/wav", "audio/wave", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/aiff", "audio/x-aiff", "audio/mp4", "audio/m4a", "audio/x-m4a"];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB — versions can be lossless masters

interface VersionSelectorProps {
  trackUuid: string;
  versions: TrackVersion[];
  currentVersionId: string | null;
  canEdit: boolean;
  onSelectVersion: (version: TrackVersion) => void;
  onVersionsChanged: () => Promise<void>;
}

function fileLooksLikeAudio(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function VersionSelector({
  trackUuid,
  versions,
  currentVersionId,
  canEdit,
  onSelectVersion,
  onVersionsChanged,
}: VersionSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { queueSonicDnaAnalysis } = useTrack();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TrackVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Defensive: collapse duplicate rows (same id) that a stale migration or a
  // doubled INSERT could have left in the DB. Keeps the same insertion order.
  const uniqueVersions = useMemo(() => {
    const seen = new Set<string>();
    const out: TrackVersion[] = [];
    for (const v of versions) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      out.push(v);
    }
    return out;
  }, [versions]);

  // Single-version + no edit permission → hide entirely (nothing to interact with)
  if (uniqueVersions.length <= 1 && !canEdit) return null;

  const handleSelectVersion = (v: TrackVersion) => {
    if (v.id === currentVersionId) return;
    onSelectVersion(v);
  };

  const handleStartRename = (v: TrackVersion) => {
    setRenamingId(v.id);
    setRenameValue(v.version_name);
  };

  const commitRename = useCallback(async (versionId: string) => {
    const newName = renameValue.trim();
    setRenamingId(null);
    const original = versions.find((v) => v.id === versionId);
    if (!original || !newName || newName === original.version_name) return;
    // Direct table update (RLS-gated). Falls back to error toast if denied.
    const { error } = await supabase
      .from("track_versions")
      .update({ version_name: newName })
      .eq("id", versionId);
    if (error) {
      console.error("Rename version failed:", error);
      toast.error(t("versionSelector.couldNotRename"));
      return;
    }
    await onVersionsChanged();
  }, [renameValue, versions, onVersionsChanged]);

  const handleUpload = useCallback(async (file: File) => {
    if (!user || !activeWorkspace || !trackUuid) return;
    if (uploadingRef.current) return;
    if (!fileLooksLikeAudio(file)) {
      toast.error(t("versionSelector.unsupportedFormat"));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t("versionSelector.tooLarge"));
      return;
    }

    uploadingRef.current = true;
    setUploading(true);

    try {
      // If this track has no versions yet, first materialise V1 from the ORIGINAL
      // master (tracks.audio_url + its preview / waveform / sonic_dna / duration)
      // BEFORE registering the uploaded file — otherwise the new file would take the
      // V1 slot and the master would no longer be reachable by any version. The
      // server assigns the number itself (add_track_version does MAX+1 under an
      // advisory lock), so we just call the RPC twice and never number on the client.
      const hadNoVersions = versions.length === 0;
      if (hadNoVersions) {
        const { data: master, error: masterErr } = await supabase
          .from("tracks")
          .select("audio_url, audio_preview_url, waveform_data, sonic_dna, duration_sec, file_size_bytes")
          .eq("id", trackUuid)
          .maybeSingle();
        if (masterErr) {
          // Can't confirm whether a master exists → abort rather than risk making
          // the new upload V1 and silently orphaning the original master.
          console.error("Fetch master for V1 backfill failed:", masterErr);
          toast.error(t("versionSelector.failedRegister"));
          return;
        } else if (master?.audio_url) {
          const { error: backfillErr } = await supabase.rpc("add_track_version", {
            _user_id: user.id,
            _track_id: trackUuid,
            _workspace_id: activeWorkspace.id,
            _audio_url: master.audio_url,
            _audio_preview_url: master.audio_preview_url ?? null,
            _waveform_data: master.waveform_data ?? null,
            _sonic_dna: master.sonic_dna ?? null,
            _duration_sec: master.duration_sec ?? null,
            // V1 = le master existant : sa taille est celle stockée sur la track,
            // pas celle du nouveau fichier uploadé (enregistré dans l'appel suivant).
            _file_size_bytes: sanitizeFileSizeBytes(master.file_size_bytes),
          });
          if (backfillErr) {
            // Abort rather than let the fresh upload become V1 and strand the master.
            console.error("V1 master backfill failed:", backfillErr);
            toast.error(t("versionSelector.failedRegister"));
            return;
          }
        }
      }

      // Display number for the toast only — the stored version_number and name are
      // assigned authoritatively by the RPC (we pass _version_name: null below).
      const dedupedNumbers = Array.from(new Set(versions.map((v) => v.version_number)));
      const nextVersionNumber = dedupedNumbers.length > 0
        ? Math.max(...dedupedNumbers) + 1
        : 1;
      const ext = (file.name.split(".").pop() || "wav").toLowerCase();
      // Each version MUST get its own storage key — never reuse the parent track's
      // path (the trakalog-tracks bucket has a 90-day retention lock that rejects
      // overwrites with HTTP 409, which would otherwise corrupt/lose the master).
      // A random UUID guarantees a re-upload of the same file never collides. The
      // first path segment must be the workspace UUID (get-upload-url rejects
      // otherwise); no "..", "//", leading "/" or "\" — all satisfied here.
      const filePath = activeWorkspace.id + "/versions/" + trackUuid + "/" + crypto.randomUUID() + "." + ext;

      // Upload directly to R2 (provider-agnostic) via signed PUT URL. Matches
      // the UploadTrackModal pipeline so reads through get-audio-url / get-storage-url
      // resolve the object in the same bucket the EF inspects (STORAGE_PROVIDER=r2).
      const contentType = file.type || "audio/mpeg";
      let descriptor;
      try {
        descriptor = await getStorageUploadUrl("tracks", filePath, contentType);
      } catch (e) {
        console.error("getStorageUploadUrl failed:", e);
        toast.error(t("versionSelector.uploadFailed"));
        return;
      }

      const putError = await new Promise<number | string | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(descriptor.method, descriptor.uploadUrl);
        for (const [name, value] of Object.entries(descriptor.headers)) {
          xhr.setRequestHeader(name, value);
        }
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(null);
            return;
          }
          resolve(xhr.status);
        });
        xhr.addEventListener("error", () => resolve("Network error during upload"));
        xhr.addEventListener("abort", () => resolve("Upload aborted"));
        xhr.addEventListener("timeout", () => resolve("Upload timed out"));
        xhr.send(file);
      });
      if (putError !== null) {
        console.error("Version upload failed:", putError);
        // 409 (retention lock refuses overwrite) / 403 (denied): surface a clear
        // message instead of a generic failure so the cause is understandable.
        const isProtected = putError === 409 || putError === 403;
        toast.error(
          isProtected
            ? t("versionSelector.overwriteProtected", "This file could not be uploaded because it would overwrite a protected master")
            : t("versionSelector.uploadFailed"),
        );
        return;
      }

      const { error: rpcError } = await supabase.rpc("add_track_version", {
        _user_id: user.id,
        _track_id: trackUuid,
        _workspace_id: activeWorkspace.id,
        _audio_url: filePath,
        // Let the server name it (V{MAX+1}) so it always matches the number it
        // assigns — after a V1 backfill this correctly becomes V2.
        _version_name: null,
        // Taille du fichier audio réel (File.size), pour le suivi de stockage.
        // Même flux pour l'ajout et le remplacement de version.
        _file_size_bytes: sanitizeFileSizeBytes(file.size),
      });
      if (rpcError) {
        console.error("add_track_version failed:", rpcError);
        toast.error(t("versionSelector.failedRegister"));
        return;
      }

      // Look up the inserted row by its unique audio_url so the per-version
      // waveform / preview writes target the right row even if the server
      // recomputed version_number under contention.
      let newVersionId: string | null = null;
      try {
        const { data: row } = await supabase
          .from("track_versions")
          .select("id")
          .eq("track_id", trackUuid)
          .eq("audio_url", filePath)
          .maybeSingle();
        newVersionId = row?.id ?? null;
      } catch (e) {
        console.error("Lookup new version row failed:", e);
      }

      toast.success(t("versionSelector.uploadedAnalyzing", { n: hadNoVersions ? nextVersionNumber + 1 : nextVersionNumber }));
      await onVersionsChanged();

      // Generate waveform client-side from the in-memory File (no extra fetch),
      // then persist to the version row so the player switches to per-version
      // peaks immediately when the user A/B's between versions.
      if (newVersionId) {
        const versionIdForWaveform = newVersionId;
        generateWaveform(file, 200)
          .then(async (peaks) => {
            if (!peaks || peaks.length === 0) return;
            const { error } = await supabase.rpc("update_track_version_waveform", {
              _user_id: user.id,
              _version_id: versionIdForWaveform,
              _track_id: trackUuid,
              _workspace_id: activeWorkspace.id,
              _waveform_data: peaks,
            });
            if (error) {
              console.error("update_track_version_waveform failed:", error);
              return;
            }
            await onVersionsChanged();
          })
          .catch((e) => console.error("Waveform generation failed:", e));
      }

      // Fire-and-forget MP3 preview compression. Mirrors UploadTrackModal:
      // client-side encode → direct PUT to R2 → record the preview path on
      // the version row. RLS on track_versions gates this write.
      if (newVersionId) {
        const versionIdForPreview = newVersionId;
        (async () => {
          try {
            const mp3Blob = await encodeToMp3(file);
            const previewPath = filePath.replace(/\.[^.]+$/, "_preview.mp3");
            const desc = await getStorageUploadUrl("tracks", previewPath, "audio/mp3");
            const previewRes = await fetch(desc.uploadUrl, {
              method: desc.method,
              headers: desc.headers,
              body: mp3Blob,
            });
            if (!previewRes.ok) {
              throw new Error("Preview PUT failed (HTTP " + previewRes.status + ")");
            }
            const { error: updErr } = await supabase
              .from("track_versions")
              .update({ audio_preview_url: previewPath })
              .eq("id", versionIdForPreview);
            if (updErr) throw updErr;
            await onVersionsChanged();
          } catch (e) {
            console.error("MP3 preview for version failed:", e);
          }
        })();
      }

      // Queue Sonic DNA analysis on the new version's audio path. Reuses the
      // global sequential queue from TrackContext to prevent Railway OOM when
      // multiple versions are uploaded in quick succession.
      queueSonicDnaAnalysis(trackUuid, filePath);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }, [user, activeWorkspace, trackUuid, versions, onVersionsChanged]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleSetActive = useCallback(async (v: TrackVersion) => {
    if (!user || !activeWorkspace || v.is_active) return;
    const { error } = await supabase.rpc("set_track_version_active", {
      _user_id: user.id,
      _track_id: trackUuid,
      _workspace_id: activeWorkspace.id,
      _version_id: v.id,
    });
    if (error) {
      console.error("set_track_version_active failed:", error);
      toast.error(t("versionSelector.failedSetActive"));
      return;
    }
    toast.success(t("versionSelector.nowActive", { name: v.version_name }));
    await onVersionsChanged();
  }, [user, activeWorkspace, trackUuid, onVersionsChanged]);

  const handleConfirmDelete = useCallback(async () => {
    if (!user || !activeWorkspace || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_track_version", {
        _user_id: user.id,
        _version_id: deleteTarget.id,
        _track_id: trackUuid,
        _workspace_id: activeWorkspace.id,
      });
      if (error) {
        // The SQL function RAISEs exceptions for known states — Postgres surfaces
        // the exception name inside error.message.
        const msg = error.message || "";
        if (msg.includes("cannot_delete_last_version")) {
          toast.error(t("versionSelector.cantDeleteOnly"));
        } else if (msg.includes("cannot_delete_active_version")) {
          toast.error(t("versionSelector.setActiveFirst"));
        } else {
          console.error("delete_track_version failed:", error);
          toast.error(t("versionSelector.failedDelete"));
        }
        return;
      }
      toast.success(t("versionSelector.deleted", { name: deleteTarget.version_name }));
      setDeleteTarget(null);
      await onVersionsChanged();
    } finally {
      setDeleting(false);
    }
  }, [user, activeWorkspace, trackUuid, deleteTarget, deleting, onVersionsChanged]);

  const handleSaveNotes = useCallback(async (versionId: string, notes: string) => {
    if (!user || !activeWorkspace) return;
    const { error } = await supabase.rpc("update_track_version_notes", {
      _user_id: user.id,
      _version_id: versionId,
      _track_id: trackUuid,
      _workspace_id: activeWorkspace.id,
      _notes: notes,
    });
    if (error) {
      console.error("update_track_version_notes failed:", error);
      toast.error(t("versionSelector.failedNotes"));
      return;
    }
    await onVersionsChanged();
  }, [user, activeWorkspace, trackUuid, onVersionsChanged]);

  // Single-version view: no tabs, no star — there's nothing to switch between.
  // Just label the lone version "Main Version" and expose the Add button.
  if (uniqueVersions.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 pb-1">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-border bg-card/60 text-xs font-medium text-muted-foreground">
          {t("versionSelector.mainVersion")}
        </span>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",") + "," + ACCEPTED_TYPES.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-pink/40 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("versionSelector.uploading")}
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> {t("versionSelector.addVersion")}
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
      {uniqueVersions.map((v) => {
        const isCurrent = v.id === currentVersionId;
        const isRenaming = renamingId === v.id;
        return (
          <div
            key={v.id}
            className={
              "shrink-0 inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-lg border text-xs font-medium transition-colors " +
              (isCurrent
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer")
            }
            onClick={() => !isRenaming && handleSelectVersion(v)}
            onDoubleClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              handleStartRename(v);
            }}
            title={v.notes ? v.notes : v.version_name}
          >
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(v.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(v.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-b border-primary/40 outline-none w-16 text-xs"
                maxLength={32}
              />
            ) : (
              <span className="select-none">{v.version_name}</span>
            )}
            {v.is_active && <Star className="w-3 h-3 fill-current" aria-label="Active version" />}
            {v.notes && !isRenaming && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-0.5 rounded hover:bg-foreground/10"
                    aria-label="Show notes"
                  >
                    <StickyNote className="w-3 h-3 opacity-70" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3">
                  <VersionNotesEditor
                    initialValue={v.notes || ""}
                    onSave={(notes) => handleSaveNotes(v.id, notes)}
                    readOnly={!canEdit}
                  />
                </PopoverContent>
              </Popover>
            )}
            {canEdit && !isRenaming && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded hover:bg-foreground/10"
                    aria-label="Version options"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {!v.is_active && (
                    <DropdownMenuItem onClick={() => handleSetActive(v)}>
                      <Star className="w-3.5 h-3.5 mr-2" /> {t("versionSelector.setAsActive")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleStartRename(v)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> {t("versionSelector.rename")}
                  </DropdownMenuItem>
                  {!v.notes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <StickyNote className="w-3.5 h-3.5 mr-2" /> {t("versionSelector.addNotes")}
                        </DropdownMenuItem>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-3">
                        <VersionNotesEditor
                          initialValue=""
                          onSave={(notes) => handleSaveNotes(v.id, notes)}
                          readOnly={!canEdit}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(v)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> {t("versionSelector.deleteVersion")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}

      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",") + "," + ACCEPTED_TYPES.join(",")}
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-pink/40 transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> {t("versionSelector.uploading")}
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" /> {t("versionSelector.addVersion")}
              </>
            )}
          </button>
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("versionSelector.deleteTitle", { name: deleteTarget?.version_name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("versionSelector.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("versionSelector.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? t("versionSelector.deleting") : t("versionSelector.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface VersionNotesEditorProps {
  initialValue: string;
  onSave: (notes: string) => void | Promise<void>;
  readOnly?: boolean;
}

function VersionNotesEditor({ initialValue, onSave, readOnly }: VersionNotesEditorProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (readOnly) return;
    const next = value.trim();
    if (next === initialValue.trim()) return;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">{t("versionSelector.notes")}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        readOnly={readOnly}
        placeholder={t("versionSelector.notesPlaceholder")}
        rows={3}
        maxLength={500}
        className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 resize-none"
      />
      {!readOnly && (
        <p className="text-[10px] text-muted-foreground">{t("versionSelector.savesOnBlur", { count: value.length })}</p>
      )}
      {saving && <p className="text-[10px] text-muted-foreground">{t("versionSelector.saving")}</p>}
    </div>
  );
}
