import { Search, Bell } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function TopBar() {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-5 bg-background/60 backdrop-blur-md sticky top-0 z-20">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="flex items-center gap-2.5 bg-secondary/60 rounded-lg px-3 py-1.5 w-full border border-transparent focus-within:border-primary/20 transition-colors">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search…"
            className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded font-mono leading-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-4">
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
