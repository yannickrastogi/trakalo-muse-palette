import { Search, Bell, Menu } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-6 glass sticky top-0 z-20" style={{ borderBottom: '1px solid transparent', borderImage: 'linear-gradient(90deg, hsl(24 100% 55% / 0.15), hsl(330 80% 60% / 0.1), hsl(270 70% 55% / 0.05), transparent) 1' }}>
      {/* Left: Hamburger + Search */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-secondary/80 transition-colors text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-3.5 py-2 w-full max-w-md border border-border/50 focus-brand transition-all">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder={isMobile ? t("topbar.searchShort") : t("topbar.search")}
            className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
          />
          {!isMobile && (
            <kbd className="hidden sm:inline-flex text-2xs text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded font-mono leading-none border border-border/50">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-2 sm:ml-4">
        <LanguageSwitcher />
        <button className="relative p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Bell className="w-[17px] h-[17px]" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full ring-2 ring-background" style={{ background: 'var(--gradient-brand-horizontal)' }} />
        </button>
        <div className="w-px h-6 bg-border/60 mx-0.5 sm:mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
