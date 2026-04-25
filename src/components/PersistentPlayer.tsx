import { useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronUp, ChevronDown, X } from "lucide-react";
import { MiniWaveform } from "@/components/MiniWaveform";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

import { DEFAULT_COVER } from "@/lib/constants";
import { MiniEqualizer } from "@/components/visual/MiniEqualizer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export function PersistentPlayer() {
  const { t } = useTranslation();
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    currentTime,
    duration,
    togglePlay,
    seek,
    setVolume,
    nextTrack,
    prevTrack,
  } = useAudioPlayer();

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [showVolume, setShowVolume] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevVolumeRef = useRef(0.8);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      seek(pct);
    },
    [seek]
  );

  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(pct);
    },
    [setVolume]
  );

  // Hide persistent player when Radio page is active
  if (location.pathname === "/radio") return null;

  if (!currentTrack) return null;

  const coverSrc = currentTrack.coverImage || DEFAULT_COVER;

  if (minimized) {
    return (
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border/60 shadow-lg hover:border-primary/30 transition-all group"
        >
          <img src={coverSrc} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-border/50" />
          <div className="flex items-center gap-1.5">
            <MiniWaveform seed={currentTrack.id * 13 + 7} bars={12} peaks={currentTrack.waveformData} progress={progress} />
            {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </motion.div>
    );
  }

  // Mobile full-screen expanded player
  if (isMobile && expanded) {
    return (
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Close bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button onClick={() => setExpanded(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ChevronDown className="w-5 h-5" />
          </button>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("player.nowPlaying")}</span>
          <div className="w-11" />
        </div>

        {/* Cover */}
        <div className="flex-1 flex items-center justify-center px-8">
          <img src={coverSrc} alt={currentTrack.title} className="w-full max-w-[300px] aspect-square rounded-2xl object-cover shadow-lg" />
        </div>

        {/* Track info */}
        <div className="px-6 pt-4 text-center">
          <p className="text-lg font-bold text-foreground truncate">{currentTrack.title}</p>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{currentTrack.artist}</p>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="h-1.5 bg-secondary/80 rounded-full cursor-pointer" onClick={handleProgressClick}>
            <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: progress + "%", background: "var(--gradient-brand-horizontal)" }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 py-6">
          <button onClick={prevTrack} className="p-3 rounded-full text-foreground hover:bg-secondary/60 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
            <SkipBack className="w-6 h-6" />
          </button>
          <button onClick={togglePlay} className="w-16 h-16 rounded-full btn-brand flex items-center justify-center">
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <button onClick={nextTrack} className="p-3 rounded-full text-foreground hover:bg-secondary/60 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
            <SkipForward className="w-6 h-6" />
          </button>
        </div>

        {/* Mute toggle (mobile — no volume slider) */}
        <div className="flex items-center justify-center pb-8" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)" }}>
          <button
            onClick={() => {
              if (volume === 0) {
                setVolume(prevVolumeRef.current || 0.8);
              } else {
                prevVolumeRef.current = volume;
                setVolume(0);
              }
            }}
            className="p-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </motion.div>
    );
  }

  // Mobile compact bar — sits above bottom nav
  if (isMobile) {
    return (
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-[52px] left-0 right-0 z-40"
        style={{ bottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Mini progress bar */}
        <div className="h-0.5 bg-secondary/80" onClick={handleProgressClick}>
          <div className="h-full transition-[width] duration-100 ease-linear" style={{ width: progress + "%", background: "var(--gradient-brand-horizontal)" }} />
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="w-full glass border-t border-border/60 px-3 py-2 flex items-center gap-3"
          style={{ boxShadow: "0 -2px 12px hsl(0 0% 0% / 0.2)" }}
        >
          <img src={coverSrc} alt={currentTrack.title} className="w-10 h-10 rounded-lg object-cover ring-1 ring-border/50 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{currentTrack.title}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{currentTrack.artist}</p>
          </div>
          <div
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-10 h-10 rounded-full btn-brand flex items-center justify-center shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </div>
        </button>
      </motion.div>
    );
  }

  // Desktop player
  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Progress bar — above the player, clickable */}
      <div
        className="h-1 bg-secondary/80 cursor-pointer group relative"
        onClick={handleProgressClick}
      >
        <div
          className="h-full transition-[width] duration-100 ease-linear"
          style={{
            width: progress + "%",
            background: "var(--gradient-brand-horizontal)",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          style={{ left: "calc(" + progress + "% - 6px)" }}
        />
      </div>

      {/* Main player bar */}
      <div className="glass border-t border-border/60 px-3 sm:px-5 py-2.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4" style={{ boxShadow: "0 -4px 24px hsl(0 0% 0% / 0.3)" }}>
        {/* Track info — left */}
        <button
          onClick={() => navigate("/track/" + currentTrack.uuid)}
          className="flex items-center gap-3 min-w-0 group/info justify-self-start"
        >
          <img
            src={coverSrc}
            alt={currentTrack.title}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover ring-1 ring-border/50 group-hover/info:ring-primary/30 transition-all shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight group-hover/info:text-primary transition-colors flex items-center">
              {currentTrack.title}
              {isPlaying && <MiniEqualizer />}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {currentTrack.artist}
            </p>
          </div>
        </button>

        {/* Center — controls (fixed width) */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-self-center">
          <button
            onClick={prevTrack}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full btn-brand flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={nextTrack}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right — time + volume + minimize */}
        <div className="flex items-center gap-2 sm:gap-3 justify-self-end">
          <span className="text-[11px] font-mono text-muted-foreground tabular-nums hidden sm:block">
            {formatTime(currentTime)}
            <span className="text-muted-foreground/40 mx-0.5">/</span>
            {formatTime(duration)}
          </span>

          {/* Volume */}
          <div className="relative hidden sm:flex items-center">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showVolume && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 80 }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="h-1.5 bg-secondary rounded-full cursor-pointer ml-1"
                    onClick={handleVolumeClick}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-75"
                      style={{ width: volume * 100 + "%" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            title={t("player.minimize")}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
