import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Link2, Copy, Lock, Globe, Eye, EyeOff, Download, Calendar, MoreHorizontal, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useSharedLinks } from "@/contexts/SharedLinksContext";
import { format } from "date-fns";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  expired: "bg-brand-orange/15 text-brand-orange",
  disabled: "bg-muted text-muted-foreground",
};

export default function SharedLinks() {
  const { sharedLinks, updateLinkStatus } = useSharedLinks();
  const [search, setSearch] = useState("");
  const [activityLinkId, setActivityLinkId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return sharedLinks;
    const q = search.toLowerCase();
    return sharedLinks.filter(
      (l) => l.linkName.toLowerCase().includes(q) || l.trackTitle.toLowerCase().includes(q)
    );
  }, [sharedLinks, search]);

  const formatDate = (iso: string) => {
    try { return format(new Date(iso), "MMM d, yyyy"); } catch { return "—"; }
  };

  const getEffectiveStatus = (link: typeof sharedLinks[0]) => {
    if (link.status === "disabled") return "disabled";
    if (link.expirationDate && new Date(link.expirationDate) < new Date()) return "expired";
    return link.status;
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${id}`);
    toast.success("Link copied!");
  };

  const activityLink = activityLinkId ? sharedLinks.find((l) => l.id === activityLinkId) : null;

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        <motion.div variants={item}>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Shared Links</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {sharedLinks.length} links created · {sharedLinks.reduce((s, l) => s + (l.views || 0), 0)} views · {sharedLinks.reduce((s, l) => s + (l.plays || 0), 0)} plays · {sharedLinks.reduce((s, l) => s + (l.downloadCount || 0), 0)} downloads
          </p>
        </motion.div>

        {/* Search */}
        <motion.div variants={item} className="max-w-md">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 border border-border/50 focus-brand transition-all">
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
        </motion.div>

        {/* Table */}
        <motion.div variants={item} className="card-premium overflow-hidden">
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
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Link Name</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Track</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Share Type</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Link Type</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Views</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Plays</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Downloads</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Created</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Expires</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((link) => {
                    const status = getEffectiveStatus(link);
                    return (
                      <tr key={link.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-foreground text-xs">{link.linkName}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">
                          {link.shareType === "playlist" ? link.playlistName : link.trackTitle}
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            link.shareType === "track" ? "bg-brand-orange/12 text-brand-orange"
                            : link.shareType === "stems" ? "bg-brand-purple/12 text-brand-purple"
                            : link.shareType === "pack" ? "bg-brand-pink/12 text-brand-pink"
                            : "bg-primary/12 text-primary"
                          }`}>
                            {link.shareType === "pack" ? "Trakalog Pack" : link.shareType || "stems"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {link.linkType === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {link.linkType === "public" ? "Public" : "Secured"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs font-semibold text-foreground">{link.views || 0}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs font-semibold text-foreground">{link.plays || 0}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs font-semibold text-foreground">{link.downloadCount || 0}</span>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{formatDate(link.createdAt)}</td>
                        <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                          {link.expirationDate ? formatDate(link.expirationDate) : "Never"}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${statusColors[status]}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => copyLink(link.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Copy Link">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => updateLinkStatus(link.id, status === "disabled" ? "active" : "disabled")}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title={status === "disabled" ? "Enable" : "Disable"}
                            >
                              {status === "disabled" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setActivityLinkId(link.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="View Activity"
                            >
                              <Download className="w-3.5 h-3.5" />
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
      </motion.div>

      {/* Activity modal */}
      <AnimatePresence>
        {activityLink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setActivityLinkId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Download Activity</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{activityLink.linkName}</p>
                </div>
                <button onClick={() => setActivityLinkId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {activityLink.downloads.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No downloads yet</div>
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
