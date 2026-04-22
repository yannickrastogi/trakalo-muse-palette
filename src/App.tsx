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
import Stems from "./pages/Stems";
import Team from "./pages/Team";
import { lazy, Suspense } from "react";
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
    const storedRedirect = localStorage.getItem("trakalog_auth_redirect");
    if (storedRedirect) {
      localStorage.removeItem("trakalog_auth_redirect");
      return <Navigate to={storedRedirect} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function ProtectedApp({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OnboardingProvider>
      <WorkspaceProvider>
      <RoleProvider>
      <TeamProvider>
      <TrackProvider>
      <AudioPlayerProvider>
      <EngagementProvider>
      <TrackReviewProvider>
      <ApprovalProvider>
      <PitchProvider>
      <PlaylistProvider>
      <SharedLinksProvider>
      <ContactsProvider>
        {children}
      </ContactsProvider>
      </SharedLinksProvider>
      </PlaylistProvider>
      </PitchProvider>
      </ApprovalProvider>
      </TrackReviewProvider>
      </EngagementProvider>
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

const App = () => (
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
            <Route path="/dashboard" element={<ProtectedApp><Index /></ProtectedApp>} />
            <Route path="/tracks" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><Catalog /></Suspense></ProtectedApp>} />
            <Route path="/track/:id" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><TrackDetail /></Suspense></ProtectedApp>} />
            {/* Alias: /tracks/:id kept for backwards compatibility with older shared URLs */}
            <Route path="/tracks/:id" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><TrackDetail /></Suspense></ProtectedApp>} />
            <Route path="/playlists" element={<ProtectedApp><Playlists /></ProtectedApp>} />
            <Route path="/playlist/:id" element={<ProtectedApp><PlaylistDetail /></ProtectedApp>} />
            <Route path="/stems" element={<ProtectedApp><Stems /></ProtectedApp>} />
            <Route path="/pitch" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><Pitch /></Suspense></ProtectedApp>} />
            <Route path="/smart-ar" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><SmartAR /></Suspense></ProtectedApp>} />
            <Route path="/radio" element={<ProtectedApp><RadioPage /></ProtectedApp>} />
            <Route path="/team" element={<ProtectedApp><Team /></ProtectedApp>} />
            <Route path="/workspaces" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><Workspaces /></Suspense></ProtectedApp>} />
            <Route path="/contacts" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><Contacts /></Suspense></ProtectedApp>} />
            <Route path="/shared-links" element={<ProtectedApp><SharedLinks /></ProtectedApp>} />
            <Route path="/settings" element={<ProtectedApp><SettingsPage /></ProtectedApp>} />
            <Route path="/workspace-settings" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><WorkspaceSettings /></Suspense></ProtectedApp>} />
            <Route path="/notifications" element={<ProtectedApp><NotificationCenter /></ProtectedApp>} />
            <Route path="/approvals" element={<ProtectedApp><ApprovalQueue /></ProtectedApp>} />
            <Route path="/guide" element={<ProtectedApp><Suspense fallback={<LazyFallback />}><Guide /></Suspense></ProtectedApp>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
