import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type NewPlaylistData } from "@/components/CreatePlaylistModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTrack } from "@/contexts/TrackContext";
import type { WorkspaceScoped } from "@/types/workspace";

import cover1 from "@/assets/covers/cover-1.jpg";
import cover2 from "@/assets/covers/cover-2.jpg";
import cover3 from "@/assets/covers/cover-3.jpg";
import cover4 from "@/assets/covers/cover-4.jpg";
import cover5 from "@/assets/covers/cover-5.jpg";
import cover6 from "@/assets/covers/cover-6.jpg";

export const covers = [cover1, cover2, cover3, cover4, cover5, cover6];

export interface PlaylistItem extends WorkspaceScoped {
  id: string;
  name: string;
  description: string;
  tracks: number;
  duration: string;
  updated: string;
  mood: string;
  coverIdxs: number[];
  color: string;
  trackIds?: number[];
  genre?: string;
  moods?: string[];
  coverImage?: string;
}

function formatUpdated(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  const weeks = Math.floor(days / 7);
  return weeks + "w ago";
}

function mapRowToPlaylist(
  row: Record<string, unknown>,
  trackCount: number,
  trackIds: number[]
): PlaylistItem {
  return {
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    name: (row.name as string) || "",
    description: (row.description as string) || "",
    tracks: trackCount,
    duration: trackCount * 4 + " min",
    updated: formatUpdated((row.updated_at as string) || (row.created_at as string) || ""),
    mood: "",
    coverIdxs: [0, 1, 2, 3],
    color: "from-brand-purple/20 to-brand-pink/10",
    trackIds,
    coverImage: (row.cover_url as string) || undefined,
  };
}

interface PlaylistContextType {
  playlists: PlaylistItem[];
  addPlaylist: (pl: NewPlaylistData) => Promise<string | undefined>;
  getPlaylist: (id: string) => PlaylistItem | undefined;
  updatePlaylist: (id: string, updates: Partial<PlaylistItem>) => void;
  deletePlaylist: (id: string) => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { tracks } = useTrack();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);

  const fetchPlaylists = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setPlaylists([]);
      return;
    }

    const { data: rows, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching playlists:", error);
      setPlaylists([]);
      return;
    }

    if (!rows || rows.length === 0) {
      setPlaylists([]);
      return;
    }

    // Fetch track associations for all playlists in one query
    const playlistIds = rows.map((r) => r.id);
    const { data: ptRows, error: ptError } = await supabase
      .from("playlist_tracks")
      .select("playlist_id, track_id, position")
      .in("playlist_id", playlistIds)
      .order("position", { ascending: true });

    if (ptError) {
      console.error("Error fetching playlist_tracks:", ptError);
    }

    // Group track UUIDs by playlist, then map to numeric IDs
    const trackUuidsByPlaylist: Record<string, string[]> = {};
    for (const pt of ptRows || []) {
      const pid = pt.playlist_id as string;
      if (!trackUuidsByPlaylist[pid]) trackUuidsByPlaylist[pid] = [];
      trackUuidsByPlaylist[pid].push(pt.track_id as string);
    }

    const mapped = rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const uuids = trackUuidsByPlaylist[r.id as string] || [];
      const numericIds = uuids
        .map((uuid) => {
          const t = tracks.find((tr) => tr.uuid === uuid);
          return t ? t.id : null;
        })
        .filter((id): id is number => id !== null);
      return mapRowToPlaylist(r, uuids.length, numericIds);
    });

    setPlaylists(mapped);
  }, [activeWorkspace, user, tracks]);

  useEffect(() => {
    if (tracks.length === 0 && activeWorkspace) return;
    fetchPlaylists();
  }, [fetchPlaylists, tracks, activeWorkspace]);

  const addPlaylist = useCallback(
    async (pl: NewPlaylistData): Promise<string | undefined> => {
      if (!activeWorkspace || !user) return undefined;

      const { data, error } = await supabase
        .rpc("create_playlist", {
          _user_id: user.id,
          _workspace_id: activeWorkspace.id,
          _name: pl.name,
          _description: pl.description || "",
          _cover_url: pl.coverImage || null,
        });

      if (error) {
        console.error("Error adding playlist:", error);
        return undefined;
      }

      const playlistId = data as unknown as string;

      // Insert track associations if any — map numeric IDs to UUIDs
      if (pl.trackIds && pl.trackIds.length > 0 && playlistId) {
        const trackUuids = pl.trackIds
          .map((numericId) => {
            const t = tracks.find((tr) => tr.id === numericId);
            return t ? t.uuid : null;
          })
          .filter((uuid): uuid is string => uuid !== null);

        if (trackUuids.length > 0) {
          await supabase.rpc("add_playlist_tracks", {
            _user_id: user.id,
            _playlist_id: playlistId,
            _track_ids: trackUuids,
          });
        }
      }

      await fetchPlaylists();
      return playlistId;
    },
    [activeWorkspace, user, tracks, fetchPlaylists]
  );

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists]
  );

  const updatePlaylist = useCallback(
    async (id: string, updates: Partial<PlaylistItem>) => {
      // Update locally first for instant UI
      setPlaylists((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );

      // Persist DB-backed fields via RPC
      const hasName = updates.name !== undefined;
      const hasDesc = updates.description !== undefined;
      const hasCover = updates.coverImage !== undefined;

      if (hasName || hasDesc || hasCover) {
        const { error } = await supabase.rpc("update_playlist", {
          _user_id: user?.id || "",
          _playlist_id: id,
          _name: hasName ? updates.name! : null,
          _description: hasDesc ? updates.description! : null,
          _cover_url: hasCover ? (updates.coverImage || null) : null,
        });

        if (error) {
          console.error("Error updating playlist:", error);
        }
      }

      // Sync trackIds to playlist_tracks if provided
      if (updates.trackIds !== undefined && user) {
        const trackUuids = updates.trackIds
          .map((numericId) => {
            const t = tracks.find((tr) => tr.id === numericId);
            return t ? t.uuid : null;
          })
          .filter((uuid): uuid is string => uuid !== null);

        await supabase.rpc("replace_playlist_tracks", {
          _user_id: user.id,
          _playlist_id: id,
          _track_ids: trackUuids,
        });
      }
    },
    [user, tracks]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      // Remove locally first
      setPlaylists((prev) => prev.filter((p) => p.id !== id));

      // Delete playlist_tracks first (may not cascade automatically)
      const { error } = await supabase.rpc("delete_playlist", {
        _user_id: user?.id || "",
        _playlist_id: id,
      });

      if (error) {
        console.error("Error deleting playlist:", error);
        await fetchPlaylists();
      }
    },
    [fetchPlaylists]
  );

  return (
    <PlaylistContext.Provider value={useMemo(() => ({ playlists, addPlaylist, getPlaylist, updatePlaylist, deletePlaylist }), [playlists, addPlaylist, getPlaylist, updatePlaylist, deletePlaylist])}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be used within PlaylistProvider");
  return ctx;
}
