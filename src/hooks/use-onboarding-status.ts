import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeStorage";
import { useAuth } from "@/contexts/AuthContext";

const LS_KEY = "trakalog_onboarding_complete";

export interface OnboardingStatus {
  /** True while the DB check is in flight (initial value from localStorage to avoid flash). */
  isLoading: boolean;
  /** True if the user has already finished onboarding. DB is the source of truth. */
  isComplete: boolean;
  /** Mark onboarding complete in DB + localStorage. Fire-and-forget. */
  markComplete: () => Promise<void>;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { user } = useAuth();
  const [isComplete, setIsComplete] = useState<boolean>(() => {
    return safeLocalStorage.getItem(LS_KEY) === "true";
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fetchedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (fetchedForUserRef.current === user.id) return;
    fetchedForUserRef.current = user.id;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("Error fetching onboarding status:", error);
          return;
        }
        const dbComplete = !!(data && (data as { onboarding_complete?: boolean }).onboarding_complete);
        if (dbComplete) {
          setIsComplete(true);
          safeLocalStorage.setItem(LS_KEY, "true");
        } else {
          // DB explicitly says not complete — trust DB, clear any stale local flag
          setIsComplete(false);
          safeLocalStorage.removeItem(LS_KEY);
        }
      } catch (err) {
        console.error("Error fetching onboarding status:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const markComplete = useCallback(async () => {
    // Optimistic: hide immediately, persist in background
    setIsComplete(true);
    safeLocalStorage.setItem(LS_KEY, "true");
    if (!user) return;
    try {
      const { error } = await supabase.rpc("mark_onboarding_complete", { _user_id: user.id });
      if (error) console.error("Error marking onboarding complete:", error);
    } catch (err) {
      console.error("Error marking onboarding complete:", err);
    }
  }, [user]);

  return { isLoading, isComplete, markComplete };
}
