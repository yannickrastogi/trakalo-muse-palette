import { useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const wasAuthenticatedRef = useRef(false);

  if (session) wasAuthenticatedRef.current = true;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Don't redirect if we were previously authenticated (transient null during revalidation)
  if (!session && !wasAuthenticatedRef.current) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
