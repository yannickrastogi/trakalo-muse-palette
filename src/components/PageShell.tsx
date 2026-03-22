import { useState } from "react";
import { AppSidebar, MobileSidebar, MobileBottomNav } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useIsMobile } from "@/hooks/use-mobile";

export function PageShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentTrack } = useAudioPlayer();
  const isMobile = useIsMobile();
  useGlobalShortcuts();

  // On mobile: bottom nav (52px) + player bar (~56px if playing) + safe area
  // On desktop: player bar (~56px if playing)
  const bottomPadding = isMobile
    ? currentTrack ? "pb-[120px]" : "pb-[60px]"
    : currentTrack ? "pb-16" : "";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className={"flex-1 overflow-auto " + bottomPadding}>
          {children}
        </main>
      </div>
      <PersistentPlayer />
      <MobileBottomNav />
      <WelcomeModal />
    </div>
  );
}
