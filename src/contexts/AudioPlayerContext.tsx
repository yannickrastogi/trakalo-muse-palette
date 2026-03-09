import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { TrackData } from "@/contexts/TrackContext";

interface AudioPlayerState {
  currentTrack: TrackData | null;
  isPlaying: boolean;
  progress: number; // 0-100
  volume: number; // 0-1
  duration: number; // seconds
  currentTime: number; // seconds
}

interface AudioPlayerContextValue extends AudioPlayerState {
  playTrack: (track: TrackData) => void;
  togglePlay: () => void;
  pause: () => void;
  seek: (percent: number) => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setQueue: (tracks: TrackData[]) => void;
  queue: TrackData[];
  isTrackPlaying: (trackId: number) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    volume: 0.8,
    duration: 0,
    currentTime: 0,
  });
  const [queue, setQueue] = useState<TrackData[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parse duration string "4:12" to seconds
  const parseDuration = (dur: string): number => {
    const parts = dur.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
  };

  // Simulate playback progress
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state.isPlaying && state.currentTrack) {
      const totalSec = parseDuration(state.currentTrack.duration);
      if (totalSec <= 0) return;
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          const newTime = prev.currentTime + 0.25;
          if (newTime >= totalSec) {
            return { ...prev, isPlaying: false, progress: 100, currentTime: totalSec };
          }
          return { ...prev, currentTime: newTime, progress: (newTime / totalSec) * 100 };
        });
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isPlaying, state.currentTrack?.id]);

  const playTrack = useCallback((track: TrackData) => {
    const dur = parseDuration(track.duration);
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: dur,
    }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => (prev.currentTrack ? { ...prev, isPlaying: !prev.isPlaying } : prev));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const seek = useCallback((percent: number) => {
    setState((prev) => {
      if (!prev.currentTrack) return prev;
      const totalSec = parseDuration(prev.currentTrack.duration);
      const newTime = (percent / 100) * totalSec;
      return { ...prev, progress: percent, currentTime: newTime };
    });
  }, []);

  const setVolume = useCallback((vol: number) => {
    setState((prev) => ({ ...prev, volume: Math.max(0, Math.min(1, vol)) }));
  }, []);

  const findCurrentIndex = () => {
    if (!state.currentTrack) return -1;
    return queue.findIndex((t) => t.id === state.currentTrack!.id);
  };

  const nextTrack = useCallback(() => {
    const idx = findCurrentIndex();
    if (idx >= 0 && idx < queue.length - 1) {
      playTrack(queue[idx + 1]);
    }
  }, [queue, state.currentTrack, playTrack]);

  const prevTrack = useCallback(() => {
    const idx = findCurrentIndex();
    if (idx > 0) {
      playTrack(queue[idx - 1]);
    } else if (state.currentTrack) {
      seek(0);
    }
  }, [queue, state.currentTrack, playTrack, seek]);

  const isTrackPlaying = useCallback((trackId: number) => {
    return state.currentTrack?.id === trackId && state.isPlaying;
  }, [state.currentTrack?.id, state.isPlaying]);

  return (
    <AudioPlayerContext.Provider value={{
      ...state,
      playTrack,
      togglePlay,
      pause,
      seek,
      setVolume,
      nextTrack,
      prevTrack,
      setQueue,
      queue,
      isTrackPlaying,
    }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
