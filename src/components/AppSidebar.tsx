import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Music,
  ListMusic,
  Send,
  Users,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Link2,
  BookUser,
  Bell,
  CheckCircle,
  Sparkles,
  MoreHorizontal,
  Radio,
  LayoutGrid,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useRole } from "@/contexts/RoleContext";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";

const navItems = [
  { titleKey: "nav.dashboard", icon: LayoutDashboard, url: "/dashboard", permKey: null },
  { titleKey: "nav.tracks", icon: Music, url: "/tracks", permKey: null },
  { titleKey: "nav.playlists", icon: ListMusic, url: "/playlists", permKey: null },
  { titleKey: "nav.pitch", icon: Send, url: "/pitch", permKey: "canSendPitches" as const },
  { titleKey: "nav.smartAr", icon: Sparkles, url: "/smart-ar", permKey: null },
  { titleKey: "nav.radio", icon: Radio, url: "/radio", permKey: null },
  { titleKey: "nav.contacts", icon: Users, url: "/contacts", permKey: null },
  { titleKey: "nav.sharedLinks", icon: Link2, url: "/shared-links", permKey: null },
  { titleKey: "nav.workspaces", icon: LayoutGrid, url: "/workspaces", permKey: null },
  { titleKey: "nav.notifications", icon: Bell, url: "/notifications", permKey: null },
  { titleKey: "nav.approvals", icon: CheckCircle, url: "/approvals", permKey: "canManageTeam" as const },
  { titleKey: "nav.settings", icon: Settings, url: "/settings", permKey: "canAccessSettings" as const },
];

// Primary items for the bottom nav bar (mobile)
const bottomNavKeys = new Set([
  "nav.dashboard",
  "nav.tracks",
  "nav.playlists",
  "nav.pitch",
  "nav.smartAr",
]);

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { permissions } = useRole();
  const visibleItems = navItems.filter((item) => {
    if (!item.permKey) return true;
    return permissions[item.permKey];
  });
  return (
    <nav className="flex-1 py-5 px-3 space-y-1">
      {visibleItems.map((item) => (
        <NavLink
          key={item.titleKey}
          to={item.url}
          end={item.url === "/"}
          className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all text-sm font-medium group min-h-[44px]"
          activeClassName="nav-active text-foreground"
          onClick={onNavigate}
        >
          <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors group-[.nav-active]:text-brand-orange" />
          <span className="tracking-tight">{t(item.titleKey)}</span>
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
        <WorkspaceSwitcher onSwitch={() => onOpenChange(false)} />
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** Mobile bottom navigation bar — secondary items in a "More" drawer */
export function MobileBottomNav() {
  const { t } = useTranslation();
  const { permissions } = useRole();
  const [moreOpen, setMoreOpen] = useState(false);

  const allVisible = navItems.filter((item) => {
    if (!item.permKey) return true;
    return permissions[item.permKey];
  });

  const primaryItems = allVisible.filter((item) => bottomNavKeys.has(item.titleKey));
  const secondaryItems = allVisible.filter((item) => !bottomNavKeys.has(item.titleKey));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/60 md:hidden safe-area-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-1">
          {primaryItems.map((item) => (
            <NavLink
              key={item.titleKey}
              to={item.url}
              end={item.url === "/dashboard"}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[52px] min-w-[52px] text-muted-foreground transition-colors"
              activeClassName="nav-active text-brand-orange"
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-[60px]">{t(item.titleKey)}</span>
            </NavLink>
          ))}
          {secondaryItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[52px] min-w-[52px] text-muted-foreground transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight">{t("nav.more")}</span>
            </button>
          )}
        </div>
      </nav>

      {/* More drawer — bottom sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0 bg-card border-t border-border rounded-t-2xl max-h-[70vh]">
          <SheetTitle className="sr-only">More Navigation</SheetTitle>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mt-3 mb-2" />
          <nav className="px-3 pb-6 space-y-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
            {secondaryItems.map((item) => (
              <NavLink
                key={item.titleKey}
                to={item.url}
                end={item.url === "/"}
                className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-foreground hover:bg-secondary transition-all text-sm font-medium group min-h-[44px]"
                activeClassName="nav-active text-brand-orange"
                onClick={() => setMoreOpen(false)}
              >
                <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors group-[.nav-active]:text-brand-orange" />
                <span className="tracking-tight">{t(item.titleKey)}</span>
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("trakalog-sidebar-collapsed") === "1");
  const isMobile = useIsMobile();

  // Listen for settings changes
  useEffect(() => {
    const handler = (e: Event) => setCollapsed((e as CustomEvent).detail);
    window.addEventListener("trakalog-sidebar", handler);
    return () => window.removeEventListener("trakalog-sidebar", handler);
  }, []);
  const { t } = useTranslation();
  const { permissions } = useRole();

  const visibleItems = navItems.filter((item) => {
    if (!item.permKey) return true;
    return permissions[item.permKey];
  });
  if (isMobile) return null;

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden z-30 hidden md:flex"
    >
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

      <div className="mx-5 h-px" style={{ background: "var(--gradient-brand-horizontal)", opacity: 0.15 }} />

      <div className="pt-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav className="flex-1 py-5 px-3 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.titleKey}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all text-sm font-medium group"
            activeClassName="nav-active text-foreground"
          >
            <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors group-[.nav-active]:text-brand-orange" />
            {!collapsed && <span className="tracking-tight">{t(item.titleKey)}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mx-5 h-px" style={{ background: "var(--gradient-brand-horizontal)", opacity: 0.08 }} />
      <button
        onClick={() => { const next = !collapsed; setCollapsed(next); localStorage.setItem("trakalog-sidebar-collapsed", next ? "1" : "0"); }}
        className="flex items-center justify-center h-12 text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4.5 h-4.5" /> : <ChevronLeft className="w-4.5 h-4.5" />}
      </button>
    </motion.aside>
  );
}
