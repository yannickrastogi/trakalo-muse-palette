import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Music,
  ListMusic,
  Users,
  Send,
  Play,
  Clock,
  Upload,
  ArrowUpRight,
  Disc3,
  MessageSquare,
  Star,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";

const stats = [
  { label: "Total Tracks", value: "2,847", icon: Music, change: "+18 this week", accent: "from-primary to-brand-pink" },
  { label: "Playlists", value: "64", icon: ListMusic, change: "+3 new", accent: "from-brand-pink to-brand-purple" },
  { label: "Collaborators", value: "126", icon: Users, change: "+12 active", accent: "from-brand-purple to-primary" },
  { label: "Pending Pitches", value: "9", icon: Send, change: "4 due today", accent: "from-primary to-brand-orange" },
];

const recentTracks = [
  { title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Maj", mood: ["emotional", "dreamy"], status: "Master" },
  { title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Min", mood: ["energetic", "dark"], status: "Review" },
  { title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Min", mood: ["nostalgic", "driving"], status: "Draft" },
  { title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Maj", mood: ["calm", "uplifting"], status: "Master" },
  { title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Maj", mood: ["happy", "playful"], status: "Review" },
];

const activity = [
  { icon: Star, text: "Kira Nomura starred \"Velvet Hour\" master", time: "12m ago" },
  { icon: MessageSquare, text: "Dex left feedback on \"Ghost Protocol\" mix", time: "1h ago" },
  { icon: Upload, text: "You uploaded 3 stems to \"Burning Chrome\"", time: "3h ago" },
  { icon: Send, text: "Pitch sent to Spotify Editorial — \"Soft Landing\"", time: "6h ago" },
  { icon: TrendingUp, text: "\"Paper Moons\" reached 10K pre-saves", time: "1d ago" },
];

const quickActions = [
  { label: "Upload Track", icon: Upload, primary: true },
  { label: "New Playlist", icon: ListMusic },
  { label: "Invite Member", icon: Users },
  { label: "New Pitch", icon: Send },
];

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Review: "bg-brand-orange/12 text-brand-orange",
  Master: "bg-emerald-500/12 text-emerald-400",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function DashboardContent() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-5 lg:p-7 space-y-6 max-w-[1360px]">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">Your catalog at a glance — March 6, 2026</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-all group relative overflow-hidden cursor-default"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.accent} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity blur-2xl`} />
            <div className="flex items-center justify-between mb-2.5 relative">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/8 transition-colors">
                <stat.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight leading-none">{stat.value}</p>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-[11px] text-emerald-400/80 font-medium">{stat.change}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent tracks */}
        <motion.div variants={item} className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Recent Tracks</h2>
            <Link to="/tracks" className="text-[12px] text-primary/80 hover:text-primary transition-colors font-medium">View all →</Link>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Track</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Genre</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden lg:table-cell">Key</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden lg:table-cell">BPM</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Mood</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTracks.map((track) => (
                    <tr key={track.title} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors group/row cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center group-hover/row:bg-primary/8 transition-colors shrink-0">
                            <Disc3 className="w-3.5 h-3.5 text-muted-foreground group-hover/row:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate text-[13px]">{track.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-[12px]">{track.genre}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[11px] font-medium text-foreground/70">
                          <Music className="w-2.5 h-2.5 text-primary/60" />
                          {track.key}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell font-mono text-[11px]">{track.bpm}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[140px]">
                          {track.mood.map((tag) => (
                            <span key={tag} className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent/80">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[track.status]}`}>
                          {track.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
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
        <div className="space-y-5">
          {/* Quick actions */}
          <motion.div variants={item} className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border transition-all text-[13px] ${
                    action.primary
                      ? "border-primary/15 bg-primary/6 text-primary hover:bg-primary/10 hover:border-primary/25"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/15 hover:bg-secondary/50"
                  }`}
                >
                  <action.icon className="w-4 h-4" />
                  <span className="text-[11px] font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Activity */}
          <motion.div variants={item} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Activity</h2>
              <button className="text-[11px] text-primary/80 hover:text-primary transition-colors font-medium">See all</button>
            </div>
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3.5 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <a.icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-foreground/85 leading-relaxed">{a.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
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
