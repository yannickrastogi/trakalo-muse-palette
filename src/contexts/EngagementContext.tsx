import { createContext, useContext, useCallback, type ReactNode } from "react";
import type { WorkspaceScoped } from "@/types/workspace";

export interface RecipientEngagement {
  recipientName: string;
  recipientCompany: string;
  plays: number;
  downloads: number;
  packDownloads: number;
  stemDownloads: number;
  lastActivity: string;
}

export interface TrackEngagement extends WorkspaceScoped {
  trackId: number;
  totalPlays: number;
  totalDownloads: number;
  recipients: RecipientEngagement[];
}

export interface PlaylistEngagement extends WorkspaceScoped {
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

const EngagementContext = createContext<EngagementContextValue | null>(null);

// Empty engagement data — will be populated when a dedicated
// engagement/analytics table is created in Supabase.

const emptyTrackEngagement: TrackEngagement[] = [];
const emptyPlaylistEngagement: PlaylistEngagement[] = [];

export function EngagementProvider({ children }: { children: ReactNode }) {
  const getTrackEngagement = useCallback((_trackId: number) => {
    return undefined;
  }, []);

  const getPlaylistEngagement = useCallback((_playlistId: string) => {
    return undefined;
  }, []);

  const getTotalPlaysForTrack = useCallback((_trackId: number) => {
    return 0;
  }, []);

  const getTotalDownloadsForTrack = useCallback((_trackId: number) => {
    return 0;
  }, []);

  const getTopPlayedTracks = useCallback((_limit: number) => {
    return [] as { trackId: number; plays: number }[];
  }, []);

  const getTotalStats = useCallback(() => {
    return { totalPlays: 0, totalDownloads: 0, uniqueRecipients: 0 };
  }, []);

  return (
    <EngagementContext.Provider value={{
      trackEngagement: emptyTrackEngagement,
      playlistEngagement: emptyPlaylistEngagement,
      getTrackEngagement,
      getPlaylistEngagement,
      getTotalPlaysForTrack,
      getTotalDownloadsForTrack,
      getTopPlayedTracks,
      getTotalStats,
    }}>
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const ctx = useContext(EngagementContext);
  if (!ctx) throw new Error("useEngagement must be used within EngagementProvider");
  return ctx;
}
