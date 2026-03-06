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
import trakalogWordmark from "@/assets/trakalog-wordmark.png";

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
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden z-30"
    >
      {/* Logo */}
      <div className="flex items-center px-5 h-[88px] shrink-0">
        {collapsed ? (
          <img
            src={trakalogLogo}
            alt="Trakalog"
            className="w-10 h-10 rounded-xl object-contain shrink-0 mx-auto"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col"
          >
            <img
              src={trakalogWordmark}
              alt="TRAKALOG"
              className="h-9 w-auto object-contain invert"
            />
            <span className="text-[11px] text-muted-foreground mt-0.5 tracking-widest uppercase font-medium ml-0.5">
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
            activeClassName="bg-sidebar-accent text-primary"
          >
            <item.icon className="w-[19px] h-[19px] shrink-0 transition-colors" />
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
