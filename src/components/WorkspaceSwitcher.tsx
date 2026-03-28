import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, Plus, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { useTranslation } from "react-i18next";

export function WorkspaceSwitcher({ collapsed, onSwitch }: { collapsed?: boolean; onSwitch?: () => void }) {
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { pause } = useAudioPlayer();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch accurate track counts per workspace (own + individual shares + full catalog shares resolved to actual tracks)
  useEffect(() => {
    if (workspaces.length === 0) return;
    var ids = workspaces.map(function (w) { return w.id; });

    Promise.all([
      // All tracks from user's workspaces
      supabase
        .from("tracks")
        .select("id, workspace_id")
        .in("workspace_id", ids),
      // All active catalog_shares targeting user's workspaces
      supabase
        .from("catalog_shares")
        .select("target_workspace_id, track_id, source_workspace_id")
        .in("target_workspace_id", ids)
        .eq("status", "active"),
    ]).then(async function (results) {
      var tracksData = results[0].data || [];
      var sharesData = results[1].data || [];

      // Build a Set of track IDs per workspace (for dedup)
      var trackSets: Record<string, Set<string>> = {};
      for (var k = 0; k < ids.length; k++) {
        trackSets[ids[k]] = new Set();
      }

      // Index tracks by workspace for full catalog resolution
      var trackIdsBySourceWs: Record<string, string[]> = {};
      for (var i = 0; i < tracksData.length; i++) {
        var row = tracksData[i] as any;
        // Own tracks
        if (trackSets[row.workspace_id]) {
          trackSets[row.workspace_id].add(row.id);
        }
        if (!trackIdsBySourceWs[row.workspace_id]) trackIdsBySourceWs[row.workspace_id] = [];
        trackIdsBySourceWs[row.workspace_id].push(row.id);
      }

      // Separate individual shares and full catalog shares
      var fullCatalogShares: { target_workspace_id: string; source_workspace_id: string }[] = [];
      for (var j = 0; j < sharesData.length; j++) {
        var share = sharesData[j] as any;
        if (share.track_id) {
          // Individual share — add track ID directly
          if (trackSets[share.target_workspace_id]) {
            trackSets[share.target_workspace_id].add(share.track_id);
          }
        } else {
          fullCatalogShares.push({ target_workspace_id: share.target_workspace_id, source_workspace_id: share.source_workspace_id });
        }
      }

      // For full catalog shares, resolve source tracks
      // Some sources may be external (not in user's workspaces) — fetch those
      var externalSourceIds: string[] = [];
      for (var f = 0; f < fullCatalogShares.length; f++) {
        var srcId = fullCatalogShares[f].source_workspace_id;
        if (!trackIdsBySourceWs[srcId] && externalSourceIds.indexOf(srcId) === -1) {
          externalSourceIds.push(srcId);
        }
      }

      if (externalSourceIds.length > 0) {
        var extRes = await supabase
          .from("tracks")
          .select("id, workspace_id")
          .in("workspace_id", externalSourceIds);
        if (extRes.data) {
          for (var e = 0; e < extRes.data.length; e++) {
            var extRow = extRes.data[e] as any;
            if (!trackIdsBySourceWs[extRow.workspace_id]) trackIdsBySourceWs[extRow.workspace_id] = [];
            trackIdsBySourceWs[extRow.workspace_id].push(extRow.id);
          }
        }
      }

      // Add full catalog source tracks to target sets
      for (var fc = 0; fc < fullCatalogShares.length; fc++) {
        var fcs = fullCatalogShares[fc];
        var sourceTracks = trackIdsBySourceWs[fcs.source_workspace_id] || [];
        var targetSet = trackSets[fcs.target_workspace_id];
        if (targetSet) {
          for (var t = 0; t < sourceTracks.length; t++) {
            targetSet.add(sourceTracks[t]);
          }
        }
      }

      var counts: Record<string, number> = {};
      for (var c = 0; c < ids.length; c++) {
        counts[ids[c]] = trackSets[ids[c]].size;
      }
      setTrackCounts(counts);
    });
  }, [workspaces]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [open]);

  const handleSwitch = useCallback(function (wsId: string) {
    pause();
    switchWorkspace(wsId);
    navigate("/dashboard");
    setOpen(false);
    if (onSwitch) onSwitch();
  }, [switchWorkspace, pause, navigate, onSwitch]);

  function getInitials(name: string) {
    return name.split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
  }

  // Collapsed mode: show only logo/initials
  if (collapsed) {
    return (
      <div className="mx-auto mb-3 flex justify-center">
        {activeWorkspace.logo_url ? (
          <img src={activeWorkspace.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{getInitials(activeWorkspace.name)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-3 mb-3 relative">
      {/* Active workspace block */}
      <button
        onClick={function () { setOpen(!open); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
      >
        {activeWorkspace.logo_url ? (
          <img src={activeWorkspace.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white">{getInitials(activeWorkspace.name)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-foreground truncate">{activeWorkspace.name}</div>
          <div className="text-[10px] text-muted-foreground">{trackCounts[activeWorkspace.id] || 0} tracks</div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl max-h-80 overflow-y-auto"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 pt-3 pb-1">
              Workspaces
            </div>

            {workspaces.map(function (ws) {
              var isActive = ws.id === activeWorkspace.id;
              return (
                <button
                  key={ws.id}
                  onClick={function () { handleSwitch(ws.id); }}
                  className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors " + (isActive ? "bg-brand-orange/5" : "hover:bg-secondary/50")}
                >
                  {ws.logo_url ? (
                    <img src={ws.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white">{getInitials(ws.name)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-foreground truncate">{ws.name}</div>
                    <div className="text-[10px] text-muted-foreground">{trackCounts[ws.id] || 0} tracks</div>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0" />}
                </button>
              );
            })}

            <div className="h-px bg-border mx-3 my-1.5" />

            <button
              onClick={function () { setOpen(false); navigate("/workspaces"); if (onSwitch) onSwitch(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{t("workspaces.manageWorkspaces")}</span>
            </button>

            <button
              onClick={function () { setOpen(false); setCreateOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Create New Workspace</span>
            </button>

            <div className="h-1.5" />
          </motion.div>
        )}
      </AnimatePresence>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
