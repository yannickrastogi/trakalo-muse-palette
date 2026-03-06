import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Music,
  ListMusic,
  Users,
  Send,
  Play,
  Pause,
  Clock,
  Upload,
  ArrowUpRight,
  Disc3,
  MessageSquare,
  Star,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { MiniWaveform } from "@/components/MiniWaveform";

const stats = [
  { label: "Total Tracks", value: "2,847", icon: Music, change: "+18 this week", accent: "from-brand-orange to-brand-pink", iconBg: "bg-brand-orange/10", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.06)", borderAccent: "hover:border-brand-orange/20" },
  { label: "Playlists", value: "64", icon: ListMusic, change: "+3 new", accent: "from-brand-pink to-brand-purple", iconBg: "bg-brand-pink/10", iconColor: "text-brand-pink", glowColor: "hsl(330 80% 60% / 0.06)", borderAccent: "hover:border-brand-pink/20" },
  { label: "Collaborators", value: "126", icon: Users, change: "+12 active", accent: "from-brand-purple to-brand-orange", iconBg: "bg-brand-purple/10", iconColor: "text-brand-purple", glowColor: "hsl(270 70% 55% / 0.06)", borderAccent: "hover:border-brand-purple/20" },
  { label: "Pending Pitches", value: "9", icon: Send, change: "4 due today", accent: "from-brand-orange to-brand-purple", iconBg: "bg-brand-orange/8", iconColor: "text-brand-orange", glowColor: "hsl(24 100% 55% / 0.04)", borderAccent: "hover:border-brand-orange/20" },
];

const recentTracks = [
  { title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Maj", mood: ["emotional", "dreamy"], status: "Available", language: "English", type: "Song" },
  { title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Min", mood: ["energetic", "dark"], status: "On Hold", language: "English", type: "Sample" },
  { title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Min", mood: ["nostalgic", "driving"], status: "Available", language: "Portuguese", type: "Song" },
  { title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Maj", mood: ["calm", "uplifting"], status: "Released", language: "Instrumental", type: "Instrumental" },
  { title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Maj", mood: ["happy", "playful"], status: "On Hold", language: "Japanese", type: "Acapella" },
];

const activity = [
  { icon: Star, text: "Kira Nomura starred \"Velvet Hour\" master", time: "12m ago" },
  { icon: MessageSquare, text: "Dex left feedback on \"Ghost Protocol\" mix", time: "1h ago" },
  { icon: Upload, text: "You uploaded 3 stems to \"Burning Chrome\"", time: "3h ago" },
  { icon: Send, text: "\"Soft Landing\" pitched to Atlantic Records — A&R", time: "6h ago" },
  { icon: TrendingUp, text: "\"Paper Moons\" reached 10K pre-saves", time: "1d ago" },
];

const quickActions = [
  { label: "Upload Track", icon: Upload, primary: true },
  { label: "New Playlist", icon: ListMusic },
  { label: "Invite Member", icon: Users },
  { label: "New Pitch", icon: Send },
];

const statusColors: Record<string, string> = {
  Available: "bg-emerald-500/12 text-emerald-400",
  "On Hold": "bg-brand-orange/12 text-brand-orange",
  Released: "bg-primary/12 text-primary",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export function DashboardContent() {
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-7 max-w-[1400px]">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your catalog at a glance — March 6, 2026</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className={`card-premium p-5 group relative overflow-hidden cursor-default ${stat.borderAccent}`}
          >
            {/* Ambient glow */}
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${stat.glowColor}, transparent 70%)` }}
            />
            <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${stat.accent} opacity-[0.15] group-hover:opacity-30 transition-opacity duration-500`} />

            <div className="flex items-center justify-between mb-3 relative">
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center transition-all duration-300`} style={{ boxShadow: `0 0 20px ${stat.glowColor}` }}>
                <stat.icon className={`w-[18px] h-[18px] ${stat.iconColor} transition-colors duration-300`} />
              </div>
              <ArrowUpRight className={`w-3.5 h-3.5 text-muted-foreground/20 group-hover:${stat.iconColor} transition-colors duration-300 opacity-0 group-hover:opacity-50`} />
            </div>
            <p className="text-[28px] font-bold text-foreground tracking-tight leading-none relative">{stat.value}</p>
            <div className="flex items-center justify-between mt-2 relative">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-xs text-emerald-400/80 font-medium">{stat.change}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent tracks */}
        <motion.div variants={item} className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground tracking-tight">Recent Tracks</h2>
            <Link to="/tracks" className="text-xs gradient-text hover:opacity-80 transition-opacity font-semibold tracking-tight">View all →</Link>
          </div>
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Type</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Genre</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Key</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">BPM</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Mood</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Language</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTracks.map((track) => (
                    <tr key={track.title} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors group/row cursor-pointer">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover/row:icon-brand transition-all shrink-0">
                            <Disc3 className="w-4 h-4 text-muted-foreground group-hover/row:text-brand-orange transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate text-[13px] tracking-tight">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">{track.type}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{track.genre}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-2xs font-semibold text-foreground/70">
                          <Music className="w-2.5 h-2.5 text-primary/50" />
                          {track.key}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell font-mono text-2xs">{track.bpm}</td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {track.mood.map((tag) => (
                            <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{track.language}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${statusColors[track.status]}`}>
                          {track.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick actions */}
          <motion.div variants={item} className="space-y-4">
            <h2 className="text-base font-semibold text-foreground tracking-tight">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-[13px] group ${
                    action.primary
                      ? "border-brand-orange/25 bg-brand-orange/8 text-brand-orange hover:bg-brand-orange/12 hover:border-brand-orange/40 gradient-border"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand-pink/20 hover:bg-secondary/40"
                  }`}
                  style={{ boxShadow: "var(--shadow-inner-glow)" }}
                >
                  <action.icon className="w-[18px] h-[18px] transition-colors" />
                  <span className="text-[11px] font-semibold tracking-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Activity */}
          <motion.div variants={item} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground tracking-tight">Activity</h2>
              <button className="text-xs gradient-text hover:opacity-80 transition-opacity font-semibold">See all</button>
            </div>
            <div className="card-premium divide-y divide-border/60 overflow-hidden">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground/85 leading-relaxed">{a.text}</p>
                    <p className="text-2xs text-muted-foreground mt-1 font-medium">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
