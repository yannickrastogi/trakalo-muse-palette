import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface RecipientEngagement {
  recipientName: string;
  recipientCompany: string;
  plays: number;
  downloads: number;
  packDownloads: number;
  stemDownloads: number;
  lastActivity: string;
}

export interface TrackEngagement {
  trackId: number;
  totalPlays: number;
  totalDownloads: number;
  recipients: RecipientEngagement[];
}

export interface PlaylistEngagement {
  playlistId: string;
  totalPlays: number;
  perTrackPlays: Record<number, number>;
  recipients: RecipientEngagement[];
}

interface EngagementContextValue {
  trackEngagement: TrackEngagement[];
  playlistEngagement: PlaylistEngagement[];
  getTrackEngagement: (trackId: number) => TrackEngagement | undefined;
  getPlaylistEngagement: (playlistId: string) => PlaylistEngagement | undefined;
  getTotalPlaysForTrack: (trackId: number) => number;
  getTotalDownloadsForTrack: (trackId: number) => number;
  getTopPlayedTracks: (limit: number) => { trackId: number; plays: number }[];
  getTotalStats: () => { totalPlays: number; totalDownloads: number; uniqueRecipients: number };
}

const demoTrackEngagement: TrackEngagement[] = [
  {
    trackId: 1,
    totalPlays: 47,
    totalDownloads: 8,
    recipients: [
      { recipientName: "Jamie Lin", recipientCompany: "Atlantic Records", plays: 18, downloads: 3, packDownloads: 1, stemDownloads: 1, lastActivity: "2026-03-09T12:12:00" },
      { recipientName: "Sarah Chen", recipientCompany: "Sony Music", plays: 12, downloads: 2, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-07T18:22:00" },
      { recipientName: "Marcus Webb", recipientCompany: "Interscope Records", plays: 9, downloads: 2, packDownloads: 1, stemDownloads: 1, lastActivity: "2026-03-05T14:30:00" },
      { recipientName: "Diana Rossi", recipientCompany: "Warner Music", plays: 5, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-03T10:15:00" },
      { recipientName: "Alex Turner", recipientCompany: "Republic Records", plays: 3, downloads: 0, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-01T16:45:00" },
    ],
  },
  {
    trackId: 2,
    totalPlays: 23,
    totalDownloads: 4,
    recipients: [
      { recipientName: "Jamie Lin", recipientCompany: "Atlantic Records", plays: 11, downloads: 2, packDownloads: 1, stemDownloads: 0, lastActivity: "2026-03-08T09:45:00" },
      { recipientName: "Kenji Mori", recipientCompany: "88rising", plays: 8, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-06T11:20:00" },
      { recipientName: "Lisa Park", recipientCompany: "HYBE", plays: 4, downloads: 1, packDownloads: 0, stemDownloads: 1, lastActivity: "2026-03-04T15:00:00" },
    ],
  },
  {
    trackId: 3,
    totalPlays: 31,
    totalDownloads: 5,
    recipients: [
      { recipientName: "Sarah Chen", recipientCompany: "Sony Music", plays: 15, downloads: 2, packDownloads: 1, stemDownloads: 0, lastActivity: "2026-03-07T14:10:00" },
      { recipientName: "Marcus Webb", recipientCompany: "Interscope Records", plays: 10, downloads: 2, packDownloads: 1, stemDownloads: 1, lastActivity: "2026-03-05T09:30:00" },
      { recipientName: "Diana Rossi", recipientCompany: "Warner Music", plays: 6, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-02T11:45:00" },
    ],
  },
  {
    trackId: 4,
    totalPlays: 12,
    totalDownloads: 2,
    recipients: [
      { recipientName: "Alex Turner", recipientCompany: "Republic Records", plays: 7, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-06T16:00:00" },
      { recipientName: "Diana Rossi", recipientCompany: "Warner Music", plays: 5, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-04T12:30:00" },
    ],
  },
  {
    trackId: 5,
    totalPlays: 19,
    totalDownloads: 3,
    recipients: [
      { recipientName: "Kenji Mori", recipientCompany: "88rising", plays: 12, downloads: 2, packDownloads: 1, stemDownloads: 0, lastActivity: "2026-03-08T13:00:00" },
      { recipientName: "Lisa Park", recipientCompany: "HYBE", plays: 7, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-05T10:20:00" },
    ],
  },
  {
    trackId: 6,
    totalPlays: 8,
    totalDownloads: 1,
    recipients: [
      { recipientName: "Jamie Lin", recipientCompany: "Atlantic Records", plays: 5, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-07T11:00:00" },
      { recipientName: "Sarah Chen", recipientCompany: "Sony Music", plays: 3, downloads: 0, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-04T09:15:00" },
    ],
  },
  {
    trackId: 7,
    totalPlays: 15,
    totalDownloads: 3,
    recipients: [
      { recipientName: "Marcus Webb", recipientCompany: "Interscope Records", plays: 8, downloads: 2, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-06T14:45:00" },
      { recipientName: "Alex Turner", recipientCompany: "Republic Records", plays: 7, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-03T17:20:00" },
    ],
  },
  { trackId: 8, totalPlays: 6, totalDownloads: 1, recipients: [{ recipientName: "Diana Rossi", recipientCompany: "Warner Music", plays: 6, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-05T08:30:00" }] },
  { trackId: 9, totalPlays: 4, totalDownloads: 0, recipients: [{ recipientName: "Kenji Mori", recipientCompany: "88rising", plays: 4, downloads: 0, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-02T13:45:00" }] },
  { trackId: 10, totalPlays: 3, totalDownloads: 0, recipients: [{ recipientName: "Lisa Park", recipientCompany: "HYBE", plays: 3, downloads: 0, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-01T10:30:00" }] },
  { trackId: 11, totalPlays: 11, totalDownloads: 2, recipients: [{ recipientName: "Sarah Chen", recipientCompany: "Sony Music", plays: 6, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-07T15:30:00" }, { recipientName: "Jamie Lin", recipientCompany: "Atlantic Records", plays: 5, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-04T11:00:00" }] },
  { trackId: 12, totalPlays: 7, totalDownloads: 1, recipients: [{ recipientName: "Marcus Webb", recipientCompany: "Interscope Records", plays: 7, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-06T10:00:00" }] },
];

const demoPlaylistEngagement: PlaylistEngagement[] = [
  {
    playlistId: "pl-1",
    totalPlays: 84,
    perTrackPlays: { 1: 28, 2: 19, 3: 22, 5: 15 },
    recipients: [
      { recipientName: "Jamie Lin", recipientCompany: "Atlantic Records", plays: 35, downloads: 4, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-09T12:12:00" },
      { recipientName: "Sarah Chen", recipientCompany: "Sony Music", plays: 26, downloads: 2, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-07T18:22:00" },
      { recipientName: "Marcus Webb", recipientCompany: "Interscope Records", plays: 23, downloads: 3, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-05T14:30:00" },
    ],
  },
  {
    playlistId: "pl-2",
    totalPlays: 42,
    perTrackPlays: { 4: 12, 7: 18, 8: 12 },
    recipients: [
      { recipientName: "Diana Rossi", recipientCompany: "Warner Music", plays: 22, downloads: 2, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-04T12:30:00" },
      { recipientName: "Alex Turner", recipientCompany: "Republic Records", plays: 20, downloads: 1, packDownloads: 0, stemDownloads: 0, lastActivity: "2026-03-03T17:20:00" },
    ],
  },
];

const EngagementContext = createContext<EngagementContextValue | null>(null);

export function EngagementProvider({ children }: { children: ReactNode }) {
  const [trackEngagement] = useState<TrackEngagement[]>(demoTrackEngagement);
  const [playlistEngagement] = useState<PlaylistEngagement[]>(demoPlaylistEngagement);

  const getTrackEngagement = useCallback((trackId: number) => {
    return trackEngagement.find((e) => e.trackId === trackId);
  }, [trackEngagement]);

  const getPlaylistEngagement = useCallback((playlistId: string) => {
    return playlistEngagement.find((e) => e.playlistId === playlistId);
  }, [playlistEngagement]);

  const getTotalPlaysForTrack = useCallback((trackId: number) => {
    return trackEngagement.find((e) => e.trackId === trackId)?.totalPlays ?? 0;
  }, [trackEngagement]);

  const getTotalDownloadsForTrack = useCallback((trackId: number) => {
    return trackEngagement.find((e) => e.trackId === trackId)?.totalDownloads ?? 0;
  }, [trackEngagement]);

  const getTopPlayedTracks = useCallback((limit: number) => {
    return [...trackEngagement]
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, limit)
      .map((e) => ({ trackId: e.trackId, plays: e.totalPlays }));
  }, [trackEngagement]);

  const getTotalStats = useCallback(() => {
    const totalPlays = trackEngagement.reduce((sum, e) => sum + e.totalPlays, 0);
    const totalDownloads = trackEngagement.reduce((sum, e) => sum + e.totalDownloads, 0);
    const uniqueNames = new Set(trackEngagement.flatMap((e) => e.recipients.map((r) => r.recipientName)));
    return { totalPlays, totalDownloads, uniqueRecipients: uniqueNames.size };
  }, [trackEngagement]);

  return (
    <EngagementContext.Provider value={{ trackEngagement, playlistEngagement, getTrackEngagement, getPlaylistEngagement, getTotalPlaysForTrack, getTotalDownloadsForTrack, getTopPlayedTracks, getTotalStats }}>
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error("useEngagement must be used within EngagementProvider");
  return ctx;
}
