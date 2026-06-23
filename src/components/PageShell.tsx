import { useState } from "react";
import { AppSidebar, MobileSidebar, MobileBottomNav } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PersistentPlayer } from "@/components/PersistentPlayer";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useRadioPlayer } from "@/contexts/RadioPlayerContext";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useIsMobile } from "@/hooks/use-mobile";

export function PageShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentTrack } = useAudioPlayer();
  const { isRadioActive } = useRadioPlayer();
  const isMobile = useIsMobile();
  useGlobalShortcuts();

  // A bottom bar is shown for either the catalog player or the radio mini-bar.
  // On mobile: bottom nav (52px) + bar (~56px if shown) + safe area
  // On desktop: bar (~56px if shown)
  const hasBottomBar = !!currentTrack || isRadioActive;
  const bottomPadding = isMobile
    ? hasBottomBar ? "pb-[120px]" : "pb-[60px]"
    : hasBottomBar ? "pb-16" : "";

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
