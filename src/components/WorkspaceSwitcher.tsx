import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, Plus, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { useTranslation } from "react-i18next";

export function WorkspaceSwitcher({ collapsed, onSwitch }: { collapsed?: boolean; onSwitch?: () => void }) {
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [trackCounts, setTrackCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch track counts per workspace
  useEffect(() => {
    if (workspaces.length === 0) return;
    var ids = workspaces.map(function (w) { return w.id; });
    supabase
      .from("tracks")
      .select("workspace_id", { count: "exact", head: false })
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
    switchWorkspace(wsId);
    setOpen(false);
    if (onSwitch) onSwitch();
  }, [switchWorkspace, onSwitch]);

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
