import { useEffect, useCallback } from "react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts:
 * - Space: play/pause (when not in an input)
 * - ⌘K / Ctrl+K: focus search
 * - Escape: close modals (handled natively by Radix)
 * - ArrowRight (with Meta/Ctrl): next track
 * - ArrowLeft (with Meta/Ctrl): prev track
 */
export function useGlobalShortcuts() {
  const { currentTrack, togglePlay, nextTrack, prevTrack } = useAudioPlayer();
  const navigate = useNavigate();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;

      // ⌘K / Ctrl+K — focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('header input[type="text"]');
        searchInput?.focus();
        return;
      }

      // Skip if user is typing
      if (isInput) return;

      // Space — play/pause
      if (e.key === " " && currentTrack) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Ctrl/Meta + ArrowRight — next track
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") {
        e.preventDefault();
        nextTrack();
        return;
      }

      // Ctrl/Meta + ArrowLeft — prev track
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        prevTrack();
        return;
      }
    },
    [currentTrack, togglePlay, nextTrack, prevTrack]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
