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
      // Allow INITIAL_SESSION through to capture OAuth callback tokens
      if (!initializedRef.current && event !== "INITIAL_SESSION") return;
      console.log("[AUTH] onAuthStateChange:", event, "hasSession:", !!newSession);
      if (!newSession && event !== "SIGNED_OUT") {
        return;
      }
      if (newSession) {
        const allowed = await checkWhitelist(newSession);
        if (!allowed) return;
      }
      // Manually persist session to localStorage — Supabase sometimes fails to do this
      if (newSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        try {
          const storageKey = 'sb-xhmeitivkclbeziqavxw-auth-token';
          localStorage.setItem(storageKey, JSON.stringify(newSession));
          localStorage.setItem("trakalog_session_backup", JSON.stringify(newSession));
          console.log("[AUTH] Manually persisted session to localStorage");
        } catch (e) {
          console.error("[AUTH] Failed to persist session:", e);
        }
      }

      // Protect against false SIGNED_OUT events
      if (event === 'SIGNED_OUT' && !newSession) {
        const backup = localStorage.getItem("trakalog_session_backup");
        if (backup) {
          try {
            const backupSession = JSON.parse(backup);
            if (backupSession?.access_token) {
              console.log("[AUTH] Ignoring false SIGNED_OUT — backup session exists");
              return;
            }
          } catch (e) {}
        }
      }

      setSession(newSession);
      // If this is the first event (OAuth callback), also mark as initialized
      if (!initializedRef.current) {
        setLoading(false);
        initializedRef.current = true;
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      console.log("[AUTH] getSession:", !!initSession);
      // Skip if onAuthStateChange already handled initialization (OAuth flow)
      if (initializedRef.current) return;
      if (!initSession) {
        // Try to restore from backup
        try {
          const backup = localStorage.getItem("trakalog_session_backup");
          if (backup) {
            const backupSession = JSON.parse(backup);
            if (backupSession?.access_token && backupSession?.refresh_token) {
              console.log("[AUTH] Restoring session from backup");
              // Try refreshing with the refresh token first
              const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: backupSession.refresh_token,
              });
              if (refreshed?.session && !refreshError) {
                console.log("[AUTH] Session refreshed from backup");
                localStorage.setItem("trakalog_session_backup", JSON.stringify(refreshed.session));
                const allowed = await checkWhitelist(refreshed.session);
                if (!allowed) return;
                setSession(refreshed.session);
                setLoading(false);
                initializedRef.current = true;
                return;
              }
              // If refresh fails too, use backup session directly in React state (RPCs don't need Supabase auth)
              console.log("[AUTH] Refresh failed, using backup session directly");
              const allowed = await checkWhitelist(backupSession);
              if (!allowed) return;
              setSession(backupSession as Session);
              setLoading(false);
              initializedRef.current = true;
              return;
            }
          }
        } catch (e) {
          console.error("[AUTH] Backup restore failed:", e);
        }
      }
      if (initSession) {
        const allowed = await checkWhitelist(initSession);
        if (!allowed) return;
      }
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
