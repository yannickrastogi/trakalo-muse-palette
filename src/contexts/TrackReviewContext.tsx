import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

export type AuthorType = "owner" | "team_member" | "recipient" | "guest_recipient";
export type SourceContext = "internal_review" | "recipient_review" | "shared_link_review" | "pitching_feedback";

export interface TimecodedComment {
  id: string;
  trackId: string;
  authorUserId?: string;
  authorGuestId?: string;
  authorName: string;
  authorEmail?: string;
  authorType: AuthorType;
  commentText: string;
  timestampSeconds: number;
  timestampLabel: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isEdited: boolean;
  sourceContext: SourceContext;
  sharedLinkId?: string;
  sharedLinkName?: string;
  // future-ready
  parentId?: string;
  status?: "open" | "resolved" | "to_fix";
}

export interface CommentNotification {
  id: string;
  trackId: string;
  trackTitle: string;
  commentId: string;
  authorName: string;
  authorType: AuthorType;
  timestampLabel: string;
  commentPreview: string;
  createdAt: string;
  read: boolean;
}

type CommentFilter = "all" | "team" | "recipient" | "guest" | "mine";
type CommentSort = "timecode" | "latest";

interface TrackReviewContextValue {
  comments: TimecodedComment[];
  notifications: CommentNotification[];
  getCommentsForTrack: (trackId: string) => TimecodedComment[];
  addComment: (comment: Omit<TimecodedComment, "id" | "createdAt" | "updatedAt" | "isEdited">) => TimecodedComment;
  editComment: (commentId: string, newText: string) => void;
  deleteComment: (commentId: string) => void;
  getFilteredComments: (trackId: string, filter: CommentFilter, currentUserId: string, searchQuery?: string) => TimecodedComment[];
  getSortedComments: (comments: TimecodedComment[], sort: CommentSort) => TimecodedComment[];
  getCommentCountForTrack: (trackId: string) => number;
  markNotificationRead: (notificationId: string) => void;
  unreadNotificationCount: number;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Comments are stored in the tracks table's waveform_data jsonb column
// as { comments: TimecodedComment[] } until a dedicated comments table is created.

interface WaveformDataWithComments {
  comments?: TimecodedComment[];
  [key: string]: unknown;
}

const TrackReviewContext = createContext<TrackReviewContextValue | null>(null);

export function TrackReviewProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [comments, setComments] = useState<TimecodedComment[]>([]);
  const [notifications, setNotifications] = useState<CommentNotification[]>([]);
  const commentsRef = useRef<TimecodedComment[]>(comments);
  commentsRef.current = comments;

  // Load comments from waveform_data + track_comments table
  const fetchComments = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setComments([]);
      return;
    }

    const { data, error } = await supabase
      .from("tracks")
      .select("id, waveform_data")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching track comments:", error);
      setComments([]);
      return;
    }

    // 1. Comments from waveform_data (legacy) — tag each with the track UUID
    const allComments: TimecodedComment[] = [];
    for (const row of data || []) {
      const wd = row.waveform_data as WaveformDataWithComments | null;
      if (wd?.comments && Array.isArray(wd.comments)) {
        for (const c of wd.comments) {
          allComments.push({ ...c, trackId: row.id });
        }
      }
    }

    // 2. Comments from track_comments table
    const trackUuids = (data || []).map((r) => r.id);
    if (trackUuids.length > 0) {
      // Fetch comments via RPC (SECURITY DEFINER) to bypass RLS when auth.uid() is null
      const rpcResults = await Promise.all(
        trackUuids.map((uuid) => supabase.rpc("get_track_comments", { _track_id: uuid }))
      );

      for (const { data: dbComments } of rpcResults) {
        if (dbComments) {
          for (const c of dbComments as any[]) {
            // Skip if already exists (by id)
            if (allComments.some((existing) => existing.id === c.id)) continue;
            allComments.push({
              id: c.id,
              trackId: c.track_id,
              authorName: c.author_name,
              authorEmail: c.author_email || undefined,
              authorType: (c.author_type || "guest_recipient") as AuthorType,
              commentText: c.content,
              timestampSeconds: Number(c.timestamp_sec),
              timestampLabel: formatTimestamp(Number(c.timestamp_sec)),
              createdAt: c.created_at,
              updatedAt: c.created_at,
              isEdited: false,
              sourceContext: "shared_link_review" as SourceContext,
              sharedLinkId: c.shared_link_id || undefined,
              sharedLinkName: undefined,
            });
          }
        }
      }
    }

    // 3. Comments from shared tracks via catalog_shares
    try {
      const { data: shares, error: sharesError } = await supabase.rpc(
        "get_workspace_catalog_shares",
        { _workspace_id: activeWorkspace.id }
      );

      if (!sharesError && shares && shares.length > 0) {
        const sharedTrackIds: string[] = shares
          .map((s: any) => s.track_id)
          .filter((id: string) => id && !trackUuids.includes(id));

        if (sharedTrackIds.length > 0) {
          const sharedRpcResults = await Promise.all(
            sharedTrackIds.map((uuid) =>
              supabase.rpc("get_track_comments", { _track_id: uuid })
            )
          );

          for (const { data: dbComments } of sharedRpcResults) {
            if (dbComments) {
              for (const c of dbComments as any[]) {
                if (allComments.some((existing) => existing.id === c.id)) continue;
                allComments.push({
                  id: c.id,
                  trackId: c.track_id,
                  authorName: c.author_name,
                  authorEmail: c.author_email || undefined,
                  authorType: (c.author_type || "guest_recipient") as AuthorType,
                  commentText: c.content,
                  timestampSeconds: Number(c.timestamp_sec),
                  timestampLabel: formatTimestamp(Number(c.timestamp_sec)),
                  createdAt: c.created_at,
                  updatedAt: c.created_at,
                  isEdited: false,
                  sourceContext: "shared_link_review" as SourceContext,
                  sharedLinkId: c.shared_link_id || undefined,
                  sharedLinkName: undefined,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching shared track comments:", err);
    }

    setComments(allComments);
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Persist comments for a specific track back to waveform_data
  const persistCommentsForTrack = useCallback(async (trackUuid: string, trackComments: TimecodedComment[]) => {
    // Read current waveform_data to preserve other keys
    const { data: current } = await supabase
      .from("tracks")
      .select("waveform_data")
      .eq("id", trackUuid)
      .single();

    const raw = current?.waveform_data;
    // Preserve peaks array if waveform_data was stored as number[] (not an object)
    const existing: WaveformDataWithComments = Array.isArray(raw)
      ? { peaks: raw }
      : (raw as WaveformDataWithComments) || {};
    const updated = { ...existing, comments: trackComments };

    const { error } = await supabase
      .from("tracks")
      .update({ waveform_data: updated as unknown as Record<string, unknown> })
      .eq("id", trackUuid);

    if (error) {
      console.error("Error persisting comments:", error);
    }
  }, []);

  const getCommentsForTrack = useCallback((trackId: string) => {
    return comments.filter((c) => c.trackId === trackId && !c.deletedAt);
  }, [comments]);

  const addComment = useCallback((data: Omit<TimecodedComment, "id" | "createdAt" | "updatedAt" | "isEdited">) => {
    const now = new Date().toISOString();
    const newComment: TimecodedComment = {
      ...data,
      id: "rc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    };

    setComments((prev) => [...prev, newComment]);

    // Persist to waveform_data (legacy) — after state update, not inside the updater
    const allTrackComments = [...commentsRef.current.filter(function (c) { return c.trackId === data.trackId; }), newComment];
    persistCommentsForTrack(data.trackId, allTrackComments)
      .catch(function (err) { console.error("Error persisting to waveform_data:", err); });

    // Also persist to track_comments table via RPC (SECURITY DEFINER) to bypass RLS
    supabase.rpc("add_track_comment", {
      _track_id: data.trackId,
      _author_name: data.authorName,
      _author_email: data.authorEmail || null,
      _author_type: data.authorType,
      _timestamp_sec: data.timestampSeconds,
      _content: data.commentText,
    }).then(({ error: insertErr }) => {
      if (insertErr) console.error("Error inserting to track_comments:", insertErr);
    }).catch(function (err) { console.error("Error:", err); });

    // Generate notification for non-owner comments
    if (data.authorType !== "owner") {
      const notification: CommentNotification = {
        id: "cn-" + Date.now(),
        trackId: data.trackId,
        trackTitle: "",
        commentId: newComment.id,
        authorName: data.authorName,
        authorType: data.authorType,
        timestampLabel: data.timestampLabel,
        commentPreview: data.commentText.slice(0, 60) + (data.commentText.length > 60 ? "..." : ""),
        createdAt: now,
        read: false,
      };
      setNotifications((prev) => [...prev, notification]);
    }
    return newComment;
  }, [persistCommentsForTrack]);

  const editComment = useCallback((commentId: string, newText: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, commentText: newText, updatedAt: new Date().toISOString(), isEdited: true } : c
      )
    );

    // Persist to waveform_data (legacy) — outside the state updater
    const target = commentsRef.current.find((c) => c.id === commentId);
    if (target) {
      const updated = commentsRef.current.map((c) =>
        c.id === commentId ? { ...c, commentText: newText, updatedAt: new Date().toISOString(), isEdited: true } : c
      );
      persistCommentsForTrack(target.trackId, updated.filter((c) => c.trackId === target.trackId))
        .catch(function (err) { console.error("Error:", err); });
    }
  }, [persistCommentsForTrack]);

  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c
      )
    );

    // Persist to waveform_data (legacy) — outside the state updater
    const target = commentsRef.current.find((c) => c.id === commentId);
    if (target) {
      const updated = commentsRef.current.map((c) =>
        c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c
      );
      persistCommentsForTrack(target.trackId, updated.filter((c) => c.trackId === target.trackId))
        .catch(function (err) { console.error("Error:", err); });
    }

    // Also delete from track_comments table via RPC (SECURITY DEFINER) to bypass RLS
    supabase.rpc("delete_track_comment", { _comment_id: commentId })
      .then(({ error: delErr }) => {
        if (delErr) console.error("Error deleting from track_comments:", delErr);
      }).catch(function (err) { console.error("Error:", err); });
  }, [persistCommentsForTrack]);

  const getFilteredComments = useCallback(
    (trackId: string, filter: CommentFilter, currentUserId: string, searchQuery?: string) => {
      let result = comments.filter((c) => c.trackId === trackId && !c.deletedAt);
      switch (filter) {
        case "team": result = result.filter((c) => c.authorType === "owner" || c.authorType === "team_member"); break;
        case "recipient": result = result.filter((c) => c.authorType === "recipient"); break;
        case "guest": result = result.filter((c) => c.authorType === "guest_recipient"); break;
        case "mine": result = result.filter((c) => c.authorName === currentUserId); break;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter((c) => c.commentText.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q));
      }
      return result;
    },
    [comments]
  );

  const getSortedComments = useCallback((cmts: TimecodedComment[], sort: CommentSort) => {
    return [...cmts].sort((a, b) =>
      sort === "timecode" ? a.timestampSeconds - b.timestampSeconds : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, []);

  const getCommentCountForTrack = useCallback((trackId: string) => {
    return comments.filter((c) => c.trackId === trackId && !c.deletedAt).length;
  }, [comments]);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
  }, []);

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  return (
    <TrackReviewContext.Provider
      value={{
        comments, notifications, getCommentsForTrack, addComment, editComment, deleteComment,
        getFilteredComments, getSortedComments, getCommentCountForTrack, markNotificationRead, unreadNotificationCount,
      }}
    >
      {children}
    </TrackReviewContext.Provider>
  );
}

export function useTrackReview() {
  const ctx = useContext(TrackReviewContext);
  if (!ctx) throw new Error("useTrackReview must be used within TrackReviewProvider");
  return ctx;
}

export { formatTimestamp };
