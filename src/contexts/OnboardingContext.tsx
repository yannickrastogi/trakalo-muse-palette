import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type OnboardingStep =
  | "create_team"
  | "upload_track"
  | "complete_metadata"
  | "add_credits"
  | "create_playlist"
  | "share_or_pitch";

interface OnboardingState {
  welcomeDismissed: boolean;
  completedSteps: OnboardingStep[];
  checklistDismissed: boolean;
  dismissedTooltips: string[];
}

const STORAGE_KEY = "trakalog_onboarding";

const defaultState: OnboardingState = {
  welcomeDismissed: false,
  completedSteps: [],
  checklistDismissed: false,
  dismissedTooltips: [],
};

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState, ...JSON.parse(raw) };
  } catch {}
  return defaultState;
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface OnboardingContextValue {
  state: OnboardingState;
  isFirstVisit: boolean;
  dismissWelcome: () => void;
  completeStep: (step: OnboardingStep) => void;
  isStepCompleted: (step: OnboardingStep) => boolean;
  dismissChecklist: () => void;
  dismissTooltip: (id: string) => void;
  isTooltipDismissed: (id: string) => boolean;
  resetOnboarding: () => void;
  allStepsCompleted: boolean;
  completionPercent: number;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const TOTAL_STEPS = 6;

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const isFirstVisit = !state.welcomeDismissed;

  const dismissWelcome = useCallback(() => {
    setState((s) => ({ ...s, welcomeDismissed: true }));
  }, []);

  const completeStep = useCallback((step: OnboardingStep) => {
    setState((s) => {
      if (s.completedSteps.includes(step)) return s;
      return { ...s, completedSteps: [...s.completedSteps, step] };
    });
  }, []);

  const isStepCompleted = useCallback(
    (step: OnboardingStep) => state.completedSteps.includes(step),
    [state.completedSteps]
  );

  const dismissChecklist = useCallback(() => {
    setState((s) => ({ ...s, checklistDismissed: true }));
  }, []);

  const dismissTooltip = useCallback((id: string) => {
    setState((s) => {
      if (s.dismissedTooltips.includes(id)) return s;
      return { ...s, dismissedTooltips: [...s.dismissedTooltips, id] };
    });
  }, []);

  const isTooltipDismissed = useCallback(
    (id: string) => state.dismissedTooltips.includes(id),
    [state.dismissedTooltips]
  );

  const resetOnboarding = useCallback(() => {
    setState(defaultState);
  }, []);

  const allStepsCompleted = state.completedSteps.length >= TOTAL_STEPS;
  const completionPercent = Math.round((state.completedSteps.length / TOTAL_STEPS) * 100);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        isFirstVisit,
        dismissWelcome,
        completeStep,
        isStepCompleted,
        dismissChecklist,
        dismissTooltip,
        isTooltipDismissed,
        resetOnboarding,
        allStepsCompleted,
        completionPercent,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
