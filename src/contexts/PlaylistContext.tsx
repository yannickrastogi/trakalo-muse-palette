import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { WorkspaceScoped } from "@/types/workspace";
import { type NewPlaylistData } from "@/components/CreatePlaylistModal";

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

const defaultPlaylists: PlaylistItem[] = [
  {
    id: "summer-ep", workspace_id: "ws-nightfall",
    name: "Summer EP — Final Selects",
    description: "Curated finals for the summer release. Warm, uplifting vibes across neo-soul and indie.",
    tracks: 8, duration: "32 min", updated: "2h ago", mood: "Uplifting",
    coverIdxs: [0, 2, 4, 3], color: "from-brand-orange/20 to-brand-pink/10",
  },
  {
    id: "sync-pitches-q2", workspace_id: "ws-nightfall",
    name: "Sync Pitches — Q2 2026",
    description: "Tracks shortlisted for film, TV, and ad sync placements this quarter.",
    tracks: 14, duration: "52 min", updated: "1d ago", mood: "Cinematic",
    coverIdxs: [1, 3, 5, 0], color: "from-brand-purple/20 to-brand-pink/10",
    description: "Tracks shortlisted for film, TV, and ad sync placements this quarter.",
    tracks: 14,
    duration: "52 min",
    updated: "1d ago",
    mood: "Cinematic",
    coverIdxs: [1, 3, 5, 0],
    color: "from-brand-purple/20 to-brand-pink/10",
  },
  {
    id: "late-night", workspace_id: "ws-nightfall",
    name: "Late Night Sessions",
    description: "Downtempo, ambient, and lo-fi selections for after-hours listening.",
    tracks: 22,
    duration: "1h 18m",
    updated: "3d ago",
    mood: "Chill",
    coverIdxs: [3, 4, 0, 2],
    color: "from-brand-pink/15 to-brand-purple/15",
  },
  {
    id: "high-energy",
    name: "High Energy — Ads",
    description: "Punchy, high-tempo tracks perfect for advertising and brand campaigns.",
    tracks: 11,
    duration: "38 min",
    updated: "5d ago",
    mood: "Energetic",
    coverIdxs: [5, 1, 2, 4],
    color: "from-brand-orange/25 to-brand-purple/10",
  },
  {
    id: "neo-soul",
    name: "Neo-Soul Collection",
    description: "A definitive collection of our best neo-soul productions and collaborations.",
    tracks: 19,
    duration: "1h 04m",
    updated: "1w ago",
    mood: "Smooth",
    coverIdxs: [0, 3, 1, 5],
    color: "from-brand-pink/20 to-brand-orange/10",
  },
  {
    id: "unreleased-vault",
    name: "Unreleased Vault",
    description: "Demos, unreleased masters, and works-in-progress awaiting final clearance.",
    tracks: 31,
    duration: "1h 52m",
    updated: "2w ago",
    mood: "Mixed",
    coverIdxs: [2, 5, 3, 1],
    color: "from-brand-purple/15 to-brand-orange/15",
  },
];

interface PlaylistContextType {
  playlists: PlaylistItem[];
  addPlaylist: (pl: NewPlaylistData) => void;
  getPlaylist: (id: string) => PlaylistItem | undefined;
  updatePlaylist: (id: string, updates: Partial<PlaylistItem>) => void;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>(defaultPlaylists);

  const addPlaylist = useCallback((pl: NewPlaylistData) => {
    setPlaylists((prev) => [pl as PlaylistItem, ...prev]);
  }, []);

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists]
  );

  const updatePlaylist = useCallback((id: string, updates: Partial<PlaylistItem>) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

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
