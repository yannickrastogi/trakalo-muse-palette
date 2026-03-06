import { motion } from "framer-motion";
import {
  Music,
  ListMusic,
  Users,
  Send,
  Play,
  Clock,
  Upload,
  Search,
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
  { title: "Velvet Hour", artist: "Kira Nomura", album: "Late Bloom EP", genre: "Neo-Soul", duration: "4:12", bpm: 92, key: "Ab Major", feel: ["emotional", "dreamy"], status: "Master", added: "2h ago" },
  { title: "Ghost Protocol", artist: "Dex Moraes × JVNE", album: "Singles 2026", genre: "Electronic", duration: "3:38", bpm: 128, key: "F# Minor", feel: ["energetic", "dark"], status: "Review", added: "5h ago" },
  { title: "Burning Chrome", artist: "Alina Voss", album: "Neon Archive", genre: "Synthwave", duration: "5:01", bpm: 118, key: "C Minor", feel: ["nostalgic", "driving"], status: "Draft", added: "8h ago" },
  { title: "Soft Landing", artist: "Marco Silva", album: "Ambient Vol. II", genre: "Ambient", duration: "6:44", bpm: 72, key: "D Major", feel: ["calm", "uplifting"], status: "Master", added: "1d ago" },
  { title: "Paper Moons", artist: "Kira Nomura × AYA", album: "Late Bloom EP", genre: "Indie Pop", duration: "3:22", bpm: 105, key: "Bb Major", feel: ["happy", "playful"], status: "Review", added: "1d ago" },
  { title: "Static Bloom", artist: "JVNE", album: "Singles 2026", genre: "Glitch Hop", duration: "2:59", bpm: 140, key: "E Minor", feel: ["aggressive", "experimental"], status: "Draft", added: "2d ago" },
];

const activity = [
  { icon: Star, text: "Kira Nomura starred \"Velvet Hour\" master", time: "12 min ago" },
  { icon: MessageSquare, text: "Dex left feedback on \"Ghost Protocol\" mix", time: "1h ago" },
  { icon: Upload, text: "You uploaded 3 stems to \"Burning Chrome\"", time: "3h ago" },
  { icon: Send, text: "Pitch sent to Spotify Editorial — \"Soft Landing\"", time: "6h ago" },
  { icon: TrendingUp, text: "\"Paper Moons\" reached 10K pre-saves", time: "1d ago" },
];

const quickActions = [
  { label: "Upload Track", icon: Upload, gradient: true },
  { label: "Create Playlist", icon: ListMusic },
  { label: "Invite Collaborator", icon: Users },
  { label: "New Pitch", icon: Send },
];

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Review: "bg-brand-orange/15 text-brand-orange",
  Master: "bg-emerald-500/15 text-emerald-400",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function DashboardContent() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 lg:p-8 space-y-8 max-w-[1400px]"
    >
      {/* Header row */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your catalog at a glance — March 6, 2026</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 w-64">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search tracks…"
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
          {/* Upload */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Track</span>
          </button>
        </div>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/25 transition-all group relative overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {/* Subtle gradient glow */}
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${stat.accent} opacity-[0.06] group-hover:opacity-[0.12] transition-opacity blur-2xl`} />
            <div className="flex items-center justify-between mb-3 relative">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <stat.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-[11px] text-emerald-400 font-medium">{stat.change}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent tracks — spans 2 cols */}
        <motion.div variants={item} className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Tracks</h2>
            <button className="text-sm text-primary hover:underline">View catalog</button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Track</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Genre</th>
                    <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Key</th>
                    <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">BPM</th>
                    <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Duration</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Mood</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTracks.map((track) => (
                    <tr key={track.title} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors group/row">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover/row:bg-primary/10 transition-colors shrink-0">
                            <Disc3 className="w-4 h-4 text-muted-foreground group-hover/row:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{track.genre}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs font-medium text-foreground/80">
                          <Music className="w-3 h-3 text-primary/70" />
                          {track.key}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell font-mono text-xs">{track.bpm}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {track.duration}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {track.feel.map((tag) => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/15 text-accent">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[track.status]}`}>
                          {track.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Play className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="w-4 h-4" />
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
          <motion.div variants={item} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium ${
                    action.gradient
                      ? "border-primary/20 bg-gradient-to-br from-primary/10 to-brand-pink/10 text-primary hover:border-primary/40 hover:from-primary/15 hover:to-brand-pink/15"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-secondary"
                  }`}
                  style={!action.gradient ? { boxShadow: "var(--shadow-card)" } : undefined}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs">{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Activity feed */}
          <motion.div variants={item} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Activity</h2>
              <button className="text-xs text-primary hover:underline">See all</button>
            </div>
            <div className="bg-card border border-border rounded-xl divide-y divide-border" style={{ boxShadow: "var(--shadow-card)" }}>
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground/90 leading-snug">{item.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{item.time}</p>
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
