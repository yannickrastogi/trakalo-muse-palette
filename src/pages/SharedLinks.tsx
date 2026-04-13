import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Link2, Copy, Lock, Globe, Eye, EyeOff, BarChart3, ChevronDown, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useSharedLinks } from "@/contexts/SharedLinksContext";
import { useRole } from "@/contexts/RoleContext";
import { useTeams } from "@/contexts/TeamContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  expired: "bg-brand-orange/15 text-brand-orange",
  disabled: "bg-muted text-muted-foreground",
};

const shareTypeColors: Record<string, string> = {
  track: "bg-brand-orange/12 text-brand-orange",
  stems: "bg-brand-purple/12 text-brand-purple",
  pack: "bg-brand-pink/12 text-brand-pink",
  playlist: "bg-primary/12 text-primary",
};

const shareTypeOptions = ["All", "Track", "Stems", "Pack", "Playlist"];
const statusOptions = ["All", "Active", "Expired", "Disabled"];

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== "All";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={"flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap " + (isActive ? "border-2 border-brand-orange/40 text-brand-orange bg-card" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground bg-card")}
      >
        <span>{isActive ? value : label}</span>
        <ChevronDown className={"w-3 h-3 shrink-0 transition-transform duration-200 " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1.5 min-w-[140px] bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm"
          >
            <div className="p-1">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={"w-full text-left px-4 py-2 rounded-lg text-[13px] transition-colors " + (value === opt ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SharedLinks() {
  const { sharedLinks, updateLinkStatus } = useSharedLinks();
  const { permissions } = useRole();
  const { teams } = useTeams();
  const { activeWorkspace } = useWorkspace();
  const isMultiMember = (teams?.length > 0 && teams[0]?.members?.length > 1) || false;
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, string>>({});
  const [linkCreatedBy, setLinkCreatedBy] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [activityLinkId, setActivityLinkId] = useState<string | null>(null);
  const [shareTypeFilter, setShareTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Fetch created_by for shared links and resolve profile names
  useEffect(function () {
    if (!isMultiMember || !activeWorkspace) return;
    async function fetchCreatedBy() {
      var { data } = await supabase
        .from("shared_links")
        .select("id, created_by")
        .eq("workspace_id", activeWorkspace!.id);
      if (!data || data.length === 0) return;
      var byLink: Record<string, string | null> = {};
      var userIds: string[] = [];
      data.forEach(function (row) {
        byLink[row.id] = row.created_by || null;
        if (row.created_by && !userIds.includes(row.created_by)) userIds.push(row.created_by);
      });
      setLinkCreatedBy(byLink);
      if (userIds.length === 0) return;
      var { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (!profiles) return;
      var map: Record<string, string> = {};
      profiles.forEach(function (p) {
        if (p.full_name) map[p.id] = p.full_name;
      });
      setCreatorProfiles(map);
    }
    fetchCreatedBy();
  }, [isMultiMember, activeWorkspace, sharedLinks]);

  const getEffectiveStatus = (link: typeof sharedLinks[0]) => {
    if (link.status === "disabled") return "disabled";
    if (link.expirationDate && new Date(link.expirationDate) < new Date()) return "expired";
    return link.status;
  };

  const filtered = useMemo(() => {
    return sharedLinks.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!l.linkName.toLowerCase().includes(q) && !l.trackTitle.toLowerCase().includes(q)) return false;
      }
      if (shareTypeFilter !== "All" && (l.shareType || "stems").toLowerCase() !== shareTypeFilter.toLowerCase()) return false;
      if (statusFilter !== "All" && getEffectiveStatus(l) !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [sharedLinks, search, shareTypeFilter, statusFilter]);

  const formatDate = (iso: string) => {
    try { return format(new Date(iso), "MMM d, yyyy"); } catch { return "—"; }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(window.location.origin + "/share/" + slug);
    toast.success("Link copied!");
  };

  const totalViews = sharedLinks.reduce((s, l) => s + (l.views || 0), 0);
  const totalPlays = sharedLinks.reduce((s, l) => s + (l.plays || 0), 0);
  const totalDownloads = sharedLinks.reduce((s, l) => s + (l.downloadCount || 0), 0);
  const totalSaves = sharedLinks.reduce((s, l) => s + (l.saveCount || 0), 0);

  const activityLink = activityLinkId ? sharedLinks.find((l) => l.id === activityLinkId) : null;

  const getShareTypeLabel = (type: string) => type === "pack" ? "Trakalog Pack" : type || "stems";

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Shared Links</h1>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
              {sharedLinks.length} links
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
              {totalViews} views
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
              {totalPlays} plays
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
              {totalDownloads} downloads
            </span>
            {totalSaves > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                {totalSaves} saves
              </span>
            )}
          </div>
        </motion.div>

        {/* Search + Filters */}
        <motion.div variants={item} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2 border border-border/50 focus-brand transition-all flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by link name or track…"
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <FilterSelect label="Share Type" value={shareTypeFilter} options={shareTypeOptions} onChange={setShareTypeFilter} />
          <FilterSelect label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
        </motion.div>

        {/* Desktop Table */}
        <motion.div variants={item} className="card-premium overflow-hidden hidden md:block">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mb-4">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No shared links yet</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
                Create a share link from any track's Stems tab to start sharing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Link</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Share Type</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Link Type</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Engagement</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Created</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((link) => {
                    const status = getEffectiveStatus(link);
                    return (
                      <tr key={link.id} className="hover:bg-secondary/40 transition-colors">
                        {/* Link Name + Track title merged */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground text-sm leading-tight">{link.linkName}</div>
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {link.shareType === "playlist" ? link.playlistName : link.trackTitle}
                          </div>
                          {isMultiMember && linkCreatedBy[link.id] && creatorProfiles[linkCreatedBy[link.id]!] && (
                            <div className="text-[10px] text-muted-foreground/60 mt-0.5">Created by {creatorProfiles[linkCreatedBy[link.id]!]}</div>
                          )}
                        </td>
                        {/* Share Type */}
                        <td className="px-4 py-3.5">
                          <span className={"inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize " + (shareTypeColors[link.shareType || "stems"] || shareTypeColors.stems)}>
                            {getShareTypeLabel(link.shareType)}
                          </span>
                        </td>
                        {/* Link Type */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {link.linkType === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {link.linkType === "public" ? "Public" : "Secured"}
                          </span>
                        </td>
                        {/* Engagement compact */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {link.views || 0} views · {link.plays || 0} plays · {link.downloadCount || 0} dl{(link.saveCount || 0) > 0 ? " · " + link.saveCount + " saves" : ""}
                          </span>
                        </td>
                        {/* Created */}
                        <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{formatDate(link.createdAt)}</td>
                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={"inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize " + statusColors[status]}>
                            {status}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => copyLink(link.linkSlug || link.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copy Link">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {permissions.canCreateSharedLinks && (
                            <button
                              onClick={() => updateLinkStatus(link.id, status === "disabled" ? "active" : "disabled")}
                              className={"p-1.5 rounded-lg transition-colors " + (status === "disabled" ? "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
                              title={status === "disabled" ? "Enable link" : "Disable link"}
                            >
                              {status === "disabled" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            )}
                            <button
                              onClick={() => setActivityLinkId(link.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="View Activity"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <motion.div variants={item} className="card-premium">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mb-4">
                  <Link2 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">No shared links yet</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Create a share link from any track's Stems tab to start sharing.
                </p>
              </div>
            </motion.div>
          ) : (
            filtered.map((link) => {
              const status = getEffectiveStatus(link);
              return (
                <motion.div key={link.id} variants={item} className="card-premium p-4 space-y-3">
                  {/* Top: name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-sm leading-tight truncate">{link.linkName}</div>
                      <div className="text-muted-foreground text-xs mt-0.5 truncate">
                        {link.shareType === "playlist" ? link.playlistName : link.trackTitle}
                      </div>
                      {isMultiMember && linkCreatedBy[link.id] && creatorProfiles[linkCreatedBy[link.id]!] && (
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">Created by {creatorProfiles[linkCreatedBy[link.id]!]}</div>
                      )}
                    </div>
                    <span className={"inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize shrink-0 " + statusColors[status]}>
                      {status}
                    </span>
                  </div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize " + (shareTypeColors[link.shareType || "stems"] || shareTypeColors.stems)}>
                      {getShareTypeLabel(link.shareType)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      {link.linkType === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {link.linkType === "public" ? "Public" : "Secured"}
                    </span>
                  </div>
                  {/* Stats */}
                  <div className="text-xs text-muted-foreground">
                    {link.views || 0} views · {link.plays || 0} plays · {link.downloadCount || 0} dl{(link.saveCount || 0) > 0 ? " · " + link.saveCount + " saves" : ""}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                    <button onClick={() => copyLink(link.linkSlug || link.id)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copy Link">
                      <Copy className="w-4 h-4" />
                    </button>
                    {permissions.canCreateSharedLinks && (
                    <button
                      onClick={() => updateLinkStatus(link.id, status === "disabled" ? "active" : "disabled")}
                      className={"p-2 rounded-lg transition-colors " + (status === "disabled" ? "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
                      title={status === "disabled" ? "Enable link" : "Disable link"}
                    >
                      {status === "disabled" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    )}
                    <button
                      onClick={() => setActivityLinkId(link.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="View Activity"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Activity modal */}
      <AnimatePresence>
        {activityLink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setActivityLinkId(null)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="relative z-10 w-full md:max-w-lg bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95dvh]"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Link Activity</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{activityLink.linkName}</p>
                </div>
                <button onClick={() => setActivityLinkId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {activityLink.downloads.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No activity recorded yet</div>
                ) : (
                  <div className="divide-y divide-border">
                    {activityLink.downloads.map((dl) => (
                      <div key={dl.id} className="px-6 py-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{dl.downloaderName}</p>
                            <p className="text-[11px] text-muted-foreground">{dl.downloaderEmail} · {dl.organization} · {dl.role}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDate(dl.downloadedAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {dl.stemsDownloaded.length} stem{dl.stemsDownloaded.length !== 1 ? "s" : ""}: {dl.stemsDownloaded.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
