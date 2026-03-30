import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { isEmailWhitelisted } from "@/lib/whitelist";
import { toast } from "sonner";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: Error }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: Error }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: Error; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    const checkWhitelist = async (sess: Session | null) => {
      if (sess?.user?.email && !isEmailWhitelisted(sess.user.email)) {
        await supabase.auth.signOut();
        toast.error("Trakalog is currently in private beta. Request access at hello@trakalog.com");
        setSession(null);
        setLoading(false);
        return false;
      }
      return true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("[AUTH-DEBUG] onAuthStateChange:", event, "session:", !!newSession, "initializedRef:", initializedRef.current);
      // Allow INITIAL_SESSION through to capture OAuth callback tokens
      if (!initializedRef.current && event !== "INITIAL_SESSION") return;
      if (!newSession && event !== "SIGNED_OUT") {
        return;
      }
      if (newSession) {
        const allowed = await checkWhitelist(newSession);
        if (!allowed) return;
      }
      // Persist session to localStorage on any valid event
      if (newSession) {
        localStorage.setItem("trakalog_was_auth", "1");
        try {
          localStorage.setItem("trakalog_session_backup", JSON.stringify(newSession));
        } catch (e) {}
      }

      console.log("[AUTH-DEBUG] setSession:", !!newSession, "loading will be:", !initializedRef.current ? false : loading);
      setSession(newSession);
      if (!initializedRef.current) {
        setLoading(false);
        initializedRef.current = true;
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      console.log("[AUTH-DEBUG] getSession result:", !!initSession, "initializedRef:", initializedRef.current);
      // Skip if onAuthStateChange already handled initialization (OAuth flow)
      if (initializedRef.current) return;
      if (!initSession) {
        // Try ONE refreshSession from backup — if it fails, give up cleanly
        try {
          const backup = localStorage.getItem("trakalog_session_backup");
          if (backup) {
            const backupSession = JSON.parse(backup);
            if (backupSession?.refresh_token) {
              const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: backupSession.refresh_token,
              });
              console.log("[AUTH-DEBUG] backup refresh result:", !!refreshed?.session, "error:", refreshError?.message);
              if (refreshed?.session && !refreshError) {
                localStorage.setItem("trakalog_session_backup", JSON.stringify(refreshed.session));
                const allowed = await checkWhitelist(refreshed.session);
                if (!allowed) return;
                console.log("[AUTH-DEBUG] setSession:", !!refreshed.session, "loading will be:", false);
                setSession(refreshed.session);
                setLoading(false);
                initializedRef.current = true;
                return;
              }
            }
            // Refresh failed or no tokens — clear stale backup
            localStorage.removeItem("trakalog_session_backup");
          }
        } catch (e) {
          localStorage.removeItem("trakalog_session_backup");
        }
      }
      if (initSession) {
        const allowed = await checkWhitelist(initSession);
        if (!allowed) return;
      }
      console.log("[AUTH-DEBUG] setSession:", !!initSession, "loading will be:", false);
      setSession(initSession);
      setLoading(false);
      initializedRef.current = true;
    }).catch(function (err) {
      console.error("Error getting session:", err);
      if (!initializedRef.current) {
        setLoading(false);
        initializedRef.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth",
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) return { error };
    return {};
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    return {};
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!isEmailWhitelisted(email)) {
      return { error: new Error("Trakalog is currently in private beta. Request access at hello@trakalog.com") };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    if (data.user && !data.session) {
      return { needsConfirmation: true };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("trakalog_was_auth");
    localStorage.removeItem("trakalog_session_backup");
    localStorage.removeItem("trakalog_active_workspace");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
