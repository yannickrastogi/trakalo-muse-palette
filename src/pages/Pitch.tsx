import { motion } from "framer-motion";
import { Send, Plus, CheckCircle2, AlertCircle, Clock, Music } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const pitches = [
  { track: "Velvet Hour", artist: "Kira Nomura", platform: "Spotify Editorial", playlist: "Neo Soul Lounge", date: "Mar 2, 2026", status: "Under Review" },
  { track: "Soft Landing", artist: "Marco Silva", platform: "Apple Music", playlist: "New in R&B", date: "Feb 28, 2026", status: "Accepted" },
  { track: "Ghost Protocol", artist: "Dex Moraes × JVNE", platform: "Tidal", playlist: "Rising Electronic", date: "Feb 25, 2026", status: "Declined" },
  { track: "Paper Moons", artist: "Kira Nomura × AYA", platform: "Amazon Music", playlist: "Fresh Indie", date: "Feb 20, 2026", status: "Accepted" },
  { track: "Daybreak", artist: "Kira Nomura", platform: "Deezer", playlist: "Morning Soul", date: "Feb 18, 2026", status: "Under Review" },
  { track: "Golden Frequency", artist: "Alina Voss × Marco", platform: "Spotify Editorial", playlist: "House Essentials", date: "Feb 15, 2026", status: "Under Review" },
  { track: "Neon Pulse", artist: "JVNE × Alina Voss", platform: "Apple Music", playlist: "Synthwave Nights", date: "Feb 10, 2026", status: "Accepted" },
];

const statusColors: Record<string, string> = {
  "Under Review": "bg-brand-orange/15 text-brand-orange",
  Accepted: "bg-emerald-500/15 text-emerald-400",
  Declined: "bg-destructive/15 text-destructive",
};

const statusIcons: Record<string, React.ElementType> = {
  "Under Review": Clock,
  Accepted: CheckCircle2,
  Declined: AlertCircle,
};

const stats = [
  { label: "Total Pitches", value: "42", change: "+7 this month" },
  { label: "Accepted", value: "18", change: "43% rate" },
  { label: "Under Review", value: "9", change: "3 due this week" },
  { label: "Declined", value: "15", change: "—" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Pitch() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pitch</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your playlist submissions and editorial pitches</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0 self-start">
            <Plus className="w-4 h-4" /> New Pitch
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <motion.div key={s.label} variants={item} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-[11px] text-emerald-400 mt-1">{s.change}</p>
            </motion.div>
          ))}
        </div>

        {/* Pitch table */}
        <motion.div variants={item}>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3.5 font-medium">Track</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Platform</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Playlist</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Date</th>
                    <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pitches.map((p, i) => {
                    const StatusIcon = statusIcons[p.status];
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                              <StatusIcon className={`w-3.5 h-3.5 ${p.status === "Accepted" ? "text-emerald-400" : p.status === "Declined" ? "text-destructive" : "text-brand-orange"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{p.track}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.artist}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{p.platform}</td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">{p.playlist}</td>
                        <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">{p.date}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
