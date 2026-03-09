import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Demo data
const demoComments: TimecodedComment[] = [
  {
    id: "rc-1", trackId: 1, authorName: "Jamie Lin", authorEmail: "jamie@atlantic.com",
    authorType: "recipient", commentText: "This vocal layering is incredible. The harmony at this section gives me chills. Perfect for the sync opportunity we discussed.",
    timestampSeconds: 37, timestampLabel: "00:37", createdAt: "2026-03-08T14:22:00", updatedAt: "2026-03-08T14:22:00",
    isEdited: false, sourceContext: "recipient_review",
  },
  {
    id: "rc-2", trackId: 1, authorName: "Jamie Lin", authorEmail: "jamie@atlantic.com",
    authorType: "recipient", commentText: "The bridge transition here feels slightly abrupt. Could we get a smoother crossfade?",
    timestampSeconds: 142, timestampLabel: "02:22", createdAt: "2026-03-08T14:25:00", updatedAt: "2026-03-08T14:25:00",
    isEdited: false, sourceContext: "recipient_review",
  },
  {
    id: "rc-3", trackId: 1, authorName: "Sarah Chen", authorEmail: "sarah@sony.com",
    authorType: "recipient", commentText: "Love the intro. Very cinematic feel. This would work great for the film placement.",
    timestampSeconds: 8, timestampLabel: "00:08", createdAt: "2026-03-07T10:15:00", updatedAt: "2026-03-07T10:15:00",
    isEdited: false, sourceContext: "shared_link_review",
  },
  {
    id: "rc-4", trackId: 1, authorName: "Kira Nomura", authorType: "owner",
    commentText: "Need to re-record this vocal take. Pitch is slightly off on the high note.",
    timestampSeconds: 95, timestampLabel: "01:35", createdAt: "2026-03-06T09:00:00", updatedAt: "2026-03-06T09:00:00",
    isEdited: false, sourceContext: "internal_review",
  },
  {
    id: "rc-5", trackId: 1, authorName: "JVNE", authorType: "team_member",
    commentText: "I can add a synth pad underneath here to fill out the low end. Let me know if you want me to try it.",
    timestampSeconds: 180, timestampLabel: "03:00", createdAt: "2026-03-06T11:30:00", updatedAt: "2026-03-06T16:45:00",
    isEdited: true, sourceContext: "internal_review",
  },
  {
    id: "rc-6", trackId: 1, authorName: "Marcus Webb", authorEmail: "marcus@interscope.com",
    authorType: "recipient", commentText: "The drop here is fire. This is exactly the energy we need for the campaign.",
    timestampSeconds: 112, timestampLabel: "01:52", createdAt: "2026-03-05T16:30:00", updatedAt: "2026-03-05T16:30:00",
    isEdited: false, sourceContext: "recipient_review",
  },
  {
    id: "rc-7", trackId: 3, authorName: "Sarah Chen", authorEmail: "sarah@sony.com",
    authorType: "recipient", commentText: "The synth arpeggios here remind me of early Kavinsky. Great retro vibes.",
    timestampSeconds: 65, timestampLabel: "01:05", createdAt: "2026-03-07T14:00:00", updatedAt: "2026-03-07T14:00:00",
    isEdited: false, sourceContext: "recipient_review",
  },
  {
    id: "rc-8", trackId: 5, authorName: "Kenji Mori", authorEmail: "kenji@88rising.com",
    authorType: "recipient", commentText: "The J-pop influence here is exactly what the Asian market is looking for right now.",
    timestampSeconds: 48, timestampLabel: "00:48", createdAt: "2026-03-08T13:15:00", updatedAt: "2026-03-08T13:15:00",
    isEdited: false, sourceContext: "pitching_feedback",
  },
];

const demoNotifications: CommentNotification[] = [
  {
    id: "cn-1", trackId: 1, trackTitle: "Velvet Hour", commentId: "rc-1",
    authorName: "Jamie Lin", authorType: "recipient", timestampLabel: "00:37",
    commentPreview: "This vocal layering is incredible...", createdAt: "2026-03-08T14:22:00", read: false,
  },
  {
    id: "cn-2", trackId: 1, trackTitle: "Velvet Hour", commentId: "rc-2",
    authorName: "Jamie Lin", authorType: "recipient", timestampLabel: "02:22",
    commentPreview: "The bridge transition here feels slightly...", createdAt: "2026-03-08T14:25:00", read: false,
  },
  {
    id: "cn-3", trackId: 1, trackTitle: "Velvet Hour", commentId: "rc-3",
    authorName: "Sarah Chen", authorType: "recipient", timestampLabel: "00:08",
    commentPreview: "Love the intro. Very cinematic feel...", createdAt: "2026-03-07T10:15:00", read: true,
  },
];

const TrackReviewContext = createContext<TrackReviewContextValue | null>(null);

export function TrackReviewProvider({ children }: { children: ReactNode }) {
  const [comments, setComments] = useState<TimecodedComment[]>(demoComments);
  const [notifications, setNotifications] = useState<CommentNotification[]>(demoNotifications);

  const getCommentsForTrack = useCallback((trackId: number) => {
    return comments.filter((c) => c.trackId === trackId && !c.deletedAt);
  }, [comments]);

  const addComment = useCallback((data: Omit<TimecodedComment, "id" | "createdAt" | "updatedAt" | "isEdited">) => {
    const now = new Date().toISOString();
    const newComment: TimecodedComment = {
      ...data,
      id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    };
    setComments((prev) => [...prev, newComment]);

    // Generate notification for non-owner comments
    if (data.authorType !== "owner") {
      const notification: CommentNotification = {
        id: `cn-${Date.now()}`,
        trackId: data.trackId,
        trackTitle: "", // Will be resolved by consumer
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
  }, []);

  const editComment = useCallback((commentId: string, newText: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, commentText: newText, updatedAt: new Date().toISOString(), isEdited: true } : c
      )
    );
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, deletedAt: new Date().toISOString() } : c
      )
    );
  }, []);

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
