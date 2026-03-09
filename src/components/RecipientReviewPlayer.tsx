import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Clock, Edit3, Trash2, MoreHorizontal, X
} from "lucide-react";
import { useTrackReview, type TimecodedComment, formatTimestamp } from "@/contexts/TrackReviewContext";
import { TimecodedCommentComposer } from "./TimecodedCommentComposer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecipientReviewPlayerProps {
  trackId: number;
  recipientName: string;
  recipientEmail?: string;
  progress: number;
  totalDurationSeconds: number;
  onSeek: (seconds: number, totalDuration: number) => void;
}

export function RecipientReviewPlayer({
  trackId,
  recipientName,
  recipientEmail,
  progress,
  totalDurationSeconds,
  onSeek,
}: RecipientReviewPlayerProps) {
  const { getCommentsForTrack, addComment, editComment, deleteComment } = useTrackReview();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTimestamp, setComposerTimestamp] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const allComments = useMemo(
    () => getCommentsForTrack(trackId).filter((c) => c.authorName === recipientName).sort((a, b) => a.timestampSeconds - b.timestampSeconds),
    [getCommentsForTrack, trackId, recipientName]
  );

  const currentSeconds = (progress / 100) * totalDurationSeconds;

  const handleOpenComposer = useCallback((atSeconds?: number) => {
    setComposerTimestamp(atSeconds ?? currentSeconds);
    setComposerOpen(true);
  }, [currentSeconds]);

  const handleSubmit = (text: string, timestampSeconds: number) => {
    addComment({
      trackId,
      authorName: recipientName,
      authorEmail: recipientEmail,
      authorType: "recipient",
      commentText: text,
      timestampSeconds,
      timestampLabel: formatTimestamp(timestampSeconds),
      sourceContext: "recipient_review",
    });
    setComposerOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      deleteComment(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-3 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your Feedback</h3>
          {allComments.length > 0 && (
            <span className="text-2xs text-muted-foreground">({allComments.length})</span>
          )}
        </div>
        <button
          onClick={() => handleOpenComposer()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-brand"
        >
          <MessageSquare className="w-3 h-3" /> Add Comment
        </button>
      </div>

      {/* Composer */}
      <AnimatePresence>
        {composerOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <TimecodedCommentComposer
              currentSeconds={currentSeconds}
              initialTimestamp={composerTimestamp}
              onSubmit={handleSubmit}
              onCancel={() => setComposerOpen(false)}
              compact
              placeholder="Share your feedback on this moment…"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments */}
      {allComments.length === 0 && !composerOpen ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No feedback yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click the waveform or use the button above to leave timecoded feedback</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/50" style={{ boxShadow: "var(--shadow-card)" }}>
          {allComments.map((comment) => {
            const isEditing = editingId === comment.id;
            return (
              <div key={comment.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors group">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onSeek(comment.timestampSeconds, totalDurationSeconds)}
                    className="shrink-0 px-2 py-1 rounded-md bg-secondary hover:bg-primary/15 text-xs font-mono font-bold text-primary transition-colors mt-0.5"
                  >
                    {comment.timestampLabel}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full p-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/30 resize-none min-h-[50px]"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={() => { editComment(comment.id, editText.trim()); setEditingId(null); }} className="px-3 py-1 rounded-lg text-xs font-semibold btn-brand">Save</button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] text-foreground/80 leading-relaxed">{comment.commentText}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {comment.isEdited && <span className="text-[9px] text-muted-foreground/40 italic">Edited</span>}
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === comment.id ? null : comment.id)}
                        className="p-1 rounded-lg text-muted-foreground/30 hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === comment.id && (
                        <div className="absolute right-0 top-7 z-20 w-28 bg-popover border border-border rounded-lg shadow-lg py-1" style={{ boxShadow: "var(--shadow-elevated)" }}>
                          <button onClick={() => { setEditingId(comment.id); setEditText(comment.commentText); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => { setDeleteConfirmId(comment.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete
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
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
