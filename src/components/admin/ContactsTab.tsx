import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 100;
const COLUMN_COUNT = 8;

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  stage_name: string;
  email: string;
  role: string;
  company: string;
  workspace_name: string;
  pro: string[];
  phone: string;
  created_at: string;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asProArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => asString(x).trim()).filter(Boolean);
  }
  const s = asString(v).trim();
  if (!s) return [];
  // Tolerate comma-separated or single value
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function normalizeContact(raw: unknown): ContactRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;
  return {
    id,
    first_name: asString(r.first_name),
    last_name: asString(r.last_name),
    stage_name: asString(r.stage_name),
    email: asString(r.email),
    role: asString(r.role),
    company: asString(r.company),
    workspace_name: asString(r.workspace_name),
    pro: asProArray(r.pro),
    phone: asString(r.phone),
    created_at: asString(r.created_at),
  };
}

function parseListResponse(data: unknown): { rows: ContactRow[]; total: number | null } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { rows: [], total: null };
  }
  const obj = data as Record<string, unknown>;
  const rawRows = Array.isArray(obj.rows) ? obj.rows : [];
  const rows = rawRows.map(normalizeContact).filter((r): r is ContactRow => r !== null);
  const total =
    typeof obj.total === "number" ? obj.total : obj.total != null ? Number(obj.total) : null;
  return { rows, total: total != null && !Number.isNaN(total) ? total : null };
}

function displayName(c: ContactRow): string {
  const base = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (c.stage_name) {
    return base ? `${base} (${c.stage_name})` : c.stage_name;
  }
  return base || "—";
}

function formatRelative(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return formatDistanceToNow(d, { addSuffix: true });
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function ContactsTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(async () => {
    if (!user?.id) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("list_all_contacts", {
        _user_id: user.id,
        _search: debouncedSearch || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (reqId !== reqIdRef.current) return;
      if (rpcError) throw rpcError;
      const { rows: normalized, total: parsedTotal } = parseListResponse(data);
      setRows(normalized);
      if (parsedTotal !== null) {
        setTotal(parsedTotal);
      } else if (page === 0 && normalized.length < PAGE_SIZE) {
        setTotal(normalized.length);
      }
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load contacts");
      setRows([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [user?.id, debouncedSearch, page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min(total, page * PAGE_SIZE + (rows?.length ?? 0));

  const exportCsv = async () => {
    if (!user?.id || exporting) return;
    setExporting(true);
    try {
      const all: ContactRow[] = [];
      let offset = 0;
      for (let i = 0; i < 200; i++) {
        const { data, error: rpcError } = await supabase.rpc("list_all_contacts", {
          _user_id: user.id,
          _search: debouncedSearch || null,
          _limit: EXPORT_PAGE_SIZE,
          _offset: offset,
        });
        if (rpcError) throw rpcError;
        const { rows: normalized } = parseListResponse(data);
        all.push(...normalized);
        if (normalized.length < EXPORT_PAGE_SIZE) break;
        offset += EXPORT_PAGE_SIZE;
      }

      const header = [
        "name",
        "email",
        "role",
        "company",
        "workspace",
        "pro",
        "phone",
        "created_at",
      ];
      const lines = [header.join(",")];
      for (const c of all) {
        lines.push(
          [
            csvEscape(displayName(c)),
            csvEscape(c.email),
            csvEscape(c.role),
            csvEscape(c.company),
            csvEscape(c.workspace_name),
            csvEscape(c.pro.join("; ")),
            csvEscape(c.phone),
            csvEscape(c.created_at),
          ].join(","),
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `contacts-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} contacts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          <Download className="mr-1.5 h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Name</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Role</TableHead>
              <TableHead className="whitespace-nowrap">Company</TableHead>
              <TableHead className="whitespace-nowrap">Workspace</TableHead>
              <TableHead className="whitespace-nowrap">PRO</TableHead>
              <TableHead className="whitespace-nowrap">Phone</TableHead>
              <TableHead className="whitespace-nowrap">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows === null ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={`sk-${i}-${j}`}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-sm text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : !rows || rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center text-sm text-muted-foreground">
                  {debouncedSearch ? "No matches" : "No contacts collected yet"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap font-medium">{displayName(c)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.email || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.role || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.company || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.workspace_name || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.pro.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.pro.map((p) => (
                          <Badge
                            key={p}
                            variant="outline"
                            className="border-orange-500/30 bg-orange-500/10 text-orange-500 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {c.phone || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatRelative(c.created_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {total > 0 ? `Showing ${showingFrom}-${showingTo} of ${total}` : "Showing 0 of 0"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages || loading}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
