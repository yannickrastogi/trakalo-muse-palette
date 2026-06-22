import { useState, useRef, useCallback, useEffect } from "react";
import { Film, Upload, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStorageSignedUrl, getStorageUploadUrl } from "@/lib/audio";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTrack } from "@/contexts/TrackContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_EXTENSIONS = [".mp4", ".mov", ".webm"];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

interface VideoSectionProps {
  /** UUID of the track row in DB */
  trackUuid: string;
  videoUrl: string | null;
  videoFilename: string | null;
  videoVisibleOnShare: boolean;
  /** Read-only: shared-from / not editable. */
  readOnly?: boolean;
}

function fileLooksLikeVideo(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  // Safari sometimes leaves file.type empty — fall back to extension.
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function videoMimeFromExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export function VideoSection({
  trackUuid,
  videoUrl,
  videoFilename,
  videoVisibleOnShare,
  readOnly,
}: VideoSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { refreshTracks } = useTrack();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Hard guard against rapid double-clicks (state setter is async; this ref is sync).
  const uploadingRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  // Resolve a fresh signed URL whenever a video path is present.
  useEffect(() => {
    let cancelled = false;
    if (!videoUrl) {
      setSignedUrl(null);
      return;
    }
    setSigning(true);
    getStorageSignedUrl("documents", videoUrl, { expiresInSec: 3600 })
      .then((url) => { if (!cancelled) setSignedUrl(url); })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to sign video URL:", err);
          setSignedUrl(null);
        }
      })
      .finally(() => { if (!cancelled) setSigning(false); });
    return () => { cancelled = true; };
  }, [videoUrl]);

  const handleUpload = useCallback(async (file: File) => {
    if (!user || !activeWorkspace || !trackUuid) return;
    if (uploadingRef.current) return; // race guard — drop overlapping clicks
    if (!fileLooksLikeVideo(file)) {
      toast.error(t("videoSection.unsupportedFormat"));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t("videoSection.tooLarge"));
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    setProgress(0);

    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const safeExt = ACCEPTED_EXTENSIONS.includes("." + ext) ? ext : "mp4";
      const filePath = activeWorkspace.id + "/" + trackUuid + "/video." + safeExt;
      const contentType = file.type || videoMimeFromExt(file.name);

      // PUT directly to R2 via get-upload-url EF — no Supabase Storage hop.
      try {
        const desc = await getStorageUploadUrl("documents", filePath, contentType);
        const res = await fetch(desc.uploadUrl, {
          method: desc.method,
          headers: desc.headers,
          body: file,
        });
        if (!res.ok) throw new Error("Video PUT failed (HTTP " + res.status + ")");
      } catch (e) {
        console.error("Video upload failed:", e instanceof Error ? e.message : e);
        toast.error(t("videoSection.uploadFailed"));
        return;
      }
      setProgress(100);

      // Persist the storage path (not a signed URL) so we can re-sign on demand.
      const { error: rpcError } = await supabase.rpc("update_track_video", {
        _user_id: user.id,
        _track_id: trackUuid,
        _workspace_id: activeWorkspace.id,
        _video_url: filePath,
        _video_filename: file.name,
      });

      if (rpcError) {
        console.error("update_track_video failed:", rpcError);
        toast.error(t("videoSection.failedSave"));
        return;
      }

      toast.success(t("videoSection.uploaded"));
      await refreshTracks();
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setProgress(0);
    }
  }, [user, activeWorkspace, trackUuid, refreshTracks]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleToggleVisibility = useCallback(async () => {
    if (!user || !activeWorkspace || !trackUuid || savingVisibility) return;
    setSavingVisibility(true);
    const next = !videoVisibleOnShare;
    const { error } = await supabase.rpc("toggle_track_video_visibility", {
      _user_id: user.id,
      _track_id: trackUuid,
      _workspace_id: activeWorkspace.id,
      _visible: next,
    });
    setSavingVisibility(false);
    if (error) {
      console.error("toggle_track_video_visibility failed:", error);
      toast.error(t("videoSection.failedVisibility"));
      return;
    }
    await refreshTracks();
  }, [user, activeWorkspace, trackUuid, videoVisibleOnShare, savingVisibility, refreshTracks]);

  const handleRemove = useCallback(async () => {
    if (!user || !activeWorkspace || !trackUuid || removing) return;
    setRemoving(true);
    try {
      // 1) Clear DB row first so even a partial R2 failure leaves no broken reference.
      const { error: rpcError } = await supabase.rpc("delete_track_video", {
        _user_id: user.id,
        _track_id: trackUuid,
        _workspace_id: activeWorkspace.id,
      });
      if (rpcError) {
        console.error("delete_track_video failed:", rpcError);
        toast.error(t("videoSection.failedRemove"));
        return;
      }

      // 2) Best-effort cleanup of the R2 object (orphan otherwise — non-fatal).
      if (videoUrl) {
        const { error: removeError } = await supabase.storage.from("documents").remove([videoUrl]);
        if (removeError) {
          console.warn("Could not remove video file from storage:", removeError.message);
        }
      }

      toast.success(t("videoSection.removed"));
      setConfirmDelete(false);
      await refreshTracks();
    } finally {
      setRemoving(false);
    }
  }, [user, activeWorkspace, trackUuid, videoUrl, removing, refreshTracks]);

  // Defensive: don't render the section if we have no track UUID yet.
  if (!trackUuid) return null;

  const hasVideo = !!videoUrl;

  return (
    <div className="card-premium p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-pink/15 flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-brand-pink" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("videoSection.title")}</h3>
            <p className="text-2xs text-muted-foreground">{t("videoSection.subtitle")}</p>
          </div>
        </div>
        {hasVideo && !readOnly && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={removing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label="Remove video"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("videoSection.remove")}
          </button>
        )}
      </div>

      {!hasVideo ? (
        readOnly ? (
          <p className="text-xs text-muted-foreground italic">{t("videoSection.noVideo")}</p>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={
              "rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer " +
              (isDragOver
                ? "border-brand-pink/60 bg-brand-pink/5"
                : "border-border hover:border-brand-pink/40 bg-secondary/30")
            }
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",") + "," + ACCEPTED_TYPES.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="w-6 h-6 text-brand-pink animate-spin mx-auto" />
                <p className="text-xs font-semibold text-foreground">{t("videoSection.uploading")}</p>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-brand-pink transition-all" style={{ width: progress + "%" }} />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold text-foreground">{t("videoSection.dropHere")}</p>
                <p className="text-2xs text-muted-foreground">{t("videoSection.formats")}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-orange to-brand-pink text-white"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t("videoSection.uploadButton")}
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {signing && !signedUrl ? (
            <div className="aspect-video w-full rounded-lg bg-secondary flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : signedUrl ? (
            <video
              src={signedUrl}
              controls
              preload="metadata"
              playsInline
              className="w-full rounded-lg bg-black"
            />
          ) : (
            <div className="aspect-video w-full rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground">
              {t("videoSection.loadError")}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground truncate min-w-0">
              {videoFilename || "video"}
            </p>
            {!readOnly && (
              <div className="inline-flex items-center gap-2 text-xs select-none">
                <span id="video-visibility-label" className="font-medium text-foreground">{t("videoSection.visibleOnShare")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={videoVisibleOnShare}
                  aria-labelledby="video-visibility-label"
                  disabled={savingVisibility}
                  onClick={handleToggleVisibility}
                  className={
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                    (videoVisibleOnShare ? "bg-brand-pink" : "bg-secondary border border-border") +
                    (savingVisibility ? " opacity-60 cursor-wait" : "")
                  }
                >
                  <span
                    aria-hidden="true"
                    className={
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform " +
                      (videoVisibleOnShare ? "translate-x-5" : "translate-x-1")
                    }
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("videoSection.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("videoSection.removeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{t("videoSection.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? t("videoSection.removing") : t("videoSection.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

