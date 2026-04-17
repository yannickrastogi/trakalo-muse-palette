import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, Building2, Download, X, FileText, FileSpreadsheet, ChevronDown, Send } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "react-i18next";
import { useContacts } from "@/contexts/ContactsContext";
import { usePitches } from "@/contexts/PitchContext";
import { CreatePitchModal, type PitchEntry } from "@/components/CreatePitchModal";
import { format, differenceInDays } from "date-fns";
import { generateContactListPdf } from "@/lib/pdf-generators";
import { exportContactsCsv, exportContactsXlsx } from "@/lib/contact-export";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const CANONICAL_ROLES: Record<string, string> = {
  artist: "Artist",
  manager: "Manager",
  producer: "Producer",
  "a&r": "A&R",
  "music director": "Music Director",
  publisher: "Publisher",
  "sync agent": "Sync Agent",
  songwriter: "Songwriter",
  musician: "Musician",
  assistant: "Assistant",
  "mix engineer": "Mix Engineer",
  "mastering engineer": "Mastering Engineer",
  pr: "PR",
  "video director": "Video Director",
  admin: "Admin",
  viewer: "Viewer",
  other: "Other",
};

function normalizeRole(role: string): string {
  if (!role) return "Other";
  const key = role.trim().toLowerCase();
  return CANONICAL_ROLES[key] || role.trim();
}

const roleColors: Record<string, string> = {
  Artist: "bg-brand-orange/12 text-brand-orange",
  Producer: "bg-brand-purple/12 text-brand-purple",
  "A&R": "bg-brand-pink/12 text-brand-pink",
  Manager: "bg-emerald-500/12 text-emerald-400",
  "Mix Engineer": "bg-sky-500/12 text-sky-400",
  "Mastering Engineer": "bg-sky-500/12 text-sky-400",
  Publisher: "bg-amber-500/12 text-amber-400",
};

function getRoleColor(role: string) {
  return roleColors[role] || "bg-secondary text-secondary-foreground";
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== "All";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={"flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap " + (isActive ? "border-2 border-brand-orange/40 text-brand-orange bg-card" : "border border-border text-muted-foreground hover:border-brand-pink/20 hover:text-foreground bg-card")}
      >
        <span>{isActive ? value : label}</span>
        <ChevronDown className={"w-3 h-3 shrink-0 transition-transform duration-200 " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-1.5 min-w-[140px] bg-card border border-border rounded-xl shadow-xl backdrop-blur-sm"
          >
            <div className="p-1">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={"w-full text-left px-4 py-2 rounded-lg text-[13px] transition-colors " + (value === opt ? "bg-brand-orange/10 text-brand-orange font-medium" : "text-foreground hover:bg-secondary/60")}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Contacts() {
  const { t } = useTranslation();
  const { contacts: rawContacts } = useContacts();
  const { addPitch } = usePitches();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [orgFilter, setOrgFilter] = useState("All");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pitchContact, setPitchContact] = useState<{ name: string; email: string; company: string } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Normalize roles on all contacts
  const contacts = useMemo(() => rawContacts.map((c) => ({ ...c, role: normalizeRole(c.role) })), [rawContacts]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const roles = useMemo(() => [...new Set(contacts.map((c) => c.role))].sort(), [contacts]);
  const roleOptions = useMemo(() => ["All", ...roles], [roles]);
  const organizations = useMemo(() => {
    const orgs = [...new Set(contacts.map((c) => c.organization).filter(Boolean))].sort();
    return ["All", ...orgs];
  }, [contacts]);

  const totalTracksShared = useMemo(() => {
    const allTracks = new Set<string>();
    contacts.forEach((c) => c.tracksDownloaded.forEach((t: string) => allTracks.add(t)));
    return allTracks.size;
  }, [contacts]);

  const totalDownloads = useMemo(() => contacts.reduce((s, c) => s + c.totalDownloads, 0), [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.firstName + " " + c.lastName).toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.organization.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "All") {
      result = result.filter((c) => c.role === roleFilter);
    }
    if (orgFilter !== "All") {
      result = result.filter((c) => c.organization === orgFilter);
    }
    return result;
  }, [contacts, search, roleFilter, orgFilter]);

  const formatRelativeDate = (iso: string) => {
    try {
      const date = new Date(iso);
      const days = differenceInDays(new Date(), date);
      if (days === 0) return t("contacts.justNow");
      if (days < 7) return t("contacts.daysAgo", { count: days });
      return format(date, "MMM d, yyyy");
    } catch {
      return "—";
    }
  };

  const handleExport = (type: "pdf" | "csv" | "xlsx") => {
    setShowExportMenu(false);
    const data = filtered.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      organization: c.organization,
      role: c.role,
      tracksDownloaded: c.tracksDownloaded,
      totalDownloads: c.totalDownloads,
      lastDownload: c.lastDownload,
    }));
    if (type === "pdf") generateContactListPdf(data);
    else if (type === "csv") exportContactsCsv(data);
    else exportContactsXlsx(data);
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success(t("contacts.emailCopied"));
  };

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("contacts.title")}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                  {t("contacts.contactsCount", { count: contacts.length })}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                  {t("contacts.tracksShared", { count: totalTracksShared })}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border/50 text-xs font-medium text-muted-foreground">
                  {t("contacts.totalDownloads", { count: totalDownloads })}
                </span>
              </div>
            </div>
            {/* Export button */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-brand px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 shrink-0 min-h-[44px] shadow-lg"
              >
                <Download className="w-4 h-4" />
                {t("contacts.exportList")}
                <ChevronDown className={"w-3.5 h-3.5 transition-transform " + (showExportMenu ? "rotate-180" : "")} />
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-xl overflow-hidden z-50"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="p-1.5">
                      <button
                        onClick={() => handleExport("pdf")}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/60 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium text-xs">{t("contacts.pdf")}</p>
                          <p className="text-[10px] text-muted-foreground">{t("contacts.pdfDesc")}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleExport("csv")}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/60 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-xs">{t("contacts.csv")}</p>
                          <p className="text-[10px] text-muted-foreground">{t("contacts.csvDesc")}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleExport("xlsx")}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/60 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-xs">{t("contacts.xlsx")}</p>
                          <p className="text-[10px] text-muted-foreground">{t("contacts.xlsxDesc")}</p>
                        </div>
                      </button>
                    </div>
                    <div className="px-3 py-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground text-center">
                        {t(filtered.length !== 1 ? "contacts.exportingPlural" : "contacts.exporting", { count: filtered.length })}
                        {roleFilter !== "All" && " (" + roleFilter + ")"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Search + Filters — all on one line */}
        <motion.div variants={item} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2 border border-border/50 focus-brand transition-all flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("contacts.searchPlaceholder")}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Role dropdown */}
          {roles.length > 0 && (
            <FilterSelect label={t("contacts.role")} value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
          )}
          {/* Organization dropdown */}
          {organizations.length > 1 && (
            <FilterSelect label={t("contacts.allOrganizations")} value={orgFilter} options={organizations} onChange={setOrgFilter} />
          )}
        </motion.div>

        {/* Desktop Table */}
        <motion.div variants={item} className="card-premium overflow-hidden hidden md:block">
          {contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Your contacts are built automatically when someone listens to your shared links or scans your studio QR code. You can also add them manually."
            />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl icon-brand flex items-center justify-center mb-5">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{t("contacts.noContacts")}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {t("contacts.adjustFilters") || "No contacts match your filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.name")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.role")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">{t("contacts.organization")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.engagement")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">{t("contacts.lastInteraction")}</th>
                    <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-secondary/40 transition-colors duration-200 cursor-pointer"
                      onClick={() => copyEmail(c.email)}
                    >
                      {/* Name + Email merged */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-xs font-semibold text-white shrink-0">
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate">{c.firstName} {c.lastName}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      {/* Role badge */}
                      <td className="px-4 py-3.5">
                        <span className={"inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold " + getRoleColor(c.role)}>
                          {c.role}
                        </span>
                      </td>
                      {/* Organization */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {c.organization && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {c.organization}
                          </span>
                        )}
                      </td>
                      {/* Engagement: tracks + downloads merged */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-muted-foreground">
                          {c.tracksDownloaded.length} {c.tracksDownloaded.length === 1 ? "track" : "tracks"} · {c.totalDownloads} {c.totalDownloads === 1 ? "download" : "downloads"}
                        </span>
                      </td>
                      {/* Last Interaction — relative */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatRelativeDate(c.lastDownload)}</span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPitchContact({ name: c.firstName + " " + c.lastName, email: c.email, company: c.organization });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                          title={t("contacts.sendPitch")}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">{t("contacts.sendPitch")}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {contacts.length === 0 ? (
            <motion.div variants={item}>
              <EmptyState
                icon={Users}
                title="No contacts yet"
                description="Your contacts are built automatically when someone listens to your shared links or scans your studio QR code. You can also add them manually."
              />
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div variants={item} className="card-premium">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl icon-brand flex items-center justify-center mb-5">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{t("contacts.noContacts")}</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm px-4">
                  {t("contacts.adjustFilters") || "No contacts match your filters."}
                </p>
              </div>
            </motion.div>
          ) : (
            filtered.map((c) => (
              <motion.div
                key={c.id}
                variants={item}
                className="card-premium p-4 space-y-3"
                onClick={() => copyEmail(c.email)}
              >
                {/* Top: avatar + name + role */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-xs font-semibold text-white shrink-0">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{c.firstName} {c.lastName}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    </div>
                  </div>
                  <span className={"inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 " + getRoleColor(c.role)}>
                    {c.role}
                  </span>
                </div>
                {/* Organization */}
                {c.organization && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {c.organization}
                  </div>
                )}
                {/* Stats + last interaction */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.tracksDownloaded.length} {c.tracksDownloaded.length === 1 ? "track" : "tracks"} · {c.totalDownloads} {c.totalDownloads === 1 ? "download" : "downloads"}</span>
                  <span>{formatRelativeDate(c.lastDownload)}</span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 pt-2 border-t border-border/30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPitchContact({ name: c.firstName + " " + c.lastName, email: c.email, company: c.organization });
                    }}
                    className="flex items-center gap-1.5 p-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[44px]"
                  >
                    <Send className="w-4 h-4" />
                    {t("contacts.sendPitch")}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Pitch Modal */}
      <CreatePitchModal
        open={!!pitchContact}
        onOpenChange={(open) => { if (!open) setPitchContact(null); }}
        onCreate={(pitch: PitchEntry) => { addPitch(pitch); setPitchContact(null); }}
        initialRecipientName={pitchContact?.name}
        initialRecipientEmail={pitchContact?.email}
        initialRecipientCompany={pitchContact?.company}
      />
    </PageShell>
  );
}
