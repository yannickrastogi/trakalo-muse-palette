import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, UserPlus, Building2, Download, X, FileText, FileSpreadsheet, ChevronDown, Send, Trash2, Loader2, Pencil, Music, CheckSquare } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { AddContactModal } from "@/components/AddContactModal";
import { ContactDetailSheet, type ContactTrackPreview } from "@/components/ContactDetailSheet";
import { useTranslation } from "react-i18next";
import { useContacts, type Contact } from "@/contexts/ContactsContext";
import { ArtistAliasesTab } from "@/components/ArtistAliasesTab";
import { useTrack } from "@/contexts/TrackContext";
import { usePitches } from "@/contexts/PitchContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { CreatePitchModal, type PitchEntry } from "@/components/CreatePitchModal";
import { FEATURES } from "@/config/features";
import { format, differenceInDays } from "date-fns";
import { generateContactListPdf, exportContactCardPdf } from "@/lib/pdf-generators";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { exportContactsCsv, exportContactsXlsx } from "@/lib/contact-export";
import { toast } from "sonner";
import { INDUSTRY_ROLES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  Songwriter: "bg-rose-500/12 text-rose-400",
  Musician: "bg-teal-500/12 text-teal-400",
  "A&R": "bg-brand-pink/12 text-brand-pink",
  Manager: "bg-emerald-500/12 text-emerald-400",
  "Recording Engineer": "bg-sky-500/12 text-sky-400",
  "Mix Engineer": "bg-sky-500/12 text-sky-400",
  "Mastering Engineer": "bg-sky-500/12 text-sky-400",
  Publisher: "bg-amber-500/12 text-amber-400",
};

// Canonical order for computed role chips (manual roles come first, then these in this order)
const COMPUTED_ROLE_ORDER = [
  "Artist", "Songwriter", "Producer", "Musician",
  "Recording Engineer", "Mix Engineer", "Mastering Engineer",
] as const;

// Maps a track credit jsonb key to a canonical role tag. Engineer keys use the EXACT
// INDUSTRY_ROLES strings so the role filter dropdown matches ("Mix Engineer", "Mastering Engineer").
// "Recording Engineer" isn't in INDUSTRY_ROLES so it won't appear in the filter dropdown,
// but the chip is still displayed and search still matches it.
// customProduction is intentionally skipped (user-defined arbitrary roles).
const CREDIT_KEY_TO_ROLE: Record<string, string> = {
  songwriters: "Songwriter",
  producers: "Producer",
  vocalsBy: "Musician",
  backgroundVocalsBy: "Musician",
  drumsBy: "Musician",
  synthsBy: "Musician",
  keysBy: "Musician",
  guitarsBy: "Musician",
  bassBy: "Musician",
  programmingBy: "Musician",
  recordingEngineer: "Recording Engineer",
  mixingEngineer: "Mix Engineer",
  masteringEngineer: "Mastering Engineer",
};

// Canonical role from a split's role string (case-insensitive).
function canonicalSplitRole(role: string): string | null {
  const r = role.trim().toLowerCase();
  if (r === "songwriter") return "Songwriter";
  if (r === "producer") return "Producer";
  if (r === "artist") return "Artist";
  if (r === "musician") return "Musician";
  return null;
}

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
  const { contacts: rawContacts, refreshContacts, aliasesByContactId } = useContacts();
  const { addPitch } = usePitches();
  const { user } = useAuth();
  const { accessLevel } = useRole();
  const { activeWorkspace } = useWorkspace();
  const isAdmin = accessLevel === "admin";
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [roleFilter, setRoleFilter] = useState("All");
  const [orgFilter, setOrgFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pitchContact, setPitchContact] = useState<{ name: string; email: string; company: string } | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  // Multi-select bulk delete
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"contacts" | "aliases">("contacts");

  // Focus support — TopBar "See contact" navigates here with ?focus=<contactId>
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const setRowRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const handleDeleteContact = async () => {
    if (!deleteTarget || !user || isDeleting) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>)("delete_contact", {
        _user_id: user.id,
        _contact_id: deleteTarget.id,
      });
      if (error) {
        console.error("Error deleting contact:", error);
        toast.error(t("contacts.failedToDeleteContact"));
        return;
      }
      toast.success(t("contacts.contactDeleted"));
      setDeleteTarget(null);
      await refreshContacts();
    } catch (err) {
      console.error("Unexpected error deleting contact:", err);
      toast.error(t("contacts.failedToDeleteContact"));
    } finally {
      setIsDeleting(false);
    }
  };

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !user || !activeWorkspace || isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const { error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>)("delete_contacts", {
        _user_id: user.id,
        _workspace_id: activeWorkspace.id,
        _ids: Array.from(selectedIds),
      });
      if (error) {
        console.error("Error bulk-deleting contacts:", error);
        toast.error(t("contacts.failedToDeleteContacts"));
        return;
      }
      toast.success(t("contacts.contactsDeleted", { count: selectedIds.size }));
      setBulkConfirmOpen(false);
      exitSelectionMode();
      await refreshContacts();
    } catch (err) {
      console.error("Unexpected error bulk-deleting contacts:", err);
      toast.error(t("contacts.failedToDeleteContacts"));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Normalize roles on all contacts
  const contacts = useMemo(() => rawContacts.map((c) => ({ ...c, role: normalizeRole(c.role) })), [rawContacts]);

  // Compute canonical roles per person from their appearances in workspace tracks.
  // Key = full name OR stage name (lowercase, trimmed). Both registered independently so
  // a track-side mention of either tags the corresponding contact.
  const { tracks } = useTrack();
  const computedByPerson = useMemo(() => {
    const map = new Map<string, { roles: Set<string>; trackIds: Set<string> }>();
    const add = (rawName: unknown, role: string, trackId: string) => {
      if (typeof rawName !== "string") return;
      const key = rawName.trim().toLowerCase();
      if (!key) return;
      let entry = map.get(key);
      if (!entry) { entry = { roles: new Set(), trackIds: new Set() }; map.set(key, entry); }
      entry.roles.add(role);
      if (trackId) entry.trackIds.add(trackId);
    };
    for (const track of tracks) {
      const tid = track.uuid || "";
      // track.artist (comma-separated string) → "Artist"
      (track.artist || "").split(",").forEach((s) => add(s, "Artist", tid));
      // track.featuredArtists[] → "Artist"
      if (Array.isArray(track.featuredArtists)) track.featuredArtists.forEach((s) => add(s, "Artist", tid));
      // splits[]: role-mapped, on both name and stage_name
      const splits = Array.isArray(track.splits) ? track.splits : [];
      for (const s of splits) {
        const maybeRoles = (s as unknown as Record<string, unknown>).roles;
        const arr = Array.isArray(maybeRoles)
          ? (maybeRoles as string[])
          : (s?.role ? [s.role as string] : []);
        for (const r of arr) {
          const canon = canonicalSplitRole(r);
          if (!canon) continue;
          add(s?.name, canon, tid);
          add((s as unknown as { stage_name?: string })?.stage_name, canon, tid);
        }
      }
      // credits.{songwriters, producers, 8 performer keys, 3 engineers}
      const credits = (track.credits || {}) as Record<string, unknown>;
      for (const [key, role] of Object.entries(CREDIT_KEY_TO_ROLE)) {
        const raw = credits[key];
        if (Array.isArray(raw)) (raw as unknown[]).forEach((v) => add(v, role, tid));
      }
      // customPerformers[].values → "Musician" (customProduction intentionally skipped)
      const cp = credits.customPerformers;
      if (Array.isArray(cp)) {
        (cp as Array<{ values?: unknown }>).forEach((entry) => {
          if (Array.isArray(entry?.values)) entry.values.forEach((v) => add(v, "Musician", tid));
        });
      }
    }
    return map;
  }, [tracks]);

  // Returns the display roles for a contact: manual roles first (in their original order),
  // then computed roles in canonical order. Dedup case-insensitive, preserves original casing.
  const getDisplayRoles = useCallback((c: Contact): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    // Manual roles (comma-split)
    for (const tok of (c.role || "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const k = tok.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(tok);
    }
    // Computed roles — lookup by fullName AND stageName, then sort by canonical order
    const fullName = (c.firstName + " " + c.lastName).trim().toLowerCase();
    const stage = (c.stageName || "").trim().toLowerCase();
    const computed = new Set<string>();
    if (fullName) (computedByPerson.get(fullName)?.roles || new Set<string>()).forEach((r) => computed.add(r));
    if (stage)    (computedByPerson.get(stage)?.roles    || new Set<string>()).forEach((r) => computed.add(r));
    for (const r of COMPUTED_ROLE_ORDER) {
      if (!computed.has(r)) continue;
      const k = r.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }, [computedByPerson]);

  // Returns the count of distinct workspace tracks where this contact appears,
  // unioning lookups by full name AND stage name (a track tagged via both keys counts once).
  const getCollaborationsCount = useCallback((c: Contact): number => {
    const fullName = (c.firstName + " " + c.lastName).trim().toLowerCase();
    const stage = (c.stageName || "").trim().toLowerCase();
    const ids = new Set<string>();
    if (fullName) (computedByPerson.get(fullName)?.trackIds || new Set<string>()).forEach((id) => ids.add(id));
    if (stage)    (computedByPerson.get(stage)?.trackIds    || new Set<string>()).forEach((id) => ids.add(id));
    return ids.size;
  }, [computedByPerson]);

  // Returns track previews (id/title/artist/coverUrl) for the drawer Collaborations section.
  const getContactTracks = useCallback((c: Contact): ContactTrackPreview[] => {
    const fullName = (c.firstName + " " + c.lastName).trim().toLowerCase();
    const stage = (c.stageName || "").trim().toLowerCase();
    const ids = new Set<string>();
    if (fullName) (computedByPerson.get(fullName)?.trackIds || new Set<string>()).forEach((id) => ids.add(id));
    if (stage)    (computedByPerson.get(stage)?.trackIds    || new Set<string>()).forEach((id) => ids.add(id));
    const previews: ContactTrackPreview[] = [];
    for (const id of ids) {
      const t = tracks.find((tr) => tr.uuid === id);
      if (!t) continue;
      previews.push({ id: t.uuid, title: t.title || "Untitled", artist: t.artist || "", coverUrl: t.coverImage });
    }
    return previews;
  }, [computedByPerson, tracks]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Consume ?focus=<contactId> from URL: scroll the matching contact into view,
  // highlight it for 3s, then clean the URL so back-nav doesn't re-trigger.
  useEffect(() => {
    const targetId = searchParams.get("focus");
    if (!targetId) return;
    if (contacts.length === 0) return; // wait until contacts load
    const exists = contacts.some((c) => c.id === targetId);
    if (!exists) {
      // Contact deleted / not in this workspace — silently clear the param
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete("focus"); return n; }, { replace: true });
      return;
    }
    setFocusedId(targetId);
    // Defer scroll a tick so the row is mounted with its ref
    const scrollTimer = setTimeout(() => {
      const el = rowRefs.current.get(targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const clearTimer = setTimeout(() => setFocusedId(null), 3000);
    // Clear the URL param now (we've captured the intent in state)
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete("focus"); return n; }, { replace: true });
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length]);

  const roles = INDUSTRY_ROLES;
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
          c.organization.toLowerCase().includes(q) ||
          (c.stageName || "").toLowerCase().includes(q) ||
          (c.publisher || "").toLowerCase().includes(q) ||
          (c.ipi || "").toLowerCase().includes(q) ||
          (c.pro || "").toLowerCase().includes(q) ||
          (c.role || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q) ||
          (c.country || "").toLowerCase().includes(q) ||
          getDisplayRoles(c).some((r) => r.toLowerCase().includes(q))
      );
    }
    if (roleFilter !== "All") {
      // Match against displayRoles (manual + computed from track appearances), case-insensitive
      const needle = roleFilter.toLowerCase();
      result = result.filter((c) =>
        getDisplayRoles(c).some((r) => r.toLowerCase() === needle)
      );
    }
    if (orgFilter !== "All") {
      result = result.filter((c) => c.organization === orgFilter);
    }
    if (countryFilter.trim()) {
      const cq = countryFilter.toLowerCase().trim();
      result = result.filter((c) => (c.country || "").toLowerCase().includes(cq));
    }
    if (cityFilter.trim()) {
      const cq = cityFilter.toLowerCase().trim();
      result = result.filter((c) => (c.city || "").toLowerCase().includes(cq));
    }
    // Alphabetical order: last name → stage name → first name → email.
    // Case- and accent-insensitive via localeCompare(sensitivity: "base").
    const sortKey = (c: (typeof result)[number]) =>
      (c.lastName || "").trim() || (c.stageName || "").trim() || (c.firstName || "").trim() || (c.email || "");
    result = result.slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { sensitivity: "base" }));
    return result;
  }, [contacts, search, roleFilter, orgFilter, countryFilter, cityFilter, getDisplayRoles]);

  // Keep selection in sync with what's visible: never bulk-delete contacts hidden by filters
  useEffect(() => {
    if (!selectionMode) return;
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((c) => c.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [filtered, selectionMode]);

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
      // Export the full display roles (manual + computed), not just the manual c.role
      role: getDisplayRoles(c).join(", "),
      stageName: c.stageName || "",
      publisher: c.publisher || "",
      ipi: c.ipi || "",
      pro: c.pro || "",
      phone: c.phone || "",
      city: c.city || "",
      country: c.country || "",
      collaborationsCount: getCollaborationsCount(c),
      tracksDownloaded: c.tracksDownloaded,
      totalDownloads: c.totalDownloads,
      lastDownload: c.lastDownload,
    }));
    if (type === "pdf") generateContactListPdf(data, activeWorkspace?.name || "Workspace");
    else if (type === "csv") exportContactsCsv(data);
    else exportContactsXlsx(data);
  };

  const handleDownloadContactCard = (c: Contact, roles: string[]) => {
    try {
      exportContactCardPdf({
        contact: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          organization: c.organization,
          role: roles.join(", "),
          stageName: c.stageName || "",
          publisher: c.publisher || "",
          ipi: c.ipi || "",
          pro: c.pro || "",
          phone: c.phone || "",
          city: c.city || "",
          country: c.country || "",
          collaborationsCount: getCollaborationsCount(c),
          tracksDownloaded: c.tracksDownloaded,
          totalDownloads: c.totalDownloads,
          lastDownload: c.lastDownload,
        },
        workspaceName: activeWorkspace?.name || "Workspace",
        displayRoles: roles,
      });
      toast.success(t("contacts.contactCardDownloaded"));
    } catch (err) {
      console.error("Failed to generate contact card PDF", err);
      toast.error(t("contacts.couldNotGeneratePdf"));
    }
  };

  return (
    <PageShell>
      {/* Tab switcher (Contacts / Artist Aliases) */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 max-w-[1400px]">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/50">
          <button
            onClick={() => setActiveTab("contacts")}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " + (activeTab === "contacts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t("contacts.title")}
          </button>
          <button
            onClick={() => setActiveTab("aliases")}
            className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " + (activeTab === "aliases" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t("contacts.artistAliases")}
          </button>
        </div>
      </div>

      {activeTab === "aliases" ? (
        <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
          <motion.div variants={item}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("contacts.artistAliases")}</h1>
            </div>
          </motion.div>
          <motion.div variants={item}>
            <ArtistAliasesTab onOpenContact={(c) => setDetailContact(c)} />
          </motion.div>
        </motion.div>
      ) : (
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
            <div className="flex items-center gap-2.5">
              {/* Select / Cancel selection mode (admins only) */}
              {isAdmin && contacts.length > 0 && (
                selectionMode ? (
                  <button
                    onClick={exitSelectionMode}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 shrink-0 min-h-[44px] border border-border text-foreground hover:bg-secondary/60 transition-all"
                  >
                    <X className="w-4 h-4" />
                    {t("contacts.cancel")}
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 shrink-0 min-h-[44px] border border-border text-foreground hover:bg-secondary/60 transition-all"
                  >
                    <CheckSquare className="w-4 h-4" />
                    {t("contacts.select")}
                  </button>
                )
              )}
              {/* Add Contact button */}
              <button
                onClick={() => setAddContactOpen(true)}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2 shrink-0 min-h-[44px] bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 hover:from-orange-600 hover:via-pink-600 hover:to-purple-600 text-white transition-all"
              >
                <UserPlus className="w-4 h-4" />
                {t("contacts.addContact")}
              </button>
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
          </div>
        </motion.div>

        {/* Search + Filters — all on one line */}
        <motion.div variants={item} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-4 py-2 border border-border/50 focus-brand transition-all flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => setSearch(e.target.value), 300);
              }}
              placeholder={t("contacts.searchPlaceholder")}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(""); setSearch(""); clearTimeout(searchTimerRef.current); }} className="text-muted-foreground hover:text-foreground transition-colors">
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
          {/* Country free-text filter — always visible for consistency with City */}
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3 py-2 border border-border/50 focus-within:border-primary/30 transition-all min-w-[140px] max-w-[180px]">
            <input
              type="text"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              placeholder={t("contacts.countryPlaceholder")}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {countryFilter && (
              <button onClick={() => setCountryFilter("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* City free-text filter */}
          <div className="flex items-center gap-2.5 bg-secondary/50 rounded-xl px-3 py-2 border border-border/50 focus-within:border-primary/30 transition-all min-w-[140px] max-w-[180px]">
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder={t("contacts.cityPlaceholder")}
              className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
            />
            {cityFilter && (
              <button onClick={() => setCityFilter("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Desktop Table */}
        <motion.div variants={item} className="card-premium overflow-hidden hidden md:block">
          {contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("contacts.noContactsYet")}
              description={t("contacts.noContactsDesc")}
              actionLabel={t("contacts.addContact")}
              onAction={() => setAddContactOpen(true)}
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
              <table className="w-full min-w-[1320px] text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {selectionMode && (
                      <th className="px-5 py-3 w-px">
                        <Checkbox
                          checked={filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) filtered.forEach((c) => next.add(c.id));
                              else filtered.forEach((c) => next.delete(c.id));
                              return next;
                            });
                          }}
                          aria-label={t("contacts.selectAll")}
                        />
                      </th>
                    )}
                    <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.name")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.email")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.phone")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.role")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.organization")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.collab")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.engagement")}</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{t("contacts.lastInteraction")}</th>
                    <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      ref={setRowRef(c.id)}
                      className={
                        "hover:bg-secondary/40 transition-colors duration-200 cursor-pointer " +
                        (selectionMode && selectedIds.has(c.id) ? "bg-brand-orange/5 " : "") +
                        (focusedId === c.id ? "bg-brand-orange/10 ring-2 ring-brand-orange/50 transition-all" : "")
                      }
                      onClick={() => selectionMode ? toggleSelect(c.id) : setDetailContact(c)}
                    >
                      {selectionMode && (
                        <td className="px-5 py-3.5 w-px" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                            aria-label={t("contacts.select")}
                          />
                        </td>
                      )}
                      {/* Name + Email merged */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-xs font-semibold text-white shrink-0">
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-foreground truncate">
                              {c.firstName} {c.lastName}
                              {c.stageName?.trim() && (
                                <span className="font-normal text-muted-foreground"> ({c.stageName})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Email — dedicated column */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3.5">
                        {c.phone?.trim()
                          ? <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      {/* Role badges — manual + computed, cap at 3 visible + "+N more" */}
                      <td className="px-4 py-3.5">
                        {(() => {
                          const dr = getDisplayRoles(c);
                          if (dr.length === 0) return null;
                          const visible = dr.slice(0, 3);
                          const overflow = dr.length - visible.length;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {visible.map((r) => (
                                <span key={r} className={"inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold " + getRoleColor(r)}>
                                  {r}
                                </span>
                              ))}
                              {overflow > 0 && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground" title={dr.slice(3).join(", ")}>
                                  +{overflow}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {/* Organization */}
                      <td className="px-4 py-3.5">
                        {c.organization && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {c.organization}
                          </span>
                        )}
                      </td>
                      {/* Collaborations: distinct catalog tracks where this person appears */}
                      <td className="px-4 py-3.5">
                        {(() => {
                          const n = getCollaborationsCount(c);
                          return n > 0
                            ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Music className="w-3 h-3 shrink-0" /><span className="font-mono">{n}</span></span>
                            : <span className="text-xs text-muted-foreground/40">—</span>;
                        })()}
                      </td>
                      {/* Engagement: plays (principal) + downloads (secondaire) */}
                      <td className="px-4 py-3.5">
                        {c.totalPlays === 0 && c.totalDownloads === 0 && c.tracksEngaged === 0 ? (
                          <span className="text-xs text-muted-foreground/60">{t("contacts.noActivityYet")}</span>
                        ) : (
                          <span
                            className="text-xs text-muted-foreground"
                            title={t("contacts.tracksEngaged", { count: c.tracksEngaged })}
                          >
                            <span className="text-foreground">{t("contacts.plays", { count: c.totalPlays })}</span> · {t("contacts.downloads", { count: c.totalDownloads })}
                          </span>
                        )}
                      </td>
                      {/* Last Interaction — relative */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-muted-foreground">{formatRelativeDate(c.lastInteraction)}</span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {FEATURES.PITCH_ENABLED && (
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
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingContact(c);
                              setAddContactOpen(true);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            title={t("contacts.editContact")}
                            aria-label="Edit contact"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ id: c.id, name: (c.firstName + " " + c.lastName).trim() });
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title={t("contacts.deleteContact")}
                              aria-label="Delete contact"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
                title={t("contacts.noContactsYet")}
                description={t("contacts.noContactsDesc")}
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
                ref={setRowRef(c.id)}
                variants={item}
                className={
                  "card-premium p-4 space-y-3 " +
                  (selectionMode && selectedIds.has(c.id) ? "ring-2 ring-brand-orange/50 bg-brand-orange/5 " : "") +
                  (focusedId === c.id ? "ring-2 ring-brand-orange/50 bg-brand-orange/10 transition-all" : "")
                }
                onClick={() => selectionMode ? toggleSelect(c.id) : setDetailContact(c)}
              >
                {/* Top: avatar + name + role */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectionMode && (
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelect(c.id)}
                          aria-label={t("contacts.select")}
                        />
                      </div>
                    )}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-xs font-semibold text-white shrink-0">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">
                        {c.firstName} {c.lastName}
                        {c.stageName?.trim() && (
                          <span className="font-normal text-muted-foreground"> ({c.stageName})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                    </div>
                  </div>
                  {/* Mobile: role chips wrap, no cap */}
                  <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[55%]">
                    {getDisplayRoles(c).map((r) => (
                      <span key={r} className={"inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold " + getRoleColor(r)}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Organization */}
                {c.organization && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {c.organization}
                  </div>
                )}
                {/* Compact metadata: Phone · Collabs · Location (tap card to see full details in drawer) */}
                {(() => {
                  const collabs = getCollaborationsCount(c);
                  const showBlock = c.phone?.trim() || collabs > 0 || c.city?.trim() || c.country?.trim();
                  if (!showBlock) return null;
                  return (
                    <div className="text-[11px] text-muted-foreground/80 flex flex-wrap gap-x-2 gap-y-0.5">
                      {c.phone?.trim() && <span><span className="font-medium text-muted-foreground">📞</span> <span className="font-mono">{c.phone}</span></span>}
                      {collabs > 0 && <span><span className="font-medium text-muted-foreground">🎵</span> {t("contacts.collabTracks", { count: collabs })}</span>}
                      {(c.city?.trim() || c.country?.trim()) && (
                        <span><span className="font-medium text-muted-foreground">📍</span> {[c.city?.trim(), c.country?.trim()].filter(Boolean).join(", ")}</span>
                      )}
                    </div>
                  );
                })()}
                {/* Stats + last interaction */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {c.totalPlays === 0 && c.totalDownloads === 0 && c.tracksEngaged === 0 ? (
                    <span className="text-muted-foreground/60">{t("contacts.noActivityYet")}</span>
                  ) : (
                    <span title={t("contacts.tracksEngaged", { count: c.tracksEngaged })}>
                      <span className="text-foreground">{t("contacts.plays", { count: c.totalPlays })}</span> · {t("contacts.downloads", { count: c.totalDownloads })}
                    </span>
                  )}
                  <span>{formatRelativeDate(c.lastInteraction)}</span>
                </div>
                {/* Actions */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/30">
                  {FEATURES.PITCH_ENABLED ? (
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
                  ) : <span />}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingContact(c);
                        setAddContactOpen(true);
                      }}
                      className="flex items-center justify-center w-11 h-11 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                      title={t("contacts.editContact")}
                      aria-label="Edit contact"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: c.id, name: (c.firstName + " " + c.lastName).trim() });
                      }}
                      className="flex items-center justify-center w-11 h-11 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={t("contacts.deleteContact")}
                      aria-label="Delete contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
      )}

      {/* Floating bulk-action bar */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border shadow-2xl"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {t("contacts.selectedCount", { count: selectedIds.size })}
            </span>
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors min-h-[40px]"
            >
              <Trash2 className="w-4 h-4" />
              {t("contacts.deleteSelected")}
            </button>
            <button
              onClick={exitSelectionMode}
              className="inline-flex items-center px-4 py-2 rounded-xl text-[13px] font-semibold border border-border text-foreground hover:bg-secondary/60 transition-colors min-h-[40px]"
            >
              {t("contacts.cancel")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkDeleting) setBulkConfirmOpen(false);
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t("contacts.deleteSelected")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.bulkDeleteConfirm", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting} className="text-sm border border-border">
              {t("contacts.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm disabled:opacity-60 disabled:pointer-events-none"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  {t("contacts.deleting")}
                </>
              ) : (
                t("contacts.deleteSelected")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pitch Modal */}
      <CreatePitchModal
        open={!!pitchContact}
        onOpenChange={(open) => { if (!open) setPitchContact(null); }}
        onCreate={(pitch: PitchEntry) => { addPitch(pitch); setPitchContact(null); }}
        initialRecipientName={pitchContact?.name}
        initialRecipientEmail={pitchContact?.email}
        initialRecipientCompany={pitchContact?.company}
      />
      <AddContactModal
        open={addContactOpen}
        onOpenChange={(open) => {
          setAddContactOpen(open);
          if (!open) setEditingContact(null);
        }}
        editingContact={editingContact}
      />

      <ContactDetailSheet
        contact={detailContact}
        onClose={() => setDetailContact(null)}
        onEdit={(c) => { setEditingContact(c); setAddContactOpen(true); setDetailContact(null); }}
        onPitch={(c) => {
          setPitchContact({ name: c.firstName + " " + c.lastName, email: c.email, company: c.organization });
          setDetailContact(null);
        }}
        onDelete={(c) => {
          setDeleteTarget({ id: c.id, name: (c.firstName + " " + c.lastName).trim() });
          setDetailContact(null);
        }}
        onDownload={handleDownloadContactCard}
        isAdmin={isAdmin}
        contactTracks={detailContact ? getContactTracks(detailContact) : []}
        contactAliases={detailContact ? aliasesByContactId.get(detailContact.id) ?? [] : []}
        displayRoles={detailContact ? getDisplayRoles(detailContact) : []}
        onTrackClick={(trackId) => { navigate("/track/" + trackId); setDetailContact(null); }}
        formatLastInteraction={formatRelativeDate}
      />

      {/* Delete Contact Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t("contacts.deleteContact")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.deleteContactConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-sm border border-border">
              {t("contacts.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteContact();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm disabled:opacity-60 disabled:pointer-events-none"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  {t("contacts.deleting")}
                </>
              ) : (
                t("contacts.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
