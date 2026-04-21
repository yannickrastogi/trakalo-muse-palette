import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid, Plus, MoreHorizontal, Trash2, ArrowRightLeft, Settings,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
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

interface WorkspaceStats {
  trackCount: number;
  memberCount: number;
  pitchCount: number;
  members: { id: string; firstName: string; lastName: string }[];
  sharedCatalogs: number;
  sharedTracks: number;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

function getInitials(name: string) {
  return name.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2);
}

function getMemberInitials(first: string, last: string) {
  return ((first[0] || "") + (last[0] || "")).toUpperCase() || "?";
}

function formatDate(dateStr: string) {
  var d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Workspaces() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeWorkspace, workspaces, switchWorkspace, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, WorkspaceStats>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchStats = useCallback(async function () {
    if (workspaces.length === 0) return;
    var ids = workspaces.map(function (w) { return w.id; });

    // Fetch track counts
    var trackRes = await supabase
      .from("tracks")
      .select("workspace_id")
      .in("workspace_id", ids);

    // Fetch member counts + first 5 members per workspace
    var memberRes = await supabase
      .from("workspace_members")
      .select("workspace_id, user_id, profiles:user_id(first_name, last_name)")
      .in("workspace_id", ids);

    // Fetch pitch counts (if pitches table has workspace_id)
    var pitchRes = await supabase
      .from("pitches")
      .select("workspace_id")
      .in("workspace_id", ids);

    // Fetch catalog shares TO each workspace
    var sharesRes = await supabase
      .from("catalog_shares")
      .select("target_workspace_id, track_id")
      .in("target_workspace_id", ids)
      .eq("status", "active");

    var newStats: Record<string, WorkspaceStats> = {};

    for (var i = 0; i < ids.length; i++) {
      var wsId = ids[i];
      var trackCount = 0;
      var memberCount = 0;
      var pitchCount = 0;
      var sharedCatalogs = 0;
      var sharedTracks = 0;
      var members: { id: string; firstName: string; lastName: string }[] = [];

      if (trackRes.data) {
        trackCount = trackRes.data.filter(function (r: any) { return r.workspace_id === wsId; }).length;
      }

      if (memberRes.data) {
        var wsMembers = memberRes.data.filter(function (r: any) { return r.workspace_id === wsId; });
        memberCount = wsMembers.length;
        members = wsMembers.slice(0, 5).map(function (r: any) {
          var profile = r.profiles;
          return {
            id: r.user_id,
            firstName: profile?.first_name || "",
            lastName: profile?.last_name || "",
          };
        });
      }

      if (pitchRes.data) {
        pitchCount = pitchRes.data.filter(function (r: any) { return r.workspace_id === wsId; }).length;
      }

      if (sharesRes.data) {
        var wsShares = sharesRes.data.filter(function (r: any) { return r.target_workspace_id === wsId; });
        for (var j = 0; j < wsShares.length; j++) {
          if ((wsShares[j] as any).track_id === null) {
            sharedCatalogs += 1;
          } else {
            sharedTracks += 1;
          }
        }
      }

      newStats[wsId] = { trackCount: trackCount, memberCount: memberCount, pitchCount: pitchCount, members: members, sharedCatalogs: sharedCatalogs, sharedTracks: sharedTracks };
    }

    setStats(newStats);
  }, [workspaces]);

  useEffect(function () {
    fetchStats();
  }, [fetchStats]);

  // Close menu on outside click
  useEffect(function () {
    if (!menuOpenId) return;
    function handleClick() { setMenuOpenId(null); }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [menuOpenId]);

  var handleSwitch = function (wsId: string, wsName: string) {
    switchWorkspace(wsId);
    toast.success(t("workspaces.switched", { name: wsName }));
    navigate("/dashboard");
  };

  var handleDelete = async function () {
    if (!deleteId) return;
    if (deleteId === activeWorkspace.id) {
      toast.error(t("workspaces.cannotDeleteActive"));
      setDeleteId(null);
      return;
    }
    if (workspaces.length <= 1) {
      toast.error(t("workspaces.cannotDeleteLast"));
      setDeleteId(null);
      return;
    }

    var { error } = await supabase.rpc("delete_workspace", { _user_id: user?.id || null, _workspace_id: deleteId });
    if (error) {
      toast.error("Failed to delete workspace");
      console.error(error);
    } else {
      toast.success(t("workspaces.deleted"));
      await refreshWorkspaces();
    }
    setDeleteId(null);
  };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {t("workspaces.title")}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                {t("workspaces.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={function () { setCreateOpen(true); }}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" /> {t("workspaces.createWorkspace")}
          </button>
        </motion.div>

        {/* Single workspace empty state */}
        {workspaces.length <= 1 && (
          <motion.div variants={item} className="card-premium p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center">
              <LayoutGrid className="w-7 h-7 text-primary-foreground" />
            </div>
            <p className="text-muted-foreground text-sm max-w-md">
              {t("workspaces.singleWorkspace")}
            </p>
            <button
              onClick={function () { setCreateOpen(true); }}
              className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold min-h-[44px] mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> {t("workspaces.createWorkspace")}
            </button>
          </motion.div>
        )}

        {/* Workspace cards grid */}
        <motion.div variants={item} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map(function (ws) {
            var isActive = ws.id === activeWorkspace.id;
            var s = stats[ws.id] || { trackCount: 0, memberCount: 0, pitchCount: 0, members: [], sharedCatalogs: 0, sharedTracks: 0 };

            return (
              <div
                key={ws.id}
                className="card-premium p-5 hover:ring-1 hover:ring-brand-orange/30 cursor-pointer transition-all relative group"
                onClick={function () { handleSwitch(ws.id, ws.name); }}
              >
                {/* Top row: logo + active badge + menu */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {ws.logo_url ? (
                      <img src={ws.logo_url} alt="" className="w-11 h-11 rounded-xl object-contain shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{getInitials(ws.name)}</span>
                      </div>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-500/12 text-emerald-400">
                        {t("workspaces.active")}
                      </span>
                    )}
                  </div>

                  {/* 3 dot menu */}
                  <div className="relative" onClick={function (e) { e.stopPropagation(); }}>
                    <button
                      onClick={function () { setMenuOpenId(menuOpenId === ws.id ? null : ws.id); }}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {menuOpenId === ws.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl min-w-[180px] py-1">
                        <button
                          onClick={function () { setMenuOpenId(null); handleSwitch(ws.id, ws.name); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" /> {t("workspaces.switchTo")}
                        </button>
                        <button
                          onClick={function () {
                            setMenuOpenId(null);
                            switchWorkspace(ws.id);
                            navigate("/settings");
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" /> {t("workspaces.edit")}
                        </button>
                        {!isActive && workspaces.length > 1 && (
                          <>
                            <div className="h-px bg-border mx-2 my-1" />
                            <button
                              onClick={function () { setMenuOpenId(null); setDeleteId(ws.id); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {t("workspaces.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Workspace name */}
                <h3 className="text-[15px] font-bold text-foreground mt-3 group-hover:text-brand-orange transition-colors truncate">
                  {ws.name}
                </h3>

                {/* Stats */}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {s.trackCount + " tracks · " + s.memberCount + " members" + (s.pitchCount > 0 ? " · " + s.pitchCount + " pitches" : "")}
                </p>
                {(s.sharedCatalogs > 0 || s.sharedTracks > 0) && (
                  <p className="text-[10px] text-brand-purple mt-0.5 flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" />
                    {s.sharedCatalogs > 0
                      ? s.sharedCatalogs + " " + t("workspaces.sharedCatalogs")
                      : s.sharedTracks + " " + t("workspaces.sharedTracks")}
                  </p>
                )}

                {/* Member avatars */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex -space-x-2">
                    {s.members.slice(0, 5).map(function (m) {
                      return (
                        <Avatar key={m.id} className="w-7 h-7 border-2 border-card">
                          <AvatarFallback className="bg-gradient-to-br from-brand-orange to-brand-pink text-primary-foreground text-[9px] font-bold">
                            {getMemberInitials(m.firstName, m.lastName)}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })}
                    {s.memberCount > 5 && (
                      <Avatar className="w-7 h-7 border-2 border-card">
                        <AvatarFallback className="bg-secondary text-muted-foreground text-[9px] font-bold">
                          +{s.memberCount - 5}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>

                {/* Created date */}
                <p className="text-2xs text-muted-foreground mt-3">
                  {t("workspaces.created", { date: formatDate(ws.created_at) })}
                </p>
              </div>
            );
          })}
        </motion.div>
      </motion.div>

      <CreateWorkspaceModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={function (open) { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workspaces.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("workspaces.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("workspaces.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
