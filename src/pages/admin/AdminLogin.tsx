import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminLogin() {
  const { session, loading, signInWithEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // If a session already exists at mount, verify admin and route accordingly
  useEffect(() => {
    if (loading || !session?.user?.id) return;
    let cancelled = false;
    setVerifying(true);
    supabase
      .rpc("is_platform_admin", { _user_id: session.user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Unable to verify admin status");
          signOut();
          return;
        }
        if (data === true) {
          navigate("/dashboard", { replace: true });
        } else {
          toast.error("Access denied — not a platform admin");
          signOut();
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id, navigate, signOut]);

  if (loading || verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // If we somehow render with a session and not in verifying state, send to dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) {
      toast.error(error.message || "Sign in failed");
      setSubmitting(false);
      return;
    }
    // The useEffect above will pick up the new session and verify admin status.
    // We keep submitting=true so the button stays disabled until that runs.
  };

  const handleGoogle = async () => {
    if (googleSubmitting) return;
    setGoogleSubmitting(true);
    // Stay on the current admin host (admin.trakalog.com in prod, localhost in dev).
    // The dashboard route re-checks is_platform_admin and signs out non-admins.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setGoogleSubmitting(false);
    }
    // On success, the browser navigates away — leave the button disabled.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "var(--gradient-brand)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold tracking-tight gradient-text font-[Sora]">TRAKALOG</h1>
          <span className="text-xs font-bold tracking-[0.4em] text-orange-500 uppercase">Admin</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Restricted access — platform administrators only.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 h-11 text-sm font-medium"
            onClick={handleGoogle}
            disabled={googleSubmitting || submitting}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleSubmitting ? "Redirecting..." : "Continue with Google"}
          </Button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground uppercase tracking-wider">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={submitting || googleSubmitting || !email || !password}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          admin.trakalog.com
        </p>
      </div>
    </div>
  );
}
