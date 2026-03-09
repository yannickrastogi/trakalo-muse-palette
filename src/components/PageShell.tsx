import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { WelcomeModal } from "@/components/WelcomeModal";

export function PageShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentTrack } = useAudioPlayer();
  useGlobalShortcuts();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className={`flex-1 overflow-auto ${currentTrack ? "pb-16" : ""}`}>
          {children}
        </main>
      </div>
      <PersistentPlayer />
      <WelcomeModal />
    </div>
  );
}
