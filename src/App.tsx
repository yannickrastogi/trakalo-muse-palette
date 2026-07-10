import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlaylistProvider } from "@/contexts/PlaylistContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { TrackProvider } from "@/contexts/TrackContext";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { RadioPlayerProvider } from "@/contexts/RadioPlayerContext";
import { PitchProvider } from "@/contexts/PitchContext";
import { SharedLinksProvider } from "@/contexts/SharedLinksContext";
import { ContactsProvider } from "@/contexts/ContactsContext";
import { EngagementProvider } from "@/contexts/EngagementContext";
import { TrackReviewProvider } from "@/contexts/TrackReviewContext";
import { ApprovalProvider } from "@/contexts/ApprovalContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import SharedPlaylistView from "./pages/SharedPlaylistView";
import Stems from "./pages/Stems";
import Team from "./pages/Team";
import { lazy, Suspense, useEffect } from "react";
const Workspaces = lazy(() => import("./pages/Workspaces"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Catalog = lazy(() => import("./pages/Catalog"));
const TrackDetail = lazy(() => import("./pages/TrackDetail"));
const Pitch = lazy(() => import("./pages/Pitch"));
const SmartAR = lazy(() => import("./pages/SmartAR"));
const SharedLinkPage = lazy(() => import("./pages/SharedLinkPage"));
const Guide = lazy(() => import("./pages/Guide"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Access = lazy(() => import("./pages/Access"));
import SettingsPage from "./pages/SettingsPage";
import SharedLinks from "./pages/SharedLinks";
import SharedStemAccess from "./pages/SharedStemAccess";
import NotFound from "./pages/NotFound";
import NotificationCenter from "./pages/NotificationCenter";
import ApprovalQueue from "./pages/ApprovalQueue";
import AcceptInvitation from "./pages/AcceptInvitation";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import RadioPage from "./pages/Radio";
import StudioSession from "./pages/StudioSession";
import SignAgreement from "./pages/SignAgreement";
import LandingPage from "./pages/LandingPage";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { isAdminMode } from "./lib/adminMode";
import { safeLocalStorage } from "@/lib/safeStorage";

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (session) {
    // Check for stored redirect from OAuth flow
    const storedRedirect = safeLocalStorage.getItem("trakalog_auth_redirect");
    if (storedRedirect) {
      safeLocalStorage.removeItem("trakalog_auth_redirect");
      return <Navigate to={storedRedirect} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

// Single layout route for ALL protected pages: the provider stack mounts ONCE
// and stays mounted across navigation between protected routes (the <Outlet/>
// child swaps, the layout — and its providers — does not remount).
function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <OnboardingProvider>
      <WorkspaceProvider>
      <RoleProvider>
      <TeamProvider>
      <TrackProvider>
      <AudioPlayerProvider>
      <RadioPlayerProvider>
      <EngagementProvider>
      <TrackReviewProvider>
      <ApprovalProvider>
      <PitchProvider>
      <PlaylistProvider>
      <SharedLinksProvider>
      <ContactsProvider>
        <Outlet />
      </ContactsProvider>
      </SharedLinksProvider>
      </PlaylistProvider>
      </PitchProvider>
      </ApprovalProvider>
      </TrackReviewProvider>
      </EngagementProvider>
      </RadioPlayerProvider>
      </AudioPlayerProvider>
      </TrackProvider>
      </TeamProvider>
      </RoleProvider>
      </WorkspaceProvider>
      </OnboardingProvider>
    </ProtectedRoute>
  );
}

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const AdminApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<AdminLogin />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const MainApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes — no AuthProvider */}
          <Route path="/share/:slug" element={<Suspense fallback={<LazyFallback />}><SharedLinkPage /></Suspense>} />
          <Route path="/shared/:linkId" element={<SharedStemAccess />} />
          <Route path="/invite/:token" element={<AcceptInvitation />} />
          <Route path="/studio/:token" element={<StudioSession />} />
          <Route path="/sign/:token" element={<SignAgreement />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Auth-wrapped routes */}
          <Route element={<AuthLayout />}>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="/onboarding" element={<Suspense fallback={<LazyFallback />}><Onboarding /></Suspense>} />

            {/* Protected pages — single layout route, one provider stack mount */}
            <Route element={<ProtectedAppLayout />}>
              <Route path="/dashboard" element={<Index />} />
              <Route path="/tracks" element={<Suspense fallback={<LazyFallback />}><Catalog /></Suspense>} />
              <Route path="/track/:id" element={<Suspense fallback={<LazyFallback />}><TrackDetail /></Suspense>} />
              {/* Alias: /tracks/:id kept for backwards compatibility with older shared URLs */}
              <Route path="/tracks/:id" element={<Suspense fallback={<LazyFallback />}><TrackDetail /></Suspense>} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/playlist/shared/:playlistId" element={<SharedPlaylistView />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/stems" element={<Stems />} />
              <Route path="/pitch" element={<Suspense fallback={<LazyFallback />}><Pitch /></Suspense>} />
              <Route path="/smart-ar" element={<Suspense fallback={<LazyFallback />}><SmartAR /></Suspense>} />
              <Route path="/radio" element={<RadioPage />} />
              <Route path="/access" element={<Suspense fallback={<LazyFallback />}><Access /></Suspense>} />
              <Route path="/team" element={<Team />} />
              <Route path="/workspaces" element={<Suspense fallback={<LazyFallback />}><Workspaces /></Suspense>} />
              <Route path="/contacts" element={<Suspense fallback={<LazyFallback />}><Contacts /></Suspense>} />
              <Route path="/shared-links" element={<SharedLinks />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/workspace-settings" element={<Suspense fallback={<LazyFallback />}><WorkspaceSettings /></Suspense>} />
              <Route path="/notifications" element={<NotificationCenter />} />
              <Route path="/approvals" element={<ApprovalQueue />} />
              <Route path="/guide" element={<Suspense fallback={<LazyFallback />}><Guide /></Suspense>} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => {
  // Clear the chunk-reload guard once the app has mounted and stayed stable for
  // a moment. Delaying avoids a reload loop if a chunk is STILL stale right
  // after reloading (the ErrorBoundary would otherwise reload again immediately).
  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.removeItem("trakalog-chunk-reloads"); } catch { /* ignore */ }
    }, 5000);
    return () => clearTimeout(t);
  }, []);
  return isAdminMode() ? <AdminApp /> : <MainApp />;
};

export default App;
