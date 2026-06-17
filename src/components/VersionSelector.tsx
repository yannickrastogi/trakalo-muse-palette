import { useState, useRef, useCallback } from "react";
import { Star, Plus, MoreHorizontal, Loader2, StickyNote, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack, type TrackVersion } from "@/contexts/TrackContext";
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

  // Single-version + no edit permission → hide entirely
  if (versions.length <= 1 && !canEdit) return null;

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
      toast.error("Could not rename version");
      return;
    }
    await onVersionsChanged();
  }, [renameValue, versions, onVersionsChanged]);

  const handleUpload = useCallback(async (file: File) => {
    if (!user || !activeWorkspace || !trackUuid) return;
    if (uploadingRef.current) return;
    if (!fileLooksLikeAudio(file)) {
      toast.error("Unsupported format — use WAV, MP3, FLAC, AIFF, M4A");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File is too large (max 500MB)");
      return;
    }

    uploadingRef.current = true;
    setUploading(true);

    try {
      const nextVersionNumber = versions.length > 0
        ? Math.max(...versions.map((v) => v.version_number)) + 1
        : 1;
      const ext = (file.name.split(".").pop() || "wav").toLowerCase();
      const filePath = activeWorkspace.id + "/" + trackUuid + "_v" + nextVersionNumber + "." + ext;

      const { error: uploadError } = await supabase.storage
        .from("tracks")
        .upload(filePath, file, {
          contentType: file.type || "audio/mpeg",
          upsert: true,
        });
      if (uploadError) {
        console.error("Version upload failed:", uploadError);
        toast.error("Upload failed — please try again");
        return;
      }

      const { error: rpcError } = await supabase.rpc("add_track_version", {
        _user_id: user.id,
        _track_id: trackUuid,
        _workspace_id: activeWorkspace.id,
        _audio_url: filePath,
        _version_name: "V" + nextVersionNumber,
      });
      if (rpcError) {
        console.error("add_track_version failed:", rpcError);
        toast.error("Failed to register version");
        return;
      }

      toast.success("Version V" + nextVersionNumber + " uploaded — Sonic DNA analysis in progress...");
      await onVersionsChanged();

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
      toast.error("Failed to set active version");
      return;
    }
    toast.success(v.version_name + " is now the active version");
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
          toast.error("Can't delete the only version of a track");
        } else if (msg.includes("cannot_delete_active_version")) {
          toast.error("Set another version as active before deleting this one");
        } else {
          console.error("delete_track_version failed:", error);
          toast.error("Failed to delete version");
        }
        return;
      }
      toast.success(deleteTarget.version_name + " deleted");
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
      toast.error("Failed to save notes");
      return;
    }
    await onVersionsChanged();
  }, [user, activeWorkspace, trackUuid, onVersionsChanged]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
      {versions.map((v) => {
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
                      <Star className="w-3.5 h-3.5 mr-2" /> Set as Active
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleStartRename(v)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  {!v.notes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <StickyNote className="w-3.5 h-3.5 mr-2" /> Add notes
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
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Version
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
                <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" /> Add Version
              </>
            )}
          </button>
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.version_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The audio file and Sonic DNA for this version will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
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
      <p className="text-xs font-semibold text-foreground">Notes</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        readOnly={readOnly}
        placeholder="e.g. Mix by Jean, added bridge guitar…"
        rows={3}
        maxLength={500}
        className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 resize-none"
      />
      {!readOnly && (
        <p className="text-[10px] text-muted-foreground">Saves on blur · {value.length}/500</p>
      )}
      {saving && <p className="text-[10px] text-muted-foreground">Saving…</p>}
    </div>
  );
}
