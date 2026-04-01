import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, needsMfaVerification } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout: if loading takes more than 5 seconds, stop waiting
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Session exists but MFA pending — redirect to auth for verification
  if (session && needsMfaVerification) {
    window.location.href = "/auth";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Session exists — render app
  if (session) {
    return <>{children}</>;
  }

  // Still loading (and not timed out) — show spinner
  if (loading && !timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // No session and either loading=false or timed out — redirect to auth
  window.location.href = "/auth";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
