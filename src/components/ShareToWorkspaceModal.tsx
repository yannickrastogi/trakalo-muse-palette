import { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, CheckCircle2, Loader2, Library } from "lucide-react";
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
  track_id: string | null;
  status: string;
}

type ShareMode = "none" | "track" | "full_catalog";

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
  const [fullCatalogShares, setFullCatalogShares] = useState<CatalogShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const [individualShareCounts, setIndividualShareCounts] = useState<Record<string, number>>({});

  var otherWorkspaces = workspaces.filter(function (ws) { return ws.id !== sourceWorkspaceId; });

  var fetchShares = useCallback(async function () {
    if (!open) return;
    setLoading(true);

    // Fetch individual track shares and full catalog shares in parallel
    var [trackShareRes, fullShareRes, individualCountRes] = await Promise.all([
      trackId ? supabase
        .from("catalog_shares")
        .select("id, target_workspace_id, track_id, status")
        .eq("track_id", trackId)
        .eq("source_workspace_id", sourceWorkspaceId)
        .eq("status", "active") : Promise.resolve({ data: [], error: null }),
      supabase
        .from("catalog_shares")
        .select("id, target_workspace_id, track_id, status")
        .eq("source_workspace_id", sourceWorkspaceId)
        .eq("status", "active")
        .is("track_id", null),
      supabase
        .from("catalog_shares")
        .select("target_workspace_id")
        .eq("source_workspace_id", sourceWorkspaceId)
        .eq("status", "active")
        .not("track_id", "is", null),
    ]);

    if (!trackShareRes.error && trackShareRes.data) {
      setExistingShares(trackShareRes.data as CatalogShare[]);
    }
    if (!fullShareRes.error && fullShareRes.data) {
      setFullCatalogShares(fullShareRes.data as CatalogShare[]);
    }
    if (!individualCountRes.error && individualCountRes.data) {
      var counts: Record<string, number> = {};
      for (var i = 0; i < individualCountRes.data.length; i++) {
        var wsId = (individualCountRes.data[i] as any).target_workspace_id;
        counts[wsId] = (counts[wsId] || 0) + 1;
      }
      setIndividualShareCounts(counts);
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

  function getShareMode(wsId: string): ShareMode {
    var hasFullCatalog = fullCatalogShares.some(function (s) { return s.target_workspace_id === wsId; });
    if (hasFullCatalog) return "full_catalog";
    var hasTrackShare = existingShares.some(function (s) { return s.target_workspace_id === wsId; });
    if (hasTrackShare) return "track";
    return "none";
  }

  function getShareStatus(wsId: string): string {
    var hasFullCatalog = fullCatalogShares.some(function (s) { return s.target_workspace_id === wsId; });
    if (hasFullCatalog) return t("catalogSharing.fullCatalogShared");
    var indCount = individualShareCounts[wsId] || 0;
    if (indCount > 0) return t("catalogSharing.tracksSharedCount", { count: indCount });
    return t("catalogSharing.notShared");
  }

  var handleShare = async function (targetWsId: string) {
    if (!user || !trackId) return;
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

  var handleFullCatalogShare = async function (targetWsId: string) {
    if (!user) return;
    setSubmitting(true);

    // Insert full catalog share (track_id = NULL)
    var { error } = await supabase.from("catalog_shares").insert({
      track_id: null,
      source_workspace_id: sourceWorkspaceId,
      target_workspace_id: targetWsId,
      shared_by: user.id,
      access_level: "pitcher",
    } as any);

    if (error) {
      console.error("Error sharing full catalog:", error);
      toast.error(t("catalogSharing.shareFailed"));
    } else {
      // Remove individual shares to this workspace (now redundant)
      await supabase
        .from("catalog_shares")
        .update({ status: "revoked", revoked_at: new Date().toISOString() } as any)
        .eq("source_workspace_id", sourceWorkspaceId)
        .eq("target_workspace_id", targetWsId)
        .eq("status", "active")
        .not("track_id", "is", null);

      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.fullCatalogShareSuccess", { name: ws?.name || "" }));
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

  var handleRevokeFullCatalog = async function (targetWsId: string) {
    var share = fullCatalogShares.find(function (s) { return s.target_workspace_id === targetWsId; });
    if (!share) return;
    setSubmitting(true);
    var { error } = await supabase
      .from("catalog_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", share.id);

    if (error) {
      console.error("Error revoking full catalog share:", error);
      toast.error(t("catalogSharing.revokeFailed"));
    } else {
      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.fullCatalogRevoked", { name: ws?.name || "" }));
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
              var mode = getShareMode(ws.id);
              var statusText = getShareStatus(ws.id);
              var trackShare = existingShares.find(function (s) { return s.target_workspace_id === ws.id; });

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

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{ws.name}</p>
                      <p className="text-[10px] text-muted-foreground">{statusText}</p>
                    </div>
                  </div>

                  {/* Share mode pills */}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    {/* This track only */}
                    {mode === "track" && trackShare ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> {t("catalogSharing.thisTrackOnly")}
                        </span>
                        <button
                          onClick={function () { handleRevoke(trackShare.id); }}
                          disabled={submitting}
                          className="text-[11px] text-destructive hover:text-destructive/80 font-semibold transition-colors min-h-[44px] px-2"
                        >
                          {t("catalogSharing.revoke")}
                        </button>
                      </div>
                    ) : mode === "full_catalog" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-400">
                          <Library className="w-3 h-3" /> {t("catalogSharing.fullCatalog")}
                        </span>
                        <button
                          onClick={function () { handleRevokeFullCatalog(ws.id); }}
                          disabled={submitting}
                          className="text-[11px] text-destructive hover:text-destructive/80 font-semibold transition-colors min-h-[44px] px-2"
                        >
                          {t("catalogSharing.revoke")}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {trackId && (
                          <button
                            onClick={function () { handleShare(ws.id); }}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-card text-foreground hover:bg-secondary transition-all min-h-[44px]"
                          >
                            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                            {t("catalogSharing.thisTrackOnly")}
                          </button>
                        )}
                        <button
                          onClick={function () { handleFullCatalogShare(ws.id); }}
                          disabled={submitting}
                          className="btn-brand inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold min-h-[44px]"
                        >
                          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
                          {t("catalogSharing.fullCatalog")}
                        </button>
                      </div>
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
