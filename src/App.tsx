import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlaylistProvider } from "@/contexts/PlaylistContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { TrackProvider } from "@/contexts/TrackContext";
import { PitchProvider } from "@/contexts/PitchContext";
import { SharedLinksProvider } from "@/contexts/SharedLinksContext";
import { ContactsProvider } from "@/contexts/ContactsContext";
import { EngagementProvider } from "@/contexts/EngagementContext";
import { TrackReviewProvider } from "@/contexts/TrackReviewContext";
import { ApprovalProvider } from "@/contexts/ApprovalContext";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
      <TeamProvider>
      <TrackProvider>
      <EngagementProvider>
      <TrackReviewProvider>
      <ApprovalProvider>
      <PitchProvider>
      <PlaylistProvider>
      <SharedLinksProvider>
      <ContactsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tracks" element={<Catalog />} />
            <Route path="/track/:id" element={<TrackDetail />} />
            <Route path="/tracks/:id" element={<TrackDetail />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlist/:id" element={<PlaylistDetail />} />
            <Route path="/stems" element={<Stems />} />
            <Route path="/pitch" element={<Pitch />} />
            <Route path="/team" element={<Team />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/shared-links" element={<SharedLinks />} />
            <Route path="/shared/:linkId" element={<SharedStemAccess />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/approvals" element={<ApprovalQueue />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ContactsProvider>
      </SharedLinksProvider>
      </PlaylistProvider>
      </PitchProvider>
      </ApprovalProvider>
      </TrackReviewProvider>
      </EngagementProvider>
      </TrackProvider>
      </TeamProvider>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
