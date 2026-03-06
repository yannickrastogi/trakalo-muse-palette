import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Music,
  ListMusic,
  Send,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import trakalogLogo from "@/assets/trakalog-logo.png";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Tracks", icon: Music, url: "/tracks" },
  { title: "Playlists", icon: ListMusic, url: "/playlists" },
  { title: "Pitch", icon: Send, url: "/pitch" },
  { title: "Team", icon: Users, url: "/team" },
  { title: "Settings", icon: Settings, url: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col border-r border-border bg-sidebar overflow-hidden z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-[4.5rem] border-b border-border shrink-0">
        <img
          src={trakalogLogo}
          alt="Trakalog"
          className="w-11 h-11 rounded-lg object-contain shrink-0"
        />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col leading-none"
          >
            <span className="text-[15px] font-bold tracking-tight gradient-text">
              TRAKALOG
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">
              Catalog Manager
            </span>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
            activeClassName="bg-sidebar-accent text-primary font-medium"
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
