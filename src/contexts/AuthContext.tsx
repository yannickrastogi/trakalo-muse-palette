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
      // During revalidation (tab switch), ignore transient null sessions.
      // Only clear session on an explicit SIGNED_OUT event.
      if (!newSession && event !== "SIGNED_OUT" && initializedRef.current) {
        return;
      }
      if (newSession) {
        const allowed = await checkWhitelist(newSession);
        if (!allowed) return;
      }
      setSession(newSession);
      setLoading(false);
      initializedRef.current = true;
    });

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (initSession) {
        const allowed = await checkWhitelist(initSession);
        if (!allowed) return;
      }
      setSession(initSession);
      setLoading(false);
      initializedRef.current = true;
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
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
    await supabase.auth.signOut();
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
