import { motion } from "framer-motion";
import { Music, FolderOpen, Users, TrendingUp, Play, Clock } from "lucide-react";

const stats = [
  { label: "Total Tracks", value: "1,247", icon: Music, change: "+12%" },
  { label: "Active Projects", value: "23", icon: FolderOpen, change: "+3" },
  { label: "Collaborators", value: "48", icon: Users, change: "+5" },
  { label: "This Month", value: "89", icon: TrendingUp, change: "+24%" },
];

const recentTracks = [
  { title: "Midnight Groove", artist: "JD × Kira", project: "Summer EP", duration: "3:42", status: "Draft" },
  { title: "Neon Lights", artist: "JD × Marco", project: "Singles 2026", duration: "4:11", status: "Review" },
  { title: "Faded Memory", artist: "JD", project: "Album Vol. 3", duration: "3:58", status: "Final" },
  { title: "Crystal Rain", artist: "JD × Alina", project: "Summer EP", duration: "3:24", status: "Draft" },
  { title: "Pulse", artist: "JD × Dex", project: "Singles 2026", duration: "2:59", status: "Final" },
];

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Review: "bg-brand-orange/15 text-brand-orange",
  Final: "bg-emerald-500/15 text-emerald-400",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function DashboardContent() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 lg:p-8 space-y-8 max-w-7xl"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, John</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening with your catalog.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <stat.icon className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-medium text-emerald-400">{stat.change}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent tracks */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Tracks</h2>
          <button className="text-sm text-primary hover:underline">View all</button>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-5 py-3 font-medium">Title</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Project</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Duration</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {recentTracks.map((track) => (
                  <tr key={track.title} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{track.title}</p>
                      <p className="text-xs text-muted-foreground">{track.artist}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{track.project}</td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {track.duration}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[track.status]}`}>
                        {track.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Play className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
