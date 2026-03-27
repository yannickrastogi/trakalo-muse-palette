import { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTrack } from "@/contexts/TrackContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CatalogShare {
  id: string;
  target_workspace_id: string;
  status: string;
}

function getInitials(name: string) {
  return name.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2);
}

interface Props {
  open: boolean;
  onClose: () => void;
  trackId: string;
  sourceWorkspaceId: string;
}

export function ShareToWorkspaceModal({ open, onClose, trackId, sourceWorkspaceId }: Props) {
  const { t } = useTranslation();
  const { workspaces } = useWorkspace();
  const { user } = useAuth();
  const { refreshTracks } = useTrack();
  const [existingShares, setExistingShares] = useState<CatalogShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});

  var otherWorkspaces = workspaces.filter(function (ws) { return ws.id !== sourceWorkspaceId; });

  var fetchShares = useCallback(async function () {
    if (!open || !trackId) return;
    setLoading(true);
    var { data, error } = await supabase
      .from("catalog_shares")
      .select("id, target_workspace_id, status")
      .eq("track_id", trackId)
      .eq("source_workspace_id", sourceWorkspaceId)
      .eq("status", "active");

    if (!error && data) {
      setExistingShares(data as CatalogShare[]);
    }
    setLoading(false);
  }, [open, trackId, sourceWorkspaceId]);

  useEffect(function () {
    fetchShares();
  }, [fetchShares]);

  // Fetch track counts for each workspace
  useEffect(function () {
    if (!open || otherWorkspaces.length === 0) return;
    var ids = otherWorkspaces.map(function (w) { return w.id; });
    supabase
      .from("tracks")
      .select("workspace_id")
      .in("workspace_id", ids)
      .then(function (res) {
        if (!res.data) return;
        var counts: Record<string, number> = {};
        for (var i = 0; i < res.data.length; i++) {
          var wsId = (res.data[i] as any).workspace_id;
          counts[wsId] = (counts[wsId] || 0) + 1;
        }
        setTrackCounts(counts);
      });
  }, [open, otherWorkspaces.length]);

  var handleShare = async function (targetWsId: string) {
    if (!user) return;
    setSubmitting(true);
    var { error } = await supabase.from("catalog_shares").insert({
      track_id: trackId,
      source_workspace_id: sourceWorkspaceId,
      target_workspace_id: targetWsId,
      shared_by: user.id,
      access_level: "pitcher",
    });

    if (error) {
      console.error("Error sharing track:", error);
      toast.error(t("catalogSharing.shareFailed"));
    } else {
      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.shareSuccess", { name: ws?.name || "" }));
      await fetchShares();
      await refreshTracks();
    }
    setSubmitting(false);
  };

  var handleRevoke = async function (shareId: string) {
    setSubmitting(true);
    var { error } = await supabase
      .from("catalog_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", shareId);

    if (error) {
      console.error("Error revoking share:", error);
      toast.error(t("catalogSharing.revokeFailed"));
    } else {
      toast.success(t("catalogSharing.revoked"));
      await fetchShares();
      await refreshTracks();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={function (o) { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-brand-orange" />
            {t("catalogSharing.title")}
          </DialogTitle>
          <DialogDescription>{t("catalogSharing.description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : otherWorkspaces.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {t("catalogSharing.noOtherWorkspaces")}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {otherWorkspaces.map(function (ws) {
              var share = existingShares.find(function (s) { return s.target_workspace_id === ws.id; });

              return (
                <div key={ws.id} className="card-premium p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    {/* Logo/initials */}
                    {ws.logo_url ? (
                      <img src={ws.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white">{getInitials(ws.name)}</span>
                      </div>
                    )}

                    {/* Name + track count */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{ws.name}</p>
                      <p className="text-[10px] text-muted-foreground">{trackCounts[ws.id] || 0} tracks</p>
                    </div>

                    {/* Action */}
                    {share ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/12 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> {t("catalogSharing.shared")}
                        </span>
                        <button
                          onClick={function () { handleRevoke(share.id); }}
                          disabled={submitting}
                          className="text-2xs text-destructive hover:text-destructive/80 font-semibold transition-colors min-h-[44px] px-2"
                        >
                          {t("catalogSharing.revoke")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={function () { handleShare(ws.id); }}
                        disabled={submitting}
                        className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold min-h-[44px]"
                      >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                        {t("catalogSharing.share")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
