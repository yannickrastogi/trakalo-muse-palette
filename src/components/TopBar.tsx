import { Search, Bell } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function TopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 glass sticky top-0 z-20" style={{ borderBottom: '1px solid transparent', borderImage: 'linear-gradient(90deg, hsl(24 100% 55% / 0.15), hsl(330 80% 60% / 0.1), hsl(270 70% 55% / 0.05), transparent) 1' }}>
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-3.5 py-2 w-full border border-border/50 focus-brand transition-all">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search tracks, artists, playlists…"
            className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
          />
          <kbd className="hidden sm:inline-flex text-2xs text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded font-mono leading-none border border-border/50">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-4">
        <button className="relative p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-[17px] h-[17px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
        </button>
        <div className="w-px h-6 bg-border/60 mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
