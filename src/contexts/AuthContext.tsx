import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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

  useEffect(() => {
    const checkWhitelist = async (session: Session | null) => {
      if (session?.user?.email && !isEmailWhitelisted(session.user.email)) {
        await supabase.auth.signOut();
        toast.error("Trakalog is currently in private beta. Request access at hello@trakalog.com");
        setSession(null);
        setLoading(false);
        return false;
      }
      return true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const allowed = await checkWhitelist(session);
        if (!allowed) return;
      }
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const allowed = await checkWhitelist(session);
        if (!allowed) return;
      }
      setSession(session);
      setLoading(false);
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
