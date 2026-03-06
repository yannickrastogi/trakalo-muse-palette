import { motion } from "framer-motion";
import { ListMusic, Plus, Play, MoreHorizontal, Music } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const playlists = [
  { name: "Summer EP — Final Selects", tracks: 8, duration: "32 min", updated: "2h ago", mood: "Uplifting" },
  { name: "Sync Pitches — Q2 2026", tracks: 14, duration: "52 min", updated: "1d ago", mood: "Cinematic" },
  { name: "Late Night Sessions", tracks: 22, duration: "1h 18 min", updated: "3d ago", mood: "Chill" },
  { name: "High Energy — Ads", tracks: 11, duration: "38 min", updated: "5d ago", mood: "Energetic" },
  { name: "Neo-Soul Collection", tracks: 19, duration: "1h 04 min", updated: "1w ago", mood: "Smooth" },
  { name: "Unreleased Vault", tracks: 31, duration: "1h 52 min", updated: "2w ago", mood: "Mixed" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Playlists() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
            <p className="text-muted-foreground text-sm mt-1">Organize and curate your track collections</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0 self-start">
            <Plus className="w-4 h-4" /> New Playlist
          </button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <motion.div
              key={pl.name}
              variants={item}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/25 transition-all cursor-pointer group"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-purple/20 via-brand-pink/15 to-brand-orange/20 flex items-center justify-center group-hover:from-brand-purple/30 group-hover:to-brand-orange/30 transition-colors">
                  <ListMusic className="w-5 h-5 text-foreground/50" />
                </div>
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{pl.name}</h3>
              <p className="text-xs text-muted-foreground">{pl.tracks} tracks · {pl.duration}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Updated {pl.updated}</span>
                <div className="flex items-center gap-1">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/15 text-accent">#{pl.mood}</span>
                  <button className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </PageShell>
  );
}
