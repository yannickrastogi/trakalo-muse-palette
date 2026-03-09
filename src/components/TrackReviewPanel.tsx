import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Clock, ArrowUpDown, MoreHorizontal,
  Edit3, Trash2, Filter, User, Users, Globe, Crown
} from "lucide-react";
import { useTrackReview, type TimecodedComment, type AuthorType, formatTimestamp } from "@/contexts/TrackReviewContext";
import { TimecodedCommentComposer } from "./TimecodedCommentComposer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type CommentFilter = "all" | "team" | "recipient" | "guest" | "mine";
type CommentSort = "timecode" | "latest";

const filterOptions: { value: CommentFilter; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All", icon: MessageSquare },
  { value: "team", label: "Team", icon: Users },
  { value: "recipient", label: "Recipient", icon: User },
  { value: "guest", label: "Guest", icon: Globe },
  { value: "mine", label: "Mine", icon: Crown },
];

const authorTypeBadge: Record<AuthorType, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-brand-orange/15 text-brand-orange" },
  team_member: { label: "Team", className: "bg-brand-purple/15 text-brand-purple" },
  recipient: { label: "Recipient", className: "bg-primary/15 text-primary" },
  guest_recipient: { label: "Guest", className: "bg-muted text-muted-foreground" },
};

interface TrackReviewPanelProps {
  trackId: number;
  currentUserName?: string;
  progress: number;
  onSeek: (seconds: number, totalDuration: number) => void;
  totalDurationSeconds: number;
  isPlaying?: boolean;
}

export function TrackReviewPanel({
  trackId,
  currentUserName = "Kira Nomura",
  progress,
  onSeek,
  totalDurationSeconds,
  isPlaying = false,
}: TrackReviewPanelProps) {
  const { getFilteredComments, getSortedComments, editComment, deleteComment, addComment } = useTrackReview();
  const [filter, setFilter] = useState<CommentFilter>("all");
  const [sort, setSort] = useState<CommentSort>("timecode");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = useMemo(
    () => getFilteredComments(trackId, filter, currentUserName, search),
    [trackId, filter, currentUserName, search, getFilteredComments]
  );
  const sorted = useMemo(() => getSortedComments(filtered, sort), [filtered, sort, getSortedComments]);

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

  const currentSeconds = (progress / 100) * totalDurationSeconds;

  const emptyMessages: Record<CommentFilter, { title: string; subtitle: string }> = {
    all: { title: "No comments yet", subtitle: "Click the waveform or use the button below to leave a note" },
    team: { title: "No team notes yet", subtitle: "Team members haven't left any notes on this track" },
    recipient: { title: "No recipient feedback yet", subtitle: "Recipients will be able to leave timecoded comments" },
    guest: { title: "No guest comments", subtitle: "No guest feedback has been received" },
    mine: { title: "No comments from you", subtitle: "Click the waveform to leave your first note" },
  };

  return (
    <div className="space-y-4">
      {/* Header & controls */}
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4.5 h-4.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Track Review</h3>
            <span className="text-2xs text-muted-foreground font-medium">({sorted.length})</span>
          </div>
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Add Note
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

        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-2xs font-semibold transition-all border ${
                  filter === opt.value
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <opt.icon className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setSort(sort === "timecode" ? "latest" : "timecode")}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-2xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {sort === "timecode" ? <Clock className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
              {sort === "timecode" ? "By time" : "Latest"}
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search comments or authors…"
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/30 transition-all"
            />
          </div>
        </div>

        {/* Comments list */}
        <div className="max-h-[500px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{emptyMessages[filter].title}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{emptyMessages[filter].subtitle}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sorted.map((comment) => {
                const badge = authorTypeBadge[comment.authorType];
                const isOwn = comment.authorName === currentUserName;
                const isEditing = editingId === comment.id;

                return (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 py-3.5 hover:bg-secondary/20 transition-colors group relative"
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
                        {/* Author line */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-foreground">{comment.authorName}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${badge.className}`}>
                            {badge.label}
                          </span>
                          {comment.isEdited && (
                            <span className="text-[9px] text-muted-foreground/60 italic">Edited</span>
                          )}
                          <span className="text-[10px] text-muted-foreground/50 ml-auto">
                            {new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>

                        {/* Comment text or edit mode */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand">
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditText(""); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[13px] text-foreground/80 leading-relaxed">{comment.commentText}</p>
                        )}
                      </div>

                      {/* Actions menu */}
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
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => { setDeleteConfirmId(comment.id); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
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
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
