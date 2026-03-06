import { Search, Bell, Plus } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function TopBar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 w-full">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search tracks, projects, collaborators…"
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-4">
        <button className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Track</span>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
