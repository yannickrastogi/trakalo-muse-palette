import { motion } from "framer-motion";
import { Plus, MoreHorizontal } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const members = [
  { name: "Kira Nomura", role: "Artist / Writer", email: "kira@nightfallrecords.com", tracks: 24, status: "Active" },
  { name: "Dex Moraes", role: "Producer", email: "dex@dexmoraes.com", tracks: 18, status: "Active" },
  { name: "Alina Voss", role: "Artist / Vocalist", email: "alina@alinav.co", tracks: 12, status: "Active" },
  { name: "Marco Silva", role: "Engineer / Producer", email: "marco@studiosilva.io", tracks: 15, status: "Active" },
  { name: "JVNE", role: "Producer / DJ", email: "mgmt@jvne.music", tracks: 9, status: "Active" },
  { name: "AYA", role: "Writer / Topliner", email: "aya@songbird.pub", tracks: 6, status: "Invited" },
  { name: "Jun Tanaka", role: "Writer", email: "jun@tanaka.jp", tracks: 4, status: "Active" },
  { name: "Sterling Sound NYC", role: "Mastering Studio", email: "bookings@sterling.com", tracks: 8, status: "Active" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Team() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-5 lg:p-7 space-y-5 max-w-[1360px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Team</h1>
            <p className="text-muted-foreground text-[13px] mt-0.5">{members.length} collaborators in your network</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0 self-start">
            <Plus className="w-3.5 h-3.5" /> Invite Member
          </button>
        </motion.div>

        <motion.div variants={item}>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Tracks</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.name} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-purple/25 to-brand-pink/25 flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0">
                            {m.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="font-medium text-foreground text-[13px]">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-[12px]">{m.role}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-[11px]">{m.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-[12px]">{m.tracks}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${m.status === "Active" ? "bg-emerald-500/12 text-emerald-400" : "bg-brand-orange/12 text-brand-orange"}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <MoreHorizontal className="w-3.5 h-3.5" />
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
    </PageShell>
  );
}
