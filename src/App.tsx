import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

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
            <Route path="/shared/:linkId" element={<SharedStemAccess />} />
            <Route path="/" element={<ProtectedApp><Index /></ProtectedApp>} />
            <Route path="/tracks" element={<ProtectedApp><Catalog /></ProtectedApp>} />
            <Route path="/track/:id" element={<ProtectedApp><TrackDetail /></ProtectedApp>} />
            <Route path="/tracks/:id" element={<ProtectedApp><TrackDetail /></ProtectedApp>} />
            <Route path="/playlists" element={<ProtectedApp><Playlists /></ProtectedApp>} />
            <Route path="/playlist/:id" element={<ProtectedApp><PlaylistDetail /></ProtectedApp>} />
            <Route path="/stems" element={<ProtectedApp><Stems /></ProtectedApp>} />
            <Route path="/pitch" element={<ProtectedApp><Pitch /></ProtectedApp>} />
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
