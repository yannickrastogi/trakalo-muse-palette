import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Clock, ArrowUpDown, MoreHorizontal,
  Edit3, Trash2, ChevronDown, ChevronRight
} from "lucide-react";
import { useTrackReview, type TimecodedComment, type AuthorType, formatTimestamp } from "@/contexts/TrackReviewContext";
import { TimecodedCommentComposer } from "./TimecodedCommentComposer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CommentSort = "timecode" | "latest";

const authorTypeBadgeClass: Record<AuthorType, string> = {
  owner: "bg-brand-orange/15 text-brand-orange",
  team_member: "bg-brand-purple/15 text-brand-purple",
  recipient: "bg-brand-pink/15 text-brand-pink",
  guest_recipient: "bg-brand-pink/15 text-brand-pink",
};

const authorTypeBadgeKey: Record<AuthorType, string> = {
  owner: "trackReview.owner",
  team_member: "trackReview.team",
  recipient: "trackReview.recipient",
  guest_recipient: "trackReview.guest",
};

interface TrackReviewPanelProps {
  trackId: number;
  currentUserName?: string;
  progress: number;
  onSeek: (seconds: number, totalDuration: number) => void;
  totalDurationSeconds: number;
  isPlaying?: boolean;
  filterAuthor?: string | null;
  filterSharedLink?: string | null;
}

interface CommentGroup {
  key: string;
  label: string;
  sublabel?: string;
  badgeType: AuthorType;
  comments: TimecodedComment[];
  latestDate: string;
}

export function TrackReviewPanel({
  trackId,
  currentUserName = "Kira Nomura",
  progress,
  onSeek,
  totalDurationSeconds,
  filterAuthor,
  filterSharedLink,
}: TrackReviewPanelProps) {
  const { t } = useTranslation();
  const { getCommentsForTrack, getSortedComments, editComment, deleteComment, addComment } = useTrackReview();
  const [sort, setSort] = useState<CommentSort>("timecode");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const allComments = useMemo(() => getCommentsForTrack(trackId), [trackId, getCommentsForTrack]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = allComments;
    if (filterAuthor) {
      result = result.filter((c) => c.authorName === filterAuthor);
    }
    if (filterSharedLink) {
      if (filterSharedLink === "__direct__") {
        result = result.filter((c) => !c.sharedLinkId);
      } else {
        result = result.filter((c) => c.sharedLinkId === filterSharedLink);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.commentText.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q));
    }
    return result;
  }, [allComments, filterAuthor, filterSharedLink, search]);

  const sorted = useMemo(() => getSortedComments(filtered, sort), [filtered, sort, getSortedComments]);

  // Group by shared link (for owner view), with "Direct comments" for non-link comments
  const commentGroups = useMemo(() => {
    const map = new Map<string, CommentGroup>();
    sorted.forEach((c) => {
      const key = c.sharedLinkId || "__direct__";
      const existing = map.get(key);
      if (existing) {
        existing.comments.push(c);
        if (c.createdAt > existing.latestDate) existing.latestDate = c.createdAt;
      } else {
        const isDirectComment = !c.sharedLinkId;
        map.set(key, {
          key,
          label: isDirectComment ? t("trackReview.directComments") : ("Shared Link: " + (c.sharedLinkName || c.sharedLinkId || "Unknown")),
          sublabel: isDirectComment ? undefined : c.sharedLinkName,
          badgeType: isDirectComment ? (c.authorType) : "guest_recipient",
          comments: [c],
          latestDate: c.createdAt,
        });
      }
    });

    // Direct/owner first, then shared links by most recent
    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      if (a.key === "__direct__") return -1;
      if (b.key === "__direct__") return 1;
      return new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime();
    });
    return groups;
  }, [sorted]);

  const handleSeek = useCallback(
    (seconds: number) => onSeek(seconds, totalDurationSeconds),
    [onSeek, totalDurationSeconds]
  );

  const handleEdit = (comment: TimecodedComment) => {
    setEditingId(comment.id);
    setEditText(comment.commentText);
    setOpenMenuId(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editText.trim()) {
      editComment(editingId, editText.trim());
      setEditingId(null);
      setEditText("");
    }
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteComment(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleAddComment = (text: string, timestampSeconds: number) => {
    addComment({
      trackId,
      authorName: currentUserName,
      authorType: "owner",
      commentText: text,
      timestampSeconds,
      timestampLabel: formatTimestamp(timestampSeconds),
      sourceContext: "internal_review",
    });
    setShowComposer(false);
  };

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const currentSeconds = (progress / 100) * totalDurationSeconds;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4.5 h-4.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{t("trackReview.title")}</h3>
            <span className="text-2xs text-muted-foreground font-medium">({sorted.length})</span>
          </div>
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand"
          >
            <MessageSquare className="w-3.5 h-3.5" /> {t("trackReview.addNote")}
          </button>
        </div>

        {/* Composer */}
        <AnimatePresence>
          {showComposer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="p-4">
                <TimecodedCommentComposer
                  currentSeconds={currentSeconds}
                  onSubmit={handleAddComment}
                  onCancel={() => setShowComposer(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("trackReview.searchPlaceholder")}
                className="w-full h-8 pl-9 pr-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-all"
              />
            </div>
            <button
              onClick={() => setSort(sort === "timecode" ? "latest" : "timecode")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-2xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
            >
              {sort === "timecode" ? <Clock className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
              {sort === "timecode" ? t("trackReview.byTime") : t("trackReview.latest")}
            </button>
          </div>
        </div>

        {/* Grouped comments */}
        <div className="max-h-[600px] overflow-y-auto">
          {commentGroups.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{t("trackReview.noComments")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("trackReview.noCommentsDesc")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {commentGroups.map((group) => {
                const badgeClass = authorTypeBadgeClass[group.badgeType];
                const badgeKey = authorTypeBadgeKey[group.badgeType];
                const isCollapsed = collapsedGroups.has(group.key);
                const dateStr = new Date(group.latestDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

                return (
                  <div key={group.key}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-semibold text-foreground">{group.label}</span>
                      <span className={"inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider " + badgeClass}>
                        {t(badgeKey)}
                      </span>
                      <span className="text-2xs text-muted-foreground">{group.comments.length === 1 ? t("trackReview.comments", { count: group.comments.length }) : t("trackReview.commentsPlural", { count: group.comments.length })}</span>
                      <span className="text-2xs text-muted-foreground/50 ml-auto">{dateStr}</span>
                    </button>

                    {/* Group comments */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-border/30">
                            {group.comments.map((comment) => {
                              const isOwn = comment.authorName === currentUserName;
                              const isEditing = editingId === comment.id;

                              return (
                                <div
                                  key={comment.id}
                                  className="px-5 pl-12 py-3 hover:bg-secondary/20 transition-colors group relative"
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Timecode */}
                                    <button
                                      onClick={() => handleSeek(comment.timestampSeconds)}
                                      className="shrink-0 px-2 py-1 rounded-md bg-secondary hover:bg-primary/15 text-xs font-mono font-bold text-primary hover:text-primary transition-colors mt-0.5"
                                      title="Jump to this moment"
                                    >
                                      {comment.timestampLabel}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-semibold text-foreground">{comment.authorName}</span>
                                        <span className={"inline-flex px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider " + authorTypeBadgeClass[comment.authorType]}>
                                          {t(authorTypeBadgeKey[comment.authorType])}
                                        </span>
                                        {comment.isEdited && (
                                          <span className="text-[9px] text-muted-foreground/60 italic">{t("trackReview.edited")}</span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground/50 ml-auto">
                                          {new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </span>
                                      </div>

                                      {isEditing ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full p-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[60px]"
                                            autoFocus
                                          />
                                          <div className="flex gap-2">
                                            <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand">{t("trackReview.save")}</button>
                                            <button
                                              onClick={() => { setEditingId(null); setEditText(""); }}
                                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
                                            >{t("trackReview.cancel")}</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-[13px] text-foreground/80 leading-relaxed">{comment.commentText}</p>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    {isOwn && !isEditing && (
                                      <div className="relative shrink-0">
                                        <button
                                          onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)}
                                          className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                        {openMenuId === comment.id && (
                                          <div className="absolute right-0 top-8 z-20 w-32 bg-popover border border-border rounded-lg shadow-lg py-1" style={{ boxShadow: "var(--shadow-elevated)" }}>
                                            <button
                                              onClick={() => handleEdit(comment)}
                                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                                            >
                                              <Edit3 className="w-3 h-3" /> {t("trackReview.edit")}
                                            </button>
                                            <button
                                              onClick={() => { setDeleteConfirmId(comment.id); setOpenMenuId(null); }}
                                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                              <Trash2 className="w-3 h-3" /> {t("trackReview.deleteBtn")}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trackReview.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("trackReview.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("trackReview.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("trackReview.deleteBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
