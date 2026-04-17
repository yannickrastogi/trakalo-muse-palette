import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Clock, CheckCircle, CheckCircle2, XCircle, Send, Music, ListMusic, Link2,
  ChevronRight, Search, Filter, MoreHorizontal, ArrowLeft, User,
  FileText, AlertCircle, Package, MessageSquare, X, Eye,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useApprovals, type SendRecord, type SendStatus, type SendType } from "@/contexts/ApprovalContext";
import { useTeams } from "@/contexts/TeamContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const statusConfig: Record<SendStatus, { labelKey: string; color: string; icon: typeof Clock }> = {
  draft: { labelKey: "approvals.draft", color: "bg-muted-foreground/12 text-muted-foreground", icon: FileText },
  pending_approval: { labelKey: "approvals.pending", color: "bg-brand-orange/12 text-brand-orange", icon: Clock },
  approved: { labelKey: "approvals.approved", color: "bg-emerald-500/12 text-emerald-400", icon: CheckCircle2 },
  rejected: { labelKey: "approvals.rejected", color: "bg-destructive/12 text-destructive", icon: XCircle },
  sent: { labelKey: "approvals.sent", color: "bg-emerald-500/12 text-emerald-400", icon: Send },
  cancelled: { labelKey: "approvals.cancelled", color: "bg-muted-foreground/12 text-muted-foreground", icon: XCircle },
};

const sendTypeIcons: Record<SendType, typeof Music> = {
  track: Music,
  playlist: ListMusic,
  pitch: Send,
  share_link: Link2,
  recipient_send: Package,
  other: FileText,
};

const sendTypeLabelKeys: Record<SendType, string> = {
  track: "approvals.typeTrack",
  playlist: "approvals.typePlaylist",
  pitch: "approvals.typePitch",
  share_link: "approvals.typeShareLink",
  recipient_send: "approvals.typeRecipientSend",
  other: "approvals.typeOther",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type ViewFilter = "pending" | "all" | "approved" | "rejected" | "sent";

export default function ApprovalQueue() {
  const { t } = useTranslation();
  const { sends, approveSend, rejectSend, getAuditTrail } = useApprovals();
  const { teams } = useTeams();
  const [filter, setFilter] = useState<ViewFilter>("pending");
  const [search, setSearch] = useState("");
  const [selectedSend, setSelectedSend] = useState<SendRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const filteredSends = useMemo(() => {
    let list = sends;
    if (filter === "pending") list = list.filter(s => s.status === "pending_approval");
    else if (filter !== "all") list = list.filter(s => s.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.relatedEntityTitle.toLowerCase().includes(q) ||
        s.createdByName.toLowerCase().includes(q) ||
        s.recipients.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sends, filter, search]);

  const pendingCount = sends.filter(s => s.status === "pending_approval").length;

  const handleApprove = (send: SendRecord) => {
    approveSend(send.id, "You", internalNote || undefined);
    toast.success(`"${send.relatedEntityTitle}" approved and sent`);
    setSelectedSend(null);
    setInternalNote("");
  };

  const handleReject = (send: SendRecord) => {
    rejectSend(send.id, "You", rejectReason || undefined, internalNote || undefined);
    toast.success(`"${send.relatedEntityTitle}" rejected`);
    setSelectedSend(null);
    setRejectReason("");
    setInternalNote("");
    setShowRejectForm(false);
  };

  // ── Detail View ──
  if (selectedSend) {
    const audit = getAuditTrail(selectedSend.id);
    const cfg = statusConfig[selectedSend.status];
    const StatusIcon = cfg.icon;
    const TypeIcon = sendTypeIcons[selectedSend.sendType];
    const team = teams.find(t => t.id === selectedSend.teamId);

    return (
      <PageShell>
        <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[900px] space-y-6">
          <motion.div variants={item} className="flex items-center gap-3">
            <button onClick={() => { setSelectedSend(null); setShowRejectForm(false); setRejectReason(""); setInternalNote(""); }}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground tracking-tight truncate">{selectedSend.relatedEntityTitle}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t("approvals.requestDetails")}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.color}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {t(cfg.labelKey)}
            </span>
          </motion.div>

          {/* Details card */}
          <motion.div variants={item} className="card-premium p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.sendType")}</p>
                <div className="flex items-center gap-1.5">
                  <TypeIcon className="w-4 h-4 text-brand-orange" />
                  <span className="font-semibold text-foreground">{t(sendTypeLabelKeys[selectedSend.sendType])}</span>
                </div>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.team")}</p>
                <span className="font-semibold text-foreground">{team?.name || "—"}</span>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.createdBy")}</p>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{selectedSend.createdByName}</span>
                  <Badge variant="outline" className="text-2xs">{selectedSend.createdByRole}</Badge>
                </div>
              </div>
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.recipients")}</p>
                <span className="font-semibold text-foreground">{selectedSend.recipients}</span>
              </div>
              <div className="col-span-2">
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.created")}</p>
                <span className="text-foreground">{formatDate(selectedSend.createdAt)}</span>
              </div>
            </div>

            {selectedSend.message && (
              <div>
                <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{t("approvals.message")}</p>
                <p className="text-[13px] text-foreground/80 bg-secondary/50 rounded-lg p-3">{selectedSend.message}</p>
              </div>
            )}

            {selectedSend.rejectionReason && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">{t("approvals.rejectionReason")}</p>
                  <p className="text-xs text-foreground/70 mt-0.5">{selectedSend.rejectionReason}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Actions for pending */}
          {selectedSend.status === "pending_approval" && (
            <motion.div variants={item} className="space-y-3">
              {/* Internal Note */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("approvals.internalNote")}</label>
                <Textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder={t("approvals.internalNotePlaceholder")}
                  className="mt-1.5 min-h-[60px] bg-secondary/50 border-border text-sm"
                />
              </div>

              {showRejectForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <label className="text-xs font-semibold text-destructive uppercase tracking-wider">{t("approvals.rejectionReasonLabel")}</label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={t("approvals.rejectionPlaceholder")}
                    className="mt-1.5 min-h-[60px] bg-destructive/5 border-destructive/20 text-sm"
                  />
                </motion.div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleApprove(selectedSend)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-primary-foreground text-[13px] font-semibold transition-colors min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" /> {t("approvals.approveAndSend")}
                </button>
                {!showRejectForm ? (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-[13px] font-semibold transition-colors min-h-[44px]"
                  >
                    <XCircle className="w-4 h-4" /> {t("approvals.reject")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleReject(selectedSend)}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-[13px] font-semibold transition-colors min-h-[44px]"
                  >
                    <XCircle className="w-4 h-4" /> {t("approvals.confirmRejection")}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Audit Trail */}
          <motion.div variants={item} className="card-premium overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">{t("approvals.history")}</h3>
            </div>
            <div className="divide-y divide-border/40">
              {audit.map((event) => (
                <div key={event.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-orange/60 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">
                      <span className="font-semibold">{event.actorName}</span>
                      <span className="text-muted-foreground"> — {event.eventType.replace(/_/g, " ")}</span>
                    </p>
                    {event.note && <p className="text-xs text-muted-foreground mt-0.5">{event.note}</p>}
                    <p className="text-2xs text-muted-foreground/60 mt-0.5">{formatDate(event.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </PageShell>
    );
  }

  // ── Queue List View ──
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 max-w-[1200px] space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-orange" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("approvals.title")}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{t("approvals.subtitle")}</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <Badge className="self-start bg-brand-orange/15 text-brand-orange border-brand-orange/30 text-xs font-bold px-3 py-1.5">
              {pendingCount} pending
            </Badge>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border">
            {(["pending", "all", "approved", "rejected", "sent"] as ViewFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  filter === f
                    ? "bg-brand-orange text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {f === "pending" ? t("approvals.pendingCount", { count: pendingCount }) : t("approvals." + f)}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("approvals.searchPlaceholder")}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px]"
            />
          </div>
        </motion.div>

        {/* List */}
        {sends.length === 0 ? (
          <motion.div variants={item}>
            <EmptyState
              icon={CheckCircle}
              title="No pending approvals"
              description="When team members submit changes, they'll appear here for review."
            />
          </motion.div>
        ) : filteredSends.length === 0 ? (
          <motion.div variants={item} className="card-premium p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {filter === "pending" ? t("approvals.noPending") : t("approvals.noSends")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {filter === "pending" ? t("approvals.allReviewed") : t("approvals.adjustFilters")}
            </p>
          </motion.div>
        ) : (
          <motion.div variants={item} className="card-premium divide-y divide-border/40 overflow-hidden">
            {filteredSends.map((send) => {
              const cfg = statusConfig[send.status];
              const StatusIcon = cfg.icon;
              const TypeIcon = sendTypeIcons[send.sendType];
              const team = teams.find(t => t.id === send.teamId);
              return (
                <button
                  key={send.id}
                  onClick={() => setSelectedSend(send)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/20 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <TypeIcon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-foreground truncate">{send.relatedEntityTitle}</p>
                      <Badge variant="outline" className="text-2xs shrink-0 border-border">{t(sendTypeLabelKeys[send.sendType])}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-muted-foreground">{send.createdByName}</span>
                      <span className="text-muted-foreground/30">→</span>
                      <span className="text-2xs text-muted-foreground">{send.recipients}</span>
                      {team && <span className="text-2xs text-muted-foreground/50">· {team.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {t(cfg.labelKey)}
                    </span>
                    <span className="text-2xs text-muted-foreground hidden sm:block">{formatDate(send.createdAt)}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </PageShell>
  );
}
