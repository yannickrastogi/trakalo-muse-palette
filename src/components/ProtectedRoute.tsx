import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const hasEverHadSessionRef = useRef(false);

  if (session) {
    hasEverHadSessionRef.current = true;
    localStorage.setItem("trakalog_was_auth", "1");
  }

  // Still loading auth — show spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Never had a session and not loading — redirect
  if (!session && !hasEverHadSessionRef.current && !localStorage.getItem("trakalog_was_auth")) {
    window.location.href = "/auth";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // KEY FIX: Always render children. If session is temporarily null but we had one before,
  // keep children mounted so WorkspaceProvider doesn't lose its state.
  return <>{children}</>;
}
