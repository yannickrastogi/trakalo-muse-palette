import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { detectChapters } from "@/lib/chapter-detection";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { WorkspaceScoped } from "@/types/workspace";

export interface TrackStem {
  id: string;
  fileName: string;
  type: string;
  key?: string;
  fileSize: string;
  uploadDate: string;
  color: string;
}

export interface TrackSplit {
  id: string;
  name: string;
  role: string;
  share: number;
  pro: string;
  ipi: string;
  publisher: string;
}

export interface TrackChapter {
  id: string;
  label: string;
  startPercent: number;
  endPercent: number;
  color: string;
}

export interface TrackStatusEntry {
  status: string;
  date: string;
  note: string;
}

export interface TrackData extends WorkspaceScoped {
  id: number;
  title: string;
  artist: string;
  featuredArtists: string[];
  album: string;
  genre: string;
  bpm: number;
  key: string;
  duration: string;
  mood: string[];
  voice: string;
  status: string;
  isrc: string;
  upc: string;
  releaseDate: string;
  label: string;
  publisher: string;
  writtenBy: string[];
  producedBy: string[];
  mixedBy: string;
  masteredBy: string;
  copyright: string;
  language: string;
  explicit: boolean;
  type: string;
  coverIdx: number;
  coverImage?: string;
  previewUrl?: string;
  originalFileUrl?: string;
  originalFileName?: string;
  originalFileSize?: number;
  notes: string;
  details: Record<string, string[]>;
  stems: TrackStem[];
  splits: TrackSplit[];
  lyrics?: string;
  chapters?: TrackChapter[];
  statusHistory: TrackStatusEntry[];
}

// Default demo tracks with full data
const defaultTracks: TrackData[] = [
  {
    id: 1, title: "Velvet Hour", artist: "Kira Nomura", featuredArtists: ["JVNE"], album: "Late Bloom EP",
    genre: "Neo-Soul", bpm: 92, key: "Ab Maj", duration: "4:12", mood: ["emotional", "dreamy", "smooth"], voice: "Female",
    status: "Available", isrc: "USRC12600001", upc: "0850123456789", releaseDate: "2026-04-12",
    label: "Nightfall Records", publisher: "Nomura Publishing", writtenBy: ["Kira Nomura", "Jun Tanaka"],
    producedBy: ["JVNE", "Kira Nomura"], mixedBy: "Marco Silva", masteredBy: "Sterling Sound NYC",
    copyright: "© 2026 Nightfall Records", language: "English", explicit: false, type: "Song", coverIdx: 0,
    notes: "", details: {},
    stems: [
      { id: "1", fileName: "VelvetHour_Vocal_Lead.wav", type: "vocal", key: "Ab Maj", fileSize: "42.3 MB", uploadDate: "Mar 2, 2026", color: "text-brand-pink" },
      { id: "2", fileName: "VelvetHour_BG_Vocals.wav", type: "background vocal", key: "Ab Maj", fileSize: "38.1 MB", uploadDate: "Mar 2, 2026", color: "text-brand-purple" },
      { id: "3", fileName: "VelvetHour_Drums_Full.wav", type: "drums", fileSize: "56.7 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
      { id: "4", fileName: "VelvetHour_Kick.wav", type: "kick", fileSize: "12.4 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
      { id: "5", fileName: "VelvetHour_Snare.wav", type: "snare", fileSize: "8.9 MB", uploadDate: "Mar 1, 2026", color: "text-primary" },
      { id: "6", fileName: "VelvetHour_Bass.wav", type: "bass", key: "Ab Maj", fileSize: "28.5 MB", uploadDate: "Feb 28, 2026", color: "text-chart-4" },
      { id: "7", fileName: "VelvetHour_Synth_Pad.wav", type: "synth", key: "Ab Maj", fileSize: "34.2 MB", uploadDate: "Feb 28, 2026", color: "text-brand-orange" },
      { id: "8", fileName: "VelvetHour_Guitar_Clean.wav", type: "guitar", key: "Ab Maj", fileSize: "31.0 MB", uploadDate: "Feb 27, 2026", color: "text-chart-5" },
      { id: "9", fileName: "VelvetHour_FX_Risers.wav", type: "fx", fileSize: "15.8 MB", uploadDate: "Feb 27, 2026", color: "text-accent" },
    ],
    splits: [
      { id: "s1", name: "Kira Nomura", role: "Writer / Artist", share: 40, pro: "ASCAP", ipi: "00123456789", publisher: "Nomura Publishing" },
      { id: "s2", name: "Jun Tanaka", role: "Writer", share: 25, pro: "BMI", ipi: "00987654321", publisher: "" },
      { id: "s3", name: "JVNE", role: "Producer", share: 20, pro: "SESAC", ipi: "00112233445", publisher: "" },
      { id: "s4", name: "Nightfall Records", role: "Publisher", share: 15, pro: "—", ipi: "—", publisher: "" },
    ],
    lyrics: `[Verse 1]\nUnderneath the velvet hour\nWe find a place that's ours\nSilhouettes in amber light\nDancing through the night\n\n[Chorus]\nHold me close, don't let me go\nIn this glow, we're moving slow\nVelvet hour, velvet dreams\nNothing's ever what it seems\n\n[Verse 2]\nWhispers float on midnight air\nFingers running through your hair\nTime dissolves like sugar rain\nWe'll never feel this way again\n\n[Chorus]\nHold me close, don't let me go\nIn this glow, we're moving slow\nVelvet hour, velvet dreams\nNothing's ever what it seems\n\n[Bridge]\nAnd if the morning comes too soon\nWe'll chase the shadows of the moon\n\n[Outro]\nVelvet hour… velvet hour…`,
    statusHistory: [
      { status: "Available", date: "Jan 10, 2026", note: "Recording completed at Nightfall Studio" },
      { status: "On Hold", date: "Jan 22, 2026", note: "Awaiting JVNE feature clearance" },
      { status: "Available", date: "Feb 15, 2026", note: "Clearance received, track open for pitching" },
    ],
  },
  {
    id: 2, title: "Ghost Protocol", artist: "Dex Moraes × JVNE", featuredArtists: [], album: "Singles 2026",
    genre: "Electronic", bpm: 128, key: "F# Min", duration: "3:38", mood: ["energetic", "dark"], voice: "Male",
    status: "On Hold", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: ["Dex Moraes"], producedBy: ["JVNE"], mixedBy: "", masteredBy: "",
    copyright: "", language: "English", explicit: false, type: "Sample", coverIdx: 1,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "On Hold", date: "Feb 1, 2026", note: "Initial upload" }],
  },
  {
    id: 3, title: "Burning Chrome", artist: "Alina Voss", featuredArtists: [], album: "Neon Archive",
    genre: "Synthwave", bpm: 118, key: "C Min", duration: "5:01", mood: ["nostalgic", "driving"], voice: "Female",
    status: "Available", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: ["Alina Voss"], producedBy: ["Alina Voss"], mixedBy: "", masteredBy: "",
    copyright: "", language: "Portuguese", explicit: false, type: "Song", coverIdx: 2,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Available", date: "Jan 15, 2026", note: "Initial upload" }],
  },
  {
    id: 4, title: "Soft Landing", artist: "Marco Silva", featuredArtists: [], album: "Ambient Vol. II",
    genre: "Ambient", bpm: 72, key: "D Maj", duration: "6:44", mood: ["calm", "uplifting"], voice: "N/A",
    status: "Released", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: ["Marco Silva"], producedBy: ["Marco Silva"], mixedBy: "", masteredBy: "",
    copyright: "", language: "Instrumental", explicit: false, type: "Instrumental", coverIdx: 3,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Released", date: "Dec 20, 2025", note: "Initial upload" }],
  },
  {
    id: 5, title: "Paper Moons", artist: "Kira Nomura × AYA", featuredArtists: [], album: "Late Bloom EP",
    genre: "Indie Pop", bpm: 105, key: "Bb Maj", duration: "3:22", mood: ["happy", "playful"], voice: "Duet",
    status: "On Hold", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "Japanese", explicit: false, type: "Song", coverIdx: 4,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "On Hold", date: "Jan 5, 2026", note: "Initial upload" }],
  },
  {
    id: 6, title: "Static Bloom", artist: "JVNE", featuredArtists: [], album: "Singles 2026",
    genre: "Glitch Hop", bpm: 140, key: "E Min", duration: "2:59", mood: ["aggressive", "experimental"], voice: "Male",
    status: "Available", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "English", explicit: false, type: "Acapella", coverIdx: 5,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Available", date: "Feb 10, 2026", note: "Initial upload" }],
  },
  {
    id: 7, title: "Golden Frequency", artist: "Alina Voss × Marco", featuredArtists: [], album: "Neon Archive",
    genre: "House", bpm: 124, key: "G Maj", duration: "5:33", mood: ["euphoric", "warm"], voice: "Duet",
    status: "Released", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "Spanish", explicit: false, type: "Song", coverIdx: 2,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Released", date: "Jan 1, 2026", note: "Initial upload" }],
  },
  {
    id: 8, title: "Daybreak", artist: "Kira Nomura", featuredArtists: [], album: "Late Bloom EP",
    genre: "Neo-Soul", bpm: 88, key: "Eb Maj", duration: "3:55", mood: ["hopeful", "smooth"], voice: "N/A",
    status: "Released", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "English", explicit: false, type: "Instrumental", coverIdx: 0,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Released", date: "Dec 15, 2025", note: "Initial upload" }],
  },
  {
    id: 9, title: "Obsidian", artist: "Dex Moraes", featuredArtists: [], album: "Singles 2026",
    genre: "Techno", bpm: 136, key: "A Min", duration: "6:12", mood: ["dark", "hypnotic"], voice: "N/A",
    status: "On Hold", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "Instrumental", explicit: false, type: "Sample", coverIdx: 1,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "On Hold", date: "Feb 5, 2026", note: "Initial upload" }],
  },
  {
    id: 10, title: "Slow Drift", artist: "Marco Silva", featuredArtists: [], album: "Ambient Vol. II",
    genre: "Ambient", bpm: 65, key: "F Maj", duration: "7:08", mood: ["meditative", "calm"], voice: "N/A",
    status: "Released", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "Instrumental", explicit: false, type: "Instrumental", coverIdx: 3,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Released", date: "Nov 20, 2025", note: "Initial upload" }],
  },
  {
    id: 11, title: "Neon Pulse", artist: "JVNE × Alina Voss", featuredArtists: [], album: "Neon Archive",
    genre: "Synthwave", bpm: 110, key: "B Min", duration: "4:28", mood: ["energetic", "nostalgic"], voice: "Female",
    status: "Available", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "French", explicit: false, type: "Song", coverIdx: 2,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "Available", date: "Feb 20, 2026", note: "Initial upload" }],
  },
  {
    id: 12, title: "Afterglow", artist: "Kira Nomura × Dex", featuredArtists: [], album: "Late Bloom EP",
    genre: "R&B", bpm: 96, key: "C# Min", duration: "3:47", mood: ["romantic", "emotional"], voice: "Female",
    status: "On Hold", isrc: "", upc: "", releaseDate: "", label: "", publisher: "",
    writtenBy: [], producedBy: [], mixedBy: "", masteredBy: "",
    copyright: "", language: "English", explicit: false, type: "Acapella", coverIdx: 0,
    notes: "", details: {}, stems: [], splits: [],
    statusHistory: [{ status: "On Hold", date: "Mar 1, 2026", note: "Initial upload" }],
  },
];

interface TrackContextValue {
  tracks: TrackData[];
  getTrack: (id: number) => TrackData | undefined;
  addTrack: (track: TrackData) => void;
  updateTrack: (id: number, updates: Partial<TrackData>) => void;
  updateTrackStatus: (id: number, newStatus: string, note: string) => void;
  updateTrackLyrics: (id: number, lyrics: string) => void;
  updateTrackStems: (id: number, stems: TrackStem[]) => void;
  updateTrackSplits: (id: number, splits: TrackSplit[]) => void;
}

const TrackContext = createContext<TrackContextValue | null>(null);

export function TrackProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<TrackData[]>(defaultTracks);

  const getTrack = useCallback((id: number) => {
    const track = tracks.find((t) => t.id === id);
    if (track && !track.chapters) {
      return { ...track, chapters: detectChapters(track.type, track.bpm, track.id) };
    }
    return track;
  }, [tracks]);

  const addTrack = useCallback((track: TrackData) => {
    const withChapters = {
      ...track,
      chapters: track.chapters || detectChapters(track.type, track.bpm, track.id),
    };
    setTracks((prev) => [...prev, withChapters]);
  }, []);

  const updateTrack = useCallback((id: number, updates: Partial<TrackData>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const updateTrackStatus = useCallback((id: number, newStatus: string, note: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              statusHistory: [...(t.statusHistory || []), { status: newStatus, date: dateStr, note }],
            }
          : t
      )
    );
  }, []);

  const updateTrackLyrics = useCallback((id: number, lyrics: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, lyrics } : t)));
  }, []);

  const updateTrackStems = useCallback((id: number, stems: TrackStem[]) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, stems } : t)));
  }, []);

  const updateTrackSplits = useCallback((id: number, splits: TrackSplit[]) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, splits: splits.map((s) => ({ ...s, share: s.share || 0 })) } : t
      )
    );
  }, []);

  return (
    <TrackContext.Provider value={{ tracks, getTrack, addTrack, updateTrack, updateTrackStatus, updateTrackLyrics, updateTrackStems, updateTrackSplits }}>
      {children}
    </TrackContext.Provider>
  );
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used within TrackProvider");
  return ctx;
}
