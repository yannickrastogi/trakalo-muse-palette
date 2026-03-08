import { motion } from "framer-motion";
import { Plus, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";

const pitches = [
  { track: "Velvet Hour", artist: "Kira Nomura", recipient: "Interscope Records", contact: "A&R — Jamie Lin", date: "Mar 2, 2026", status: "Under Review" },
  { track: "Soft Landing", artist: "Marco Silva", recipient: "Atlantic Records", contact: "A&R — David Park", date: "Feb 28, 2026", status: "Accepted" },
  { track: "Ghost Protocol", artist: "Dex Moraes × JVNE", recipient: "Anjunadeep", contact: "Label Manager", date: "Feb 25, 2026", status: "Declined" },
  { track: "Paper Moons", artist: "Kira Nomura × AYA", recipient: "Billie Eilish", contact: "Management — Darkroom", date: "Feb 20, 2026", status: "Accepted" },
  { track: "Daybreak", artist: "Kira Nomura", recipient: "Republic Records", contact: "A&R — Sarah Cho", date: "Feb 18, 2026", status: "Under Review" },
  { track: "Golden Frequency", artist: "Alina Voss × Marco", recipient: "Disclosure", contact: "Management — Method", date: "Feb 15, 2026", status: "Under Review" },
  { track: "Neon Pulse", artist: "JVNE × Alina Voss", recipient: "Warner Records", contact: "A&R — Tom Ellis", date: "Feb 10, 2026", status: "Accepted" },
];

const statusColors: Record<string, string> = {
  "Under Review": "bg-brand-orange/12 text-brand-orange",
  Accepted: "bg-emerald-500/12 text-emerald-400",
  Declined: "bg-destructive/12 text-destructive",
};

const statusIcons: Record<string, React.ElementType> = {
  "Under Review": Clock,
  Accepted: CheckCircle2,
  Declined: AlertCircle,
};

const stats = [
  { label: "Total Pitches", value: "42", sub: "+7 this month" },
  { label: "Accepted", value: "18", sub: "43% rate" },
  { label: "Under Review", value: "9", sub: "3 due this week" },
  { label: "Declined", value: "15", sub: "—" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

export default function Pitch() {
  const isMobile = useIsMobile();

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Pitch</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Track songs pitched to labels and artists</p>
          </div>
          <button className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start min-h-[44px]">
            <Plus className="w-3.5 h-3.5" /> New Pitch
          </button>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s) => (
            <motion.div key={s.label} variants={item} className="card-premium p-4 sm:p-5">
              <p className="text-xl sm:text-[28px] font-bold text-foreground tracking-tight leading-none">{s.value}</p>
              <p className="text-2xs sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 font-medium">{s.label}</p>
              <p className="text-2xs text-emerald-400/80 mt-0.5 sm:mt-1 font-semibold">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item}>
          {isMobile ? (
            <div className="space-y-2.5">
              {pitches.map((p, i) => {
                const StatusIcon = statusIcons[p.status];
                return (
                  <div key={i} className="card-premium p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <StatusIcon className={`w-4 h-4 ${p.status === "Accepted" ? "text-emerald-400" : p.status === "Declined" ? "text-destructive" : "text-brand-orange"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-[13px] tracking-tight">{p.track}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.artist}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">→ {p.recipient}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-2xs text-muted-foreground">{p.date}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${statusColors[p.status]}`}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Track</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">Pitched To</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">Contact</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden sm:table-cell">Date</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pitches.map((p, i) => {
                      const StatusIcon = statusIcons[p.status];
                      return (
                        <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                <StatusIcon className={`w-3.5 h-3.5 ${p.status === "Accepted" ? "text-emerald-400" : p.status === "Declined" ? "text-destructive" : "text-brand-orange"}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate text-[13px] tracking-tight">{p.track}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{p.artist}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{p.recipient}</td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{p.contact}</td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">{p.date}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${statusColors[p.status]}`}>{p.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
