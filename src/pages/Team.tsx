import { motion } from "framer-motion";
import { Users, Plus, Mail, MoreHorizontal } from "lucide-react";
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

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Team() {
  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team</h1>
            <p className="text-muted-foreground text-sm mt-1">{members.length} collaborators in your network</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-gradient-to-r from-brand-orange via-brand-pink to-brand-purple hover:opacity-90 transition-opacity shrink-0 self-start">
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        </motion.div>

        <motion.div variants={item}>
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-5 py-3.5 font-medium">Name</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden md:table-cell">Role</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden lg:table-cell">Email</th>
                    <th className="text-left px-5 py-3.5 font-medium hidden sm:table-cell">Tracks</th>
                    <th className="text-left px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.name} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-purple/30 to-brand-pink/30 flex items-center justify-center text-xs font-bold text-foreground/70 shrink-0">
                            {m.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span className="font-medium text-foreground">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{m.role}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{m.email}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{m.tracks}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${m.status === "Active" ? "bg-emerald-500/15 text-emerald-400" : "bg-brand-orange/15 text-brand-orange"}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
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
