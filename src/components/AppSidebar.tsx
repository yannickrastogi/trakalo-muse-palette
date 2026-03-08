import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Music,
  Layers,
  ListMusic,
  Send,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsMobile } from "@/hooks/use-mobile";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Tracks", icon: Music, url: "/tracks" },
  { title: "Stems", icon: Layers, url: "/stems" },
  { title: "Playlists", icon: ListMusic, url: "/playlists" },
  { title: "Pitch", icon: Send, url: "/pitch" },
  { title: "Team", icon: Users, url: "/team" },
  { title: "Settings", icon: Settings, url: "/settings" },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 py-5 px-3 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.title}
          to={item.url}
          end={item.url === "/"}
          className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all text-sm font-medium group min-h-[44px]"
          activeClassName="nav-active text-foreground"
          onClick={onNavigate}
        >
          <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors group-[.nav-active]:text-brand-orange" />
          <span className="tracking-tight">{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarLogo() {
  return (
    <div className="flex items-center gap-4 px-5 h-[88px] shrink-0">
      <img
        src={trakalogLogo}
        alt="Trakalog"
        className="w-14 h-14 rounded-xl object-contain shrink-0"
      />
      <div className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight gradient-text">
          TRAKALOG
        </span>
        <span className="text-[11px] text-muted-foreground mt-1 tracking-widest uppercase font-medium">
          Catalog Manager
        </span>
      </div>
    </div>
  );
}

export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-xl hover:bg-secondary/80 transition-colors text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center md:hidden"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarLogo />
        <div className="mx-5 h-px" style={{ background: "var(--gradient-brand-horizontal)", opacity: 0.15 }} />
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // On mobile, sidebar is hidden — use MobileSidebar sheet instead
  if (isMobile) return null;

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden z-30 hidden md:flex"
    >
      {/* Logo */}
      <div className="flex items-center gap-4 px-5 h-[88px] shrink-0">
        <img
          src={trakalogLogo}
          alt="Trakalog"
          className="w-14 h-14 rounded-xl object-contain shrink-0"
        />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col leading-none"
          >
            <span className="text-xl font-bold tracking-tight gradient-text">
              TRAKALOG
            </span>
            <span className="text-[11px] text-muted-foreground mt-1 tracking-widest uppercase font-medium">
              Catalog Manager
            </span>
          </motion.div>
        )}
      </div>

      {/* Gradient accent line */}
      <div className="mx-5 h-px" style={{ background: "var(--gradient-brand-horizontal)", opacity: 0.15 }} />

      {/* Nav */}
      <nav className="flex-1 py-5 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all text-sm font-medium group"
            activeClassName="nav-active text-foreground"
          >
            <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors group-[.nav-active]:text-brand-orange" />
            {!collapsed && <span className="tracking-tight">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mx-5 h-px" style={{ background: "var(--gradient-brand-horizontal)", opacity: 0.08 }} />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4.5 h-4.5" /> : <ChevronLeft className="w-4.5 h-4.5" />}
      </button>
    </motion.aside>
  );
}
