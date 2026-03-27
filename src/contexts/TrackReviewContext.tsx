import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

export type AuthorType = "owner" | "team_member" | "recipient" | "guest_recipient";
export type SourceContext = "internal_review" | "recipient_review" | "shared_link_review" | "pitching_feedback";

export interface TimecodedComment {
  id: string;
  trackId: number;
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
  trackId: number;
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
  getCommentsForTrack: (trackId: number) => TimecodedComment[];
  addComment: (comment: Omit<TimecodedComment, "id" | "createdAt" | "updatedAt" | "isEdited">) => TimecodedComment;
  editComment: (commentId: string, newText: string) => void;
  deleteComment: (commentId: string) => void;
  getFilteredComments: (trackId: number, filter: CommentFilter, currentUserId: string, searchQuery?: string) => TimecodedComment[];
  getSortedComments: (comments: TimecodedComment[], sort: CommentSort) => TimecodedComment[];
  getCommentCountForTrack: (trackId: number) => number;
  markNotificationRead: (notificationId: string) => void;
  unreadNotificationCount: number;
  /** Maps track UUID to the numeric trackId used internally for comments */
  trackUuidToId: Record<string, number>;
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

  // Map track UUID → numeric trackId (index+1 based)
  const [trackUuidToId, setTrackUuidToId] = useState<Record<string, number>>({});
  const [trackIdToUuid, setTrackIdToUuid] = useState<Record<number, string>>({});

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

    // Build UUID <-> numeric ID maps
    const uuidToId: Record<string, number> = {};
    const idToUuid: Record<number, string> = {};
    (data || []).forEach((row, idx) => {
      const numericId = idx + 1;
      uuidToId[row.id] = numericId;
      idToUuid[numericId] = row.id;
    });
    setTrackUuidToId(uuidToId);
    setTrackIdToUuid(idToUuid);

    // 1. Comments from waveform_data (legacy)
    const allComments: TimecodedComment[] = [];
    for (const row of data || []) {
      const wd = row.waveform_data as WaveformDataWithComments | null;
      if (wd?.comments && Array.isArray(wd.comments)) {
        allComments.push(...wd.comments);
      }
    }

    // 2. Comments from track_comments table
    const trackUuids = (data || []).map((r) => r.id);
    if (trackUuids.length > 0) {
      const { data: dbComments } = await supabase
        .from("track_comments")
        .select("*, shared_links:shared_link_id(link_name, link_slug)")
        .in("track_id", trackUuids)
        .order("created_at", { ascending: true });

      if (dbComments) {
        for (const c of dbComments) {
          const numId = uuidToId[c.track_id];
          if (!numId) continue;
          // Skip if already exists (by id)
          if (allComments.some((existing) => existing.id === c.id)) continue;
          const linkInfo = c.shared_links as { link_name: string; link_slug: string } | null;
          allComments.push({
            id: c.id,
            trackId: numId,
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
            sharedLinkName: linkInfo ? (linkInfo.link_name || linkInfo.link_slug) : undefined,
          });
        }
      }
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

  // Map trackId (numeric) to track uuid for persistence
  const getTrackUuid = useCallback(async (trackId: number): Promise<string | null> => {
    if (!activeWorkspace) return null;

    const { data, error } = await supabase
      .from("tracks")
      .select("id")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error || !data) return null;

    // trackId is index+1 based (from TrackContext mapping)
    const idx = trackId - 1;
    return data[idx]?.id || null;
  }, [activeWorkspace]);

  const getCommentsForTrack = useCallback((trackId: number) => {
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

    setComments((prev) => {
      const updated = [...prev, newComment];

      // Persist to waveform_data (legacy)
      getTrackUuid(data.trackId).then((uuid) => {
        if (uuid) {
          const trackComments = updated.filter((c) => c.trackId === data.trackId);
          persistCommentsForTrack(uuid, trackComments);
        }
      }).catch(function (err) { console.error("Error:", err); });

      return updated;
    });

    // Also persist to track_comments table
    const trackUuid = trackIdToUuid[data.trackId];
    if (trackUuid) {
      supabase.from("track_comments").insert({
        track_id: trackUuid,
        author_name: data.authorName,
        author_email: data.authorEmail || null,
        author_type: data.authorType,
        timestamp_sec: data.timestampSeconds,
        content: data.commentText,
      }).then(({ error: insertErr }) => {
        if (insertErr) console.error("Error inserting to track_comments:", insertErr);
      }).catch(function (err) { console.error("Error:", err); });
    }

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
  }, [getTrackUuid, persistCommentsForTrack, trackIdToUuid]);

  const editComment = useCallback((commentId: string, newText: string) => {
    setComments((prev) => {
      const updated = prev.map((c) =>
        c.id === commentId ? { ...c, commentText: newText, updatedAt: new Date().toISOString(), isEdited: true } : c
      );

      const target = updated.find((c) => c.id === commentId);
      if (target) {
        getTrackUuid(target.trackId).then((uuid) => {
          if (uuid) {
            persistCommentsForTrack(uuid, updated.filter((c) => c.trackId === target.trackId));
          }
        }).catch(function (err) { console.error("Error:", err); });
      }

      return updated;
    });
  }, [getTrackUuid, persistCommentsForTrack]);

  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) => {
      const updated = prev.map((c) =>
        c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c
      );

      const target = updated.find((c) => c.id === commentId);
      if (target) {
        getTrackUuid(target.trackId).then((uuid) => {
          if (uuid) {
            persistCommentsForTrack(uuid, updated.filter((c) => c.trackId === target.trackId));
          }
        }).catch(function (err) { console.error("Error:", err); });
      }

      return updated;
    });

    // Also delete from track_comments table
    supabase.from("track_comments").delete().eq("id", commentId)
      .then(({ error: delErr }) => {
        if (delErr) console.error("Error deleting from track_comments:", delErr);
      }).catch(function (err) { console.error("Error:", err); });
  }, [getTrackUuid, persistCommentsForTrack]);

  const getFilteredComments = useCallback(
    (trackId: number, filter: CommentFilter, currentUserId: string, searchQuery?: string) => {
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

  const getCommentCountForTrack = useCallback((trackId: number) => {
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
        getFilteredComments, getSortedComments, getCommentCountForTrack, markNotificationRead, unreadNotificationCount, trackUuidToId,
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
