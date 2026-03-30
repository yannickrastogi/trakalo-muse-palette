import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  seekToTime: (seconds: number) => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setQueue: (tracks: TrackData[]) => void;
  queue: TrackData[];
  isTrackPlaying: (trackId: number) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    volume: 0.8,
    duration: 0,
    currentTime: 0,
  });
  const [queue, setQueue] = useState<TrackData[]>([]);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setState((prev) => ({
          ...prev,
          currentTime: audio.currentTime,
          progress: (audio.currentTime / audio.duration) * 100,
        }));
      }
    };

    const onLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        duration: audio.duration,
      }));
    };

    const onEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
      // Auto-play next track
      const currentId = audioRef.current?.dataset.trackId;
      if (currentId) {
        const idx = queue.findIndex((t) => String(t.id) === currentId);
        if (idx >= 0 && idx < queue.length - 1) {
          const nextTrack = queue[idx + 1];
          playTrackInternal(nextTrack);
        }
      }
    };

    const onError = () => {
      console.error("Audio playback error:", audio.error);
      toast.error("Audio playback error. The file may be unavailable.");
      setState((prev) => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Update queue ref for onEnded handler
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Cache of signed URLs by storage path to avoid re-signing
  const signedUrlCache = useRef<Record<string, { url: string; expires: number }>>({});

  const resolveAudioUrl = useCallback(async (rawUrl: string): Promise<string | null> => {
    // Already a full URL (signed or external)
    if (rawUrl.startsWith("http")) {
      // Check if it's a Supabase signed URL that might be expired
      // Signed URLs contain a "token" param — just return as-is and let error handler deal with expiry
      return rawUrl;
    }

    // Raw storage path — needs signing
    const cached = signedUrlCache.current[rawUrl];
    if (cached && cached.expires > Date.now()) {
      return cached.url;
    }

    // Ensure Supabase has a session for signed URLs
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      try {
        const backup = localStorage.getItem("trakalog_session_backup");
        if (backup) {
          const backupSession = JSON.parse(backup);
          if (backupSession?.refresh_token) {
            await supabase.auth.refreshSession({ refresh_token: backupSession.refresh_token });
          }
        }
      } catch (e) {
        console.error("Failed to restore session for audio:", e);
      }
    }

    const { data, error } = await supabase.storage
      .from("tracks")
      .createSignedUrl(rawUrl, 3600);

    if (error || !data?.signedUrl) {
      console.error("Failed to sign audio URL:", error);
      return null;
    }

    signedUrlCache.current[rawUrl] = {
      url: data.signedUrl,
      expires: Date.now() + 3500 * 1000, // slight buffer before actual expiry
    };
    return data.signedUrl;
  }, []);

  const playTrackInternal = useCallback(async (track: TrackData) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Get audio URL — prefer previewUrl, fallback to originalFileUrl
    const rawUrl = track.previewUrl || track.originalFileUrl;
    if (!rawUrl) {
      toast.error("No audio file available for this track.");
      return;
    }

    // Set loading state immediately
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: 0,
    }));

    const signedUrl = await resolveAudioUrl(rawUrl);
    if (!signedUrl) {
      toast.error("Could not load audio. Please try again.");
      setState((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    audio.src = signedUrl;
    audio.dataset.trackId = String(track.id);
    audio.play().catch(function(err) {
      console.error("Play failed:", err);
      toast.error("Audio playback failed.");
      setState((prev) => ({ ...prev, isPlaying: false }));
    });
  }, [resolveAudioUrl]);

  const playTrack = useCallback((track: TrackData) => {
    playTrackInternal(track);
  }, [playTrackInternal]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentTrack) return;

    if (state.isPlaying) {
      audio.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audio.play().catch(() => {});
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentTrack]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const seek = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (percent / 100) * audio.duration;
    setState((prev) => ({
      ...prev,
      progress: percent,
      currentTime: (percent / 100) * (audio.duration || 0),
    }));
  }, []);

  const seekToTime = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration));
    audio.currentTime = clamped;
    setState((prev) => ({
      ...prev,
      currentTime: clamped,
      progress: (clamped / audio.duration) * 100,
    }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    if (audioRef.current) audioRef.current.volume = clamped;
    setState((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const findCurrentIndex = () => {
    if (!state.currentTrack) return -1;
    return queue.findIndex((t) => t.id === state.currentTrack!.id);
  };

  const nextTrack = useCallback(() => {
    const idx = findCurrentIndex();
    if (idx >= 0 && idx < queue.length - 1) {
      playTrackInternal(queue[idx + 1]);
    }
  }, [queue, state.currentTrack, playTrackInternal]);

  const prevTrack = useCallback(() => {
    const idx = findCurrentIndex();
    if (idx > 0) {
      playTrackInternal(queue[idx - 1]);
    } else {
      seek(0);
    }
  }, [queue, state.currentTrack, playTrackInternal, seek]);

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
      seekToTime,
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

