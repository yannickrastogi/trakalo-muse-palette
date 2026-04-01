import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { isEmailWhitelisted } from "@/lib/whitelist";
import { toast } from "sonner";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  needsMfaVerification: boolean;
  signInWithGoogle: () => Promise<{ error?: Error }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: Error }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: Error; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  verifyMfa: (code: string) => Promise<{ error?: Error }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsMfaVerification, setNeedsMfaVerification] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const checkMfa = async (sess: Session): Promise<boolean> => {
      try {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!aalData) return false;
        // If already aal2, no verification needed
        if (aalData.currentLevel === "aal2") return false;
        // If next level requires aal2, user has enrolled TOTP factors
        if (aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");
          if (verifiedTotp) {
            setMfaFactorId(verifiedTotp.id);
            setNeedsMfaVerification(true);
            return true;
          }
        }
      } catch (e) {}
      return false;
    };

    const checkWhitelist = async (sess: Session | null) => {
      if (sess?.user?.email && !(await isEmailWhitelisted(sess.user.email))) {
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

      if (event === "SIGNED_IN" && newSession) {
        supabase.rpc("write_audit_log", { _user_id: newSession.user.id, _workspace_id: null, _action: "user.login", _metadata: JSON.stringify({ provider: newSession.user.app_metadata?.provider || "email" }) }).then(() => {}).catch(() => {});
      }

      setSession(newSession);
      if (newSession && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        await checkMfa(newSession);
      }
      if (!initializedRef.current) {
        setLoading(false);
        initializedRef.current = true;
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
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
              if (refreshed?.session && !refreshError) {
                localStorage.setItem("trakalog_session_backup", JSON.stringify(refreshed.session));
                const allowed = await checkWhitelist(refreshed.session);
                if (!allowed) return;
                setSession(refreshed.session);
                await checkMfa(refreshed.session);
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
      setSession(initSession);
      if (initSession) {
        await checkMfa(initSession);
      }
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
    if (!(await isEmailWhitelisted(email))) {
      return { error: new Error("Trakalog is currently in private beta. Request access at hello@trakalog.com") };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error };
    if (data.user && !data.session) {
      return { needsConfirmation: true };
    }
    return {};
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    if (!mfaFactorId) return { error: new Error("No MFA factor found") };
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError || !challenge) return { error: challengeError || new Error("Failed to create MFA challenge") };
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code });
      if (verifyError) return { error: verifyError };
      setNeedsMfaVerification(false);
      setMfaFactorId(null);
      // Refresh session to get aal2
      const { data: { session: refreshedSession } } = await supabase.auth.getSession();
      if (refreshedSession) {
        setSession(refreshedSession);
        localStorage.setItem("trakalog_session_backup", JSON.stringify(refreshedSession));
      }
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("MFA verification failed") };
    }
  }, [mfaFactorId]);

  const signOut = useCallback(async () => {
    const currentUser = session?.user;
    if (currentUser) {
      supabase.rpc("write_audit_log", { _user_id: currentUser.id, _workspace_id: null, _action: "user.logout" }).then(() => {}).catch(() => {});
    }
    localStorage.removeItem("trakalog_was_auth");
    localStorage.removeItem("trakalog_session_backup");
    localStorage.removeItem("trakalog_active_workspace");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, needsMfaVerification, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, verifyMfa }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
