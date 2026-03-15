import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type NewPlaylistData } from "@/components/CreatePlaylistModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
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
  addPlaylist: (pl: NewPlaylistData) => void;
  getPlaylist: (id: string) => PlaylistItem | undefined;
  updatePlaylist: (id: string, updates: Partial<PlaylistItem>) => void;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
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

    // Group track IDs by playlist
    const tracksByPlaylist: Record<string, number[]> = {};
    for (const pt of ptRows || []) {
      const pid = pt.playlist_id as string;
      if (!tracksByPlaylist[pid]) tracksByPlaylist[pid] = [];
      tracksByPlaylist[pid].push(pt.track_id as number);
    }

    const mapped = rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const ids = tracksByPlaylist[r.id as string] || [];
      return mapRowToPlaylist(r, ids.length, ids);
    });

    setPlaylists(mapped);
  }, [activeWorkspace, user]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const addPlaylist = useCallback(
    async (pl: NewPlaylistData) => {
      if (!activeWorkspace || !user) return;

      const { data, error } = await supabase
        .from("playlists")
        .insert({
          workspace_id: activeWorkspace.id,
          created_by: user.id,
          name: pl.name,
          description: pl.description || "",
          cover_url: pl.coverImage || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding playlist:", error);
        return;
      }

      // Insert track associations if any
      if (pl.trackIds && pl.trackIds.length > 0 && data) {
        const ptInserts = pl.trackIds.map((trackId, idx) => ({
          playlist_id: data.id,
          track_id: trackId,
          position: idx,
          added_by: user.id,
        }));

        const { error: ptError } = await supabase
          .from("playlist_tracks")
          .insert(ptInserts);

        if (ptError) {
          console.error("Error adding playlist tracks:", ptError);
        }
      }

      await fetchPlaylists();
    },
    [activeWorkspace, user, fetchPlaylists]
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

      // Build Supabase payload (only persist DB-backed fields)
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.coverImage !== undefined) payload.cover_url = updates.coverImage || null;

      if (Object.keys(payload).length > 0) {
        const { error } = await supabase
          .from("playlists")
          .update(payload)
          .eq("id", id);

        if (error) {
          console.error("Error updating playlist:", error);
        }
      }

      // Sync trackIds to playlist_tracks if provided
      if (updates.trackIds !== undefined && user) {
        // Replace all tracks: delete existing, insert new
        const { error: delError } = await supabase
          .from("playlist_tracks")
          .delete()
          .eq("playlist_id", id);

        if (delError) {
          console.error("Error clearing playlist tracks:", delError);
        } else if (updates.trackIds.length > 0) {
          const ptInserts = updates.trackIds.map((trackId, idx) => ({
            playlist_id: id,
            track_id: trackId,
            position: idx,
            added_by: user.id,
          }));

          const { error: insError } = await supabase
            .from("playlist_tracks")
            .insert(ptInserts);

          if (insError) {
            console.error("Error updating playlist tracks:", insError);
          }
        }
      }
    },
    [user]
  );

  return (
    <PlaylistContext.Provider value={{ playlists, addPlaylist, getPlaylist, updatePlaylist }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be used within PlaylistProvider");
  return ctx;
}
