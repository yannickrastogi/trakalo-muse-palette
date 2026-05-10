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

            <Button type="submit" className="w-full h-11" disabled={submitting || !email || !password}>
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
