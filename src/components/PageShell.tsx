import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

export function PageShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
