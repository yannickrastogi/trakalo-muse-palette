import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Catalog from "./pages/Catalog";
import TrackDetail from "./pages/TrackDetail";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Stems from "./pages/Stems";
import Pitch from "./pages/Pitch";
import Team from "./pages/Team";
import SettingsPage from "./pages/SettingsPage";
import Contacts from "./pages/Contacts";
import SharedLinks from "./pages/SharedLinks";
import SharedStemAccess from "./pages/SharedStemAccess";
import NotFound from "./pages/NotFound";
import NotificationCenter from "./pages/NotificationCenter";
import ApprovalQueue from "./pages/ApprovalQueue";
import SharedLinkPage from "./pages/SharedLinkPage";
import AcceptInvitation from "./pages/AcceptInvitation";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SmartAR from "./pages/SmartAR";
import RadioPage from "./pages/Radio";
import StudioSession from "./pages/StudioSession";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient();

function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function ProtectedApp({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OnboardingProvider>
      <RoleProvider>
      <WorkspaceProvider>
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
      </WorkspaceProvider>
      </RoleProvider>
      </OnboardingProvider>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/share/:slug" element={<SharedLinkPage />} />
            <Route path="/shared/:linkId" element={<SharedStemAccess />} />
            <Route path="/invite/:token" element={<AcceptInvitation />} />
            <Route path="/studio/:token" element={<StudioSession />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="/dashboard" element={<ProtectedApp><Index /></ProtectedApp>} />
            <Route path="/tracks" element={<ProtectedApp><Catalog /></ProtectedApp>} />
            <Route path="/track/:id" element={<ProtectedApp><TrackDetail /></ProtectedApp>} />
            <Route path="/tracks/:id" element={<ProtectedApp><TrackDetail /></ProtectedApp>} />
            <Route path="/playlists" element={<ProtectedApp><Playlists /></ProtectedApp>} />
            <Route path="/playlist/:id" element={<ProtectedApp><PlaylistDetail /></ProtectedApp>} />
            <Route path="/stems" element={<ProtectedApp><Stems /></ProtectedApp>} />
            <Route path="/pitch" element={<ProtectedApp><Pitch /></ProtectedApp>} />
            <Route path="/smart-ar" element={<ProtectedApp><SmartAR /></ProtectedApp>} />
            <Route path="/radio" element={<ProtectedApp><RadioPage /></ProtectedApp>} />
            <Route path="/team" element={<ProtectedApp><Team /></ProtectedApp>} />
            <Route path="/contacts" element={<ProtectedApp><Contacts /></ProtectedApp>} />
            <Route path="/shared-links" element={<ProtectedApp><SharedLinks /></ProtectedApp>} />
            <Route path="/settings" element={<ProtectedApp><SettingsPage /></ProtectedApp>} />
            <Route path="/notifications" element={<ProtectedApp><NotificationCenter /></ProtectedApp>} />
            <Route path="/approvals" element={<ProtectedApp><ApprovalQueue /></ProtectedApp>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
