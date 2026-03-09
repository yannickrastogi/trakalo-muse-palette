import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Users, Mail, Building2, Download, Calendar, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useContacts } from "@/contexts/ContactsContext";
import { format } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Contacts() {
  const { contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const roles = useMemo(() => [...new Set(contacts.map((c) => c.role))].sort(), [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.organization.toLowerCase().includes(q)
      );
    }
    if (roleFilter) {
      result = result.filter((c) => c.role === roleFilter);
    }
    return result;
  }, [contacts, search, roleFilter]);

  const formatDate = (iso: string) => {
    try { return format(new Date(iso), "MMM d, yyyy"); } catch { return "—"; }
  };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Contacts</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              {contacts.length} contacts collected from shared links
            </p>
          </div>
        </motion.div>

        {/* Search & filters */}
        <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2.5 flex-1 border border-border/50 focus-brand transition-all">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or organization…"
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {roles.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border overflow-x-auto no-scrollbar">
              <button
                onClick={() => setRoleFilter("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  !roleFilter ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                All ({contacts.length})
              </button>
              {roles.map((r) => {
                const count = contacts.filter((c) => c.role === r).length;
                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      roleFilter === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {r} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Table */}
        <motion.div variants={item} className="card-premium overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl icon-brand flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No contacts yet</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
                Contacts will appear here when recipients access your shared stem links.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Organization</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Role</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Tracks</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Last Interaction</th>
                    <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange/30 to-brand-purple/30 flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                          <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell text-xs">{c.email}</td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{c.organization}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground">
                          {c.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                        {c.tracksDownloaded.length} track{c.tracksDownloaded.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                        {formatDate(c.lastDownload)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                          <Download className="w-3 h-3 text-muted-foreground" />
                          {c.totalDownloads}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
