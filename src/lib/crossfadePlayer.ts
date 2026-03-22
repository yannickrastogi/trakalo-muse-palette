import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface CrossfadeTrack {
  id: number;
  uuid: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  mood: string[];
  duration: string;
  coverImage?: string;
  waveformData?: number[];
  previewUrl?: string;
  originalFileUrl?: string;
}

export type RadioState = {
  currentTrack: CrossfadeTrack | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  crossfadeDuration: number;
};

type Listener = (state: RadioState) => void;

class CrossfadePlayer {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private activePlayer: "A" | "B" = "A";
  private queue: CrossfadeTrack[] = [];
  private history: CrossfadeTrack[] = [];
  private currentIndex = -1;
  private listeners: Set<Listener> = new Set();
  private crossfading = false;
  private crossfadeTimer: number | null = null;
  private urlCache: Record<string, { url: string; expires: number }> = {};
  private preloadedUrl: string | null = null;
  private preloadTriggered = false;
  private animFrameId: number | null = null;

  state: RadioState = {
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: false,
    crossfadeDuration: 3,
  };

  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.volume = this.state.volume;
    this.audioB.volume = 0;

    this.audioA.addEventListener("loadedmetadata", () => {
      if (this.activePlayer === "A") {
        this.update({ duration: this.audioA.duration });
      }
    });
    this.audioB.addEventListener("loadedmetadata", () => {
      if (this.activePlayer === "B") {
        this.update({ duration: this.audioB.duration });
      }
    });

    this.audioA.addEventListener("ended", () => this.onTrackEnded("A"));
    this.audioB.addEventListener("ended", () => this.onTrackEnded("B"));

    this.startProgressLoop();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private update(partial: Partial<RadioState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private getActive(): HTMLAudioElement {
    return this.activePlayer === "A" ? this.audioA : this.audioB;
  }

  private getInactive(): HTMLAudioElement {
    return this.activePlayer === "A" ? this.audioB : this.audioA;
  }

  private startProgressLoop() {
    const tick = () => {
      const active = this.getActive();
      if (active.duration && this.state.isPlaying) {
        this.update({
          currentTime: active.currentTime,
          progress: (active.currentTime / active.duration) * 100,
          duration: active.duration,
        });

        // Trigger preload and crossfade
        const timeLeft = active.duration - active.currentTime;
        if (timeLeft <= 15 && !this.preloadTriggered && this.currentIndex < this.queue.length - 1) {
          this.preloadTriggered = true;
          this.preloadNext();
        }
        if (this.state.crossfadeDuration > 0 && timeLeft <= this.state.crossfadeDuration && !this.crossfading && this.currentIndex < this.queue.length - 1) {
          this.startCrossfade();
        }
      }
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private async resolveUrl(track: CrossfadeTrack): Promise<string | null> {
    const rawUrl = track.previewUrl || track.originalFileUrl;
    if (!rawUrl) return null;

    if (rawUrl.startsWith("http")) return rawUrl;

    const cached = this.urlCache[rawUrl];
    if (cached && cached.expires > Date.now()) return cached.url;

    try {
      const res = await fetch(SUPABASE_URL + "/functions/v1/get-audio-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ track_id: track.uuid, quality: "preview" }),
      });
      const data = await res.json();
      if (data.url) {
        this.urlCache[rawUrl] = { url: data.url, expires: Date.now() + 3500000 };
        return data.url;
      }
    } catch (e) {
      // fallback to storage signing
    }

    const { data, error } = await supabase.storage.from("tracks").createSignedUrl(rawUrl, 3600);
    if (error || !data?.signedUrl) return null;
    this.urlCache[rawUrl] = { url: data.signedUrl, expires: Date.now() + 3500000 };
    return data.signedUrl;
  }

  private async preloadNext() {
    const nextIdx = this.currentIndex + 1;
    if (nextIdx >= this.queue.length) return;
    const url = await this.resolveUrl(this.queue[nextIdx]);
    if (url) {
      this.preloadedUrl = url;
      const inactive = this.getInactive();
      inactive.src = url;
      inactive.load();
    }
  }

  private startCrossfade() {
    if (this.crossfading) return;
    this.crossfading = true;

    const active = this.getActive();
    const inactive = this.getInactive();
    const fadeDuration = this.state.crossfadeDuration * 1000;
    const steps = fadeDuration / 50;
    const volumeStep = this.state.volume / steps;
    let step = 0;

    inactive.volume = 0;
    inactive.play().catch(() => {});

    this.crossfadeTimer = window.setInterval(() => {
      step++;
      const fadeOut = Math.max(0, this.state.volume - volumeStep * step);
      const fadeIn = Math.min(this.state.volume, volumeStep * step);
      active.volume = fadeOut;
      inactive.volume = fadeIn;

      if (step >= steps) {
        if (this.crossfadeTimer) clearInterval(this.crossfadeTimer);
        this.crossfadeTimer = null;
        active.pause();
        active.volume = 0;
        inactive.volume = this.state.volume;
        this.activePlayer = this.activePlayer === "A" ? "B" : "A";
        this.currentIndex++;
        this.preloadTriggered = false;
        this.preloadedUrl = null;
        this.crossfading = false;
        const newTrack = this.queue[this.currentIndex];
        if (newTrack) {
          this.history.push(newTrack);
          this.update({
            currentTrack: newTrack,
            progress: 0,
            currentTime: 0,
            duration: this.getActive().duration || 0,
          });
        }
      }
    }, 50);
  }

  private onTrackEnded(player: "A" | "B") {
    // Only handle if this was the active player and no crossfade happened
    if ((player === "A" && this.activePlayer === "A") || (player === "B" && this.activePlayer === "B")) {
      if (!this.crossfading) {
        this.playNext();
      }
    }
  }

  // Public API

  setQueue(tracks: CrossfadeTrack[]) {
    this.queue = [...tracks];
  }

  getQueue(): CrossfadeTrack[] {
    return this.queue.slice(this.currentIndex + 1);
  }

  getFullQueue(): CrossfadeTrack[] {
    return [...this.queue];
  }

  removeFromQueue(index: number) {
    const actualIndex = this.currentIndex + 1 + index;
    if (actualIndex > this.currentIndex && actualIndex < this.queue.length) {
      this.queue.splice(actualIndex, 1);
      this.listeners.forEach((fn) => fn(this.state));
    }
  }

  reorderQueue(fromIndex: number, toIndex: number) {
    const offset = this.currentIndex + 1;
    const actualFrom = offset + fromIndex;
    const actualTo = offset + toIndex;
    if (actualFrom < this.queue.length && actualTo < this.queue.length) {
      const [item] = this.queue.splice(actualFrom, 1);
      this.queue.splice(actualTo, 0, item);
      this.listeners.forEach((fn) => fn(this.state));
    }
  }

  clearQueue() {
    this.queue = this.currentIndex >= 0 && this.queue[this.currentIndex]
      ? [this.queue[this.currentIndex]]
      : [];
    if (this.queue.length > 0) this.currentIndex = 0;
    this.listeners.forEach((fn) => fn(this.state));
  }

  shuffleQueue() {
    const upcoming = this.queue.slice(this.currentIndex + 1);
    for (let i = upcoming.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
    }
    this.queue = [...this.queue.slice(0, this.currentIndex + 1), ...upcoming];
    this.listeners.forEach((fn) => fn(this.state));
  }

  async play(track: CrossfadeTrack, newQueue?: CrossfadeTrack[]) {
    // Stop any crossfade in progress
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    this.crossfading = false;

    if (newQueue) {
      this.queue = [...newQueue];
      this.currentIndex = newQueue.findIndex((t) => t.id === track.id);
      if (this.currentIndex < 0) this.currentIndex = 0;
    } else {
      const idx = this.queue.findIndex((t) => t.id === track.id);
      if (idx >= 0) this.currentIndex = idx;
    }

    this.preloadTriggered = false;
    this.preloadedUrl = null;

    const url = await this.resolveUrl(track);
    if (!url) {
      this.update({ isPlaying: false });
      return;
    }

    // Reset both players
    const active = this.getActive();
    const inactive = this.getInactive();
    inactive.pause();
    inactive.volume = 0;
    active.src = url;
    active.volume = this.state.volume;
    active.play().catch(() => {});

    this.history.push(track);
    this.update({
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });
  }

  togglePlay() {
    const active = this.getActive();
    if (this.state.isPlaying) {
      active.pause();
      if (this.crossfading) this.getInactive().pause();
      this.update({ isPlaying: false });
    } else {
      active.play().catch(() => {});
      if (this.crossfading) this.getInactive().play().catch(() => {});
      this.update({ isPlaying: true });
    }
  }

  async playNext() {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    this.crossfading = false;

    let nextIdx = this.currentIndex + 1;

    if (nextIdx >= this.queue.length) {
      if (this.state.repeat) {
        nextIdx = 0;
      } else {
        this.getActive().pause();
        this.getInactive().pause();
        this.update({ isPlaying: false });
        return;
      }
    }

    this.currentIndex = nextIdx;
    this.preloadTriggered = false;
    this.preloadedUrl = null;

    const track = this.queue[this.currentIndex];
    if (!track) return;

    const url = this.preloadedUrl || await this.resolveUrl(track);
    if (!url) return;

    // Quick crossfade (1s) for manual skip
    const active = this.getActive();
    const inactive = this.getInactive();
    inactive.src = url;
    inactive.volume = 0;
    inactive.play().catch(() => {});

    const steps = 20;
    const vol = this.state.volume;
    let step = 0;
    const timer = window.setInterval(() => {
      step++;
      active.volume = Math.max(0, vol - (vol / steps) * step);
      inactive.volume = Math.min(vol, (vol / steps) * step);
      if (step >= steps) {
        clearInterval(timer);
        active.pause();
        this.activePlayer = this.activePlayer === "A" ? "B" : "A";
      }
    }, 50);

    this.history.push(track);
    this.update({
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });
  }

  async playPrev() {
    if (this.currentIndex <= 0) return;
    this.currentIndex--;
    this.preloadTriggered = false;
    this.preloadedUrl = null;

    const track = this.queue[this.currentIndex];
    if (!track) return;

    const url = await this.resolveUrl(track);
    if (!url) return;

    const active = this.getActive();
    const inactive = this.getInactive();
    inactive.pause();
    inactive.volume = 0;
    active.src = url;
    active.volume = this.state.volume;
    active.play().catch(() => {});

    this.update({
      currentTrack: track,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });
  }

  seek(percent: number) {
    const active = this.getActive();
    if (active.duration) {
      active.currentTime = (percent / 100) * active.duration;
    }
  }

  setVolume(vol: number) {
    const active = this.getActive();
    active.volume = vol;
    this.update({ volume: vol });
  }

  setCrossfadeDuration(seconds: number) {
    this.update({ crossfadeDuration: seconds });
  }

  setShuffle(on: boolean) {
    this.update({ shuffle: on });
    if (on) this.shuffleQueue();
  }

  setRepeat(on: boolean) {
    this.update({ repeat: on });
  }

  stop() {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    this.crossfading = false;
    this.audioA.pause();
    this.audioA.src = "";
    this.audioB.pause();
    this.audioB.src = "";
    this.queue = [];
    this.currentIndex = -1;
    this.preloadTriggered = false;
    this.preloadedUrl = null;
    this.update({
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });
  }

  destroy() {
    this.stop();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.listeners.clear();
  }
}

// Singleton
let instance: CrossfadePlayer | null = null;

export function getCrossfadePlayer(): CrossfadePlayer {
  if (!instance) {
    instance = new CrossfadePlayer();
  }
  return instance;
}

export function destroyCrossfadePlayer() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
