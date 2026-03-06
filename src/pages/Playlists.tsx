import { motion } from "framer-motion";
import { ListMusic, Plus, Play, MoreHorizontal } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const playlists = [
  { name: "Summer EP — Final Selects", tracks: 8, duration: "32 min", updated: "2h ago", mood: "Uplifting" },
  { name: "Sync Pitches — Q2 2026", tracks: 14, duration: "52 min", updated: "1d ago", mood: "Cinematic" },
  { name: "Late Night Sessions", tracks: 22, duration: "1h 18m", updated: "3d ago", mood: "Chill" },
  { name: "High Energy — Ads", tracks: 11, duration: "38 min", updated: "5d ago", mood: "Energetic" },
  { name: "Neo-Soul Collection", tracks: 19, duration: "1h 04m", updated: "1w ago", mood: "Smooth" },
  { name: "Unreleased Vault", tracks: 31, duration: "1h 52m", updated: "2w ago", mood: "Mixed" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } } };

export default function Playlists() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Playlists</h1>
            <p className="text-muted-foreground text-sm mt-1">Organize and curate your track collections</p>
          </div>
          <button className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start">
            <Plus className="w-3.5 h-3.5" /> New Playlist
          </button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <motion.div key={pl.name} variants={item}
              className="card-premium p-5 group cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-purple/15 via-brand-pink/10 to-brand-orange/15 flex items-center justify-center group-hover:from-brand-purple/25 group-hover:to-brand-orange/25 transition-all duration-300">
                  <ListMusic className="w-[18px] h-[18px] text-foreground/35" />
                </div>
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1 truncate tracking-tight">{pl.name}</h3>
              <p className="text-xs text-muted-foreground">{pl.tracks} tracks · {pl.duration}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
                <span className="text-2xs text-muted-foreground font-medium">Updated {pl.updated}</span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{pl.mood}</span>
                  <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                    <Play className="w-3 h-3" />
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
