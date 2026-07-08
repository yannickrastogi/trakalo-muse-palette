import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/i18n";
import type { TrackData } from "@/contexts/TrackContext";
import { getAudioPlaybackUrl, getStorageSignedUrl } from "@/lib/audio";
import { getExistingCrossfadePlayer } from "@/lib/crossfadePlayer";

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
  /**
   * Swap the underlying audio source while preserving the current timecode and
   * play state. Used by Track Versioning A/B switch — caller passes a raw
   * storage path inside the "tracks" bucket. Caller is responsible for ensuring
   * the swap targets the same logical track (currentTrack stays unchanged).
   *
   * `playWhenReady` forces playback after the swap even if the audio element
   * is currently paused — used by the initial "play a non-active version"
   * flow where the underlying element hasn't started yet when we trigger.
   */
  swapAudioSource: (rawStoragePath: string, opts?: { playWhenReady?: boolean }) => Promise<void>;
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

  // Keep refs so event handlers inside the one-time useEffect avoid stale closures
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  const playTrackInternalRef = useRef<(track: TrackData) => void>(() => {});

  // Monotonic token guarding against out-of-order URL resolution. Each playTrack
  // bumps it; after the async sign returns we only touch audio.src if our token
  // is still the latest — otherwise a slow-resolving older track would clobber
  // the src while currentTrack already shows a newer one (displayed ≠ playing).
  const playRequestIdRef = useRef(0);

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
      // Auto-play next track (use queueRef to avoid stale closure)
      const currentId = audioRef.current?.dataset.trackId;
      if (currentId) {
        const currentQueue = queueRef.current;
        const idx = currentQueue.findIndex((t) => String(t.id) === currentId);
        if (idx >= 0 && idx < currentQueue.length - 1) {
          const nextTrack = currentQueue[idx + 1];
          playTrackInternalRef.current(nextTrack);
        }
      }
    };

    // Single safety-net: when the loaded variant was the MP3 preview, retry
    // once on the original audio URL before surfacing an error. Covers the
    // window where a freshly-uploaded preview is in the DB but not yet
    // readable from the storage backend.
    const onError = async () => {
      console.error("Audio playback error:", audio.error);
      const variant = audio.dataset.audioVariant;
      const trackUuid = audio.dataset.trackUuid;
      const fallbackTried = audio.dataset.fallbackAttempted === "1";
      if (variant === "preview" && trackUuid && !fallbackTried) {
        audio.dataset.fallbackAttempted = "1";
        try {
          const fullUrl = await getAudioPlaybackUrl(trackUuid, "full", { noCache: true });
          audio.dataset.audioVariant = "full";
          audio.src = fullUrl;
          audio.play().catch(() => {
            toast.error(i18n.t("audioPlayer.playbackFailed"));
            setState((prev) => ({ ...prev, isPlaying: false }));
          });
          return;
        } catch (e) {
          console.error("Audio fallback to original failed:", e instanceof Error ? e.message : e);
        }
      }
      toast.error(i18n.t("audioPlayer.playbackFailed"));
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

  // Cache of signed URLs by storage path to avoid re-signing
  const signedUrlCache = useRef<Record<string, { url: string; expires: number }>>({});

  const resolveAudioUrl = useCallback(async (rawUrl: string, trackUuid?: string): Promise<string | null> => {
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

    // Phase 5: route 100% via Edge Functions (R2 honored).
    // - If we have the track UUID, use get-audio-url (preview-aware).
    // - Else, fall back to the generic get-storage-url for the raw path.
    //
    // Legacy Supabase-direct fallback (kept here as comment for Phase 5 rollback reference):
    //   const { data, error } = await supabase.storage
    //     .from("tracks").createSignedUrl(rawUrl, 3600);
    try {
      // Cache TTL = 240s (URL is 300s for preview; 3600s for storage-url helper).
      // Conservative: align to the shorter of the two so we never hand out a
      // stale URL to <audio>. The lib/audio LRU also caches at 4 min — this
      // local cache only matters if multiple callsites share the same rawUrl.
      const localTtlMs = 240 * 1000;
      if (trackUuid) {
        const url = await getAudioPlaybackUrl(trackUuid, "preview");
        signedUrlCache.current[rawUrl] = { url, expires: Date.now() + localTtlMs };
        return url;
      }
      const url = await getStorageSignedUrl("tracks", rawUrl, { expiresInSec: 3600 });
      signedUrlCache.current[rawUrl] = { url, expires: Date.now() + localTtlMs };
      return url;
    } catch (e) {
      console.error("resolveAudioUrl failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }, []);

  const playTrackInternal = useCallback(async (track: TrackData) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Claim the latest request slot. Any older in-flight playTrack becomes stale
    // and must NOT write audio.src after this point.
    const requestId = ++playRequestIdRef.current;

    // Playing a catalog track takes over from the radio — stop it so both
    // engines don't play at once (no-op if the radio was never started).
    const radio = getExistingCrossfadePlayer();
    if (radio && radio.state.currentTrack) radio.stop();

    // Get audio URL — prefer previewUrl, fallback to originalFileUrl
    const rawUrl = track.previewUrl || track.originalFileUrl;
    if (!rawUrl) {
      toast.error(i18n.t("audioPlayer.noAudioFile"));
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

    const signedUrl = await resolveAudioUrl(rawUrl, track.uuid);

    // A newer playTrack superseded us while we were signing — bail so we don't
    // load this (now-stale) track's audio over the one currently displayed.
    if (requestId !== playRequestIdRef.current) return;

    if (!signedUrl) {
      toast.error(i18n.t("audioPlayer.couldNotLoad"));
      setState((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    // currentTrack (displayed) and audio.src (played) are now committed from the
    // SAME track object, atomically — the single source of truth for this slot.
    audio.src = signedUrl;
    audio.dataset.trackId = String(track.id);
    audio.dataset.trackUuid = track.uuid;
    audio.dataset.audioVariant = "preview";
    delete audio.dataset.fallbackAttempted;
    audio.play().catch(function(err) {
      console.error("Play failed:", err);
      if (requestId !== playRequestIdRef.current) return;
      toast.error(i18n.t("audioPlayer.playbackFailed"));
      setState((prev) => ({ ...prev, isPlaying: false }));
    });
  }, [resolveAudioUrl]);
  playTrackInternalRef.current = playTrackInternal;

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

  const swapAudioSource = useCallback(async (rawStoragePath: string, opts?: { playWhenReady?: boolean }) => {
    const audio = audioRef.current;
    if (!audio || !rawStoragePath) return;

    // Capture intent BEFORE we kick off the (async) sign — by the time the URL
    // comes back, the underlying element may have re-initialized (e.g. when
    // chained right after playTrack).
    const wasPlaying = !audio.paused || !!opts?.playWhenReady;
    const savedTime = audio.currentTime;

    let signedUrl: string;
    try {
      signedUrl = await getStorageSignedUrl("tracks", rawStoragePath, { expiresInSec: 3600 });
    } catch (e) {
      console.error("swapAudioSource: failed to sign URL:", e instanceof Error ? e.message : e);
      toast.error(i18n.t("audioPlayer.couldNotLoadVersion"));
      return;
    }

    const onLoaded = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      try {
        audio.currentTime = Math.min(savedTime, audio.duration || savedTime);
      } catch {
        // ignore — some browsers throw if duration is unknown
      }
      if (wasPlaying) {
        audio.play().catch(() => {});
      }
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    // Mark this as a manually-selected source (version A/B switch); the
    // preview-fallback safety net only kicks in for plain "preview" loads.
    audio.dataset.audioVariant = "swap";
    delete audio.dataset.fallbackAttempted;
    audio.src = signedUrl;
  }, []);

  return (
    <AudioPlayerContext.Provider value={useMemo(() => ({
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
      swapAudioSource,
    }), [state, playTrack, togglePlay, pause, seek, seekToTime, setVolume, nextTrack, prevTrack, setQueue, queue, isTrackPlaying, swapAudioSource])}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

