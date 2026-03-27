import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

type AccessLevel = "viewer" | "pitcher" | "editor" | "admin";

interface CatalogShare {
  id: string;
  target_workspace_id: string;
  access_level: AccessLevel;
  status: string;
}

const ACCESS_LEVELS: { value: AccessLevel; labelKey: string; descKey: string }[] = [
  { value: "viewer", labelKey: "catalogSharing.viewer", descKey: "catalogSharing.viewerDesc" },
  { value: "pitcher", labelKey: "catalogSharing.pitcher", descKey: "catalogSharing.pitcherDesc" },
  { value: "editor", labelKey: "catalogSharing.editor", descKey: "catalogSharing.editorDesc" },
  { value: "admin", labelKey: "catalogSharing.admin", descKey: "catalogSharing.adminDesc" },
];

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
  const [expandedWsId, setExpandedWsId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<AccessLevel>("pitcher");
  const [submitting, setSubmitting] = useState(false);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});

  var otherWorkspaces = workspaces.filter(function (ws) { return ws.id !== sourceWorkspaceId; });

  var fetchShares = useCallback(async function () {
    if (!open || !trackId) return;
    setLoading(true);
    var { data, error } = await supabase
      .from("catalog_shares")
      .select("id, target_workspace_id, access_level, status")
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
      access_level: selectedLevel,
    });

    if (error) {
      console.error("Error sharing track:", error);
      toast.error(t("catalogSharing.shareFailed"));
    } else {
      var ws = workspaces.find(function (w) { return w.id === targetWsId; });
      toast.success(t("catalogSharing.shareSuccess", { name: ws?.name || "" }));
      setExpandedWsId(null);
      setSelectedLevel("pitcher");
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
              var isExpanded = expandedWsId === ws.id;

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
                        <span className="text-2xs text-muted-foreground capitalize">{share.access_level}</span>
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
                        onClick={function () {
                          if (isExpanded) {
                            setExpandedWsId(null);
                          } else {
                            setExpandedWsId(ws.id);
                            setSelectedLevel("pitcher");
                          }
                        }}
                        className="text-sm font-semibold text-brand-orange hover:text-brand-pink transition-colors min-h-[44px] px-3"
                      >
                        {isExpanded ? t("catalogSharing.cancel") : t("catalogSharing.share")}
                      </button>
                    )}
                  </div>

                  {/* Access level picker */}
                  <AnimatePresence>
                    {isExpanded && !share && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 space-y-3">
                          <div className="flex flex-wrap gap-1.5">
                            {ACCESS_LEVELS.map(function (level) {
                              var isActive = selectedLevel === level.value;
                              return (
                                <button
                                  key={level.value}
                                  onClick={function () { setSelectedLevel(level.value); }}
                                  className={"px-3 py-1.5 rounded-full text-2xs font-semibold transition-all " + (
                                    isActive
                                      ? "bg-brand-orange/10 text-brand-orange ring-1 ring-brand-orange/30"
                                      : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {t(level.labelKey)}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-2xs text-muted-foreground">
                            {t(ACCESS_LEVELS.find(function (l) { return l.value === selectedLevel; })!.descKey)}
                          </p>
                          <button
                            onClick={function () { handleShare(ws.id); }}
                            disabled={submitting}
                            className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold w-full justify-center min-h-[44px]"
                          >
                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                            {t("catalogSharing.confirmShare")}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
