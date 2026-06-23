import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { getExistingCrossfadePlayer, onCrossfadePlayerCreated, type RadioState } from "@/lib/crossfadePlayer";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const DEFAULT_RADIO_STATE: RadioState = {
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

interface RadioPlayerContextValue {
  radioState: RadioState;
  /** True when the radio currently has a track loaded (playing or paused). */
  isRadioActive: boolean;
  radioToggle: () => void;
  radioNext: () => void;
  radioPrev: () => void;
  radioStop: () => void;
}

const RadioPlayerContext = createContext<RadioPlayerContextValue | null>(null);

/**
 * Lightweight provider that subscribes to the CrossfadePlayer singleton so the
 * radio survives navigation. Mounted at the app root (inside WorkspaceProvider)
 * → the mini radio bar in PersistentPlayer reflects playback everywhere.
 */
export function RadioPlayerProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [radioState, setRadioState] = useState<RadioState>(DEFAULT_RADIO_STATE);

  // Stay dormant until the radio singleton is actually created (first /radio
  // use). onCrossfadePlayerCreated fires immediately if it already exists, so
  // we attach without eagerly spinning up an Audio element + rAF loop.
  useEffect(() => {
    let unsub = () => {};
    const offCreate = onCrossfadePlayerCreated((player) => {
      setRadioState({ ...player.state });
      unsub();
      unsub = player.subscribe((s) => setRadioState({ ...s }));
    });
    return () => { offCreate(); unsub(); };
  }, []);

  const radioToggle = useCallback(() => { getExistingCrossfadePlayer()?.togglePlay(); }, []);
  const radioNext = useCallback(() => { getExistingCrossfadePlayer()?.playNext(); }, []);
  const radioPrev = useCallback(() => { getExistingCrossfadePlayer()?.playPrev(); }, []);
  const radioStop = useCallback(() => { getExistingCrossfadePlayer()?.stop(); }, []);

  // Stop the radio when switching workspaces — its catalog no longer applies.
  const prevWorkspaceId = useRef<string | undefined>(activeWorkspace?.id);
  useEffect(() => {
    const id = activeWorkspace?.id;
    if (prevWorkspaceId.current !== undefined && id !== prevWorkspaceId.current) {
      getExistingCrossfadePlayer()?.stop();
    }
    prevWorkspaceId.current = id;
  }, [activeWorkspace?.id]);

  // Stop the radio cleanly before the tab unloads.
  useEffect(() => {
    const handler = () => { getExistingCrossfadePlayer()?.stop(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const value = useMemo<RadioPlayerContextValue>(() => ({
    radioState,
    isRadioActive: radioState.currentTrack != null,
    radioToggle,
    radioNext,
    radioPrev,
    radioStop,
  }), [radioState, radioToggle, radioNext, radioPrev, radioStop]);

  return <RadioPlayerContext.Provider value={value}>{children}</RadioPlayerContext.Provider>;
}

export function useRadioPlayer() {
  const ctx = useContext(RadioPlayerContext);
  if (!ctx) throw new Error("useRadioPlayer must be used within RadioPlayerProvider");
  return ctx;
}
