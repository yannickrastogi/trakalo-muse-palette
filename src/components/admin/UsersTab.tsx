import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 100;
const COLUMN_COUNT = 8;

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  created_at: string;
  last_sign_in_at: string;
  email_confirmed: boolean;
  is_banned: boolean;
  has_2fa: boolean;
  workspaces_count: number;
  tracks_in_workspaces: number;
  pitches_in_workspaces: number;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "t" || v === "1";
  if (typeof v === "number") return v !== 0;
  return false;
}

function normalizeUser(raw: unknown): UserRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;
  return {
    id,
    email: asString(r.email),
    full_name: asString(r.full_name),
    avatar_url: asString(r.avatar_url),
    created_at: asString(r.created_at),
    last_sign_in_at: asString(r.last_sign_in_at),
    email_confirmed: asBool(r.email_confirmed),
    is_banned: asBool(r.is_banned),
    has_2fa: asBool(r.has_2fa),
    workspaces_count: asNumber(r.workspaces_count),
    tracks_in_workspaces: asNumber(r.tracks_in_workspaces),
    pitches_in_workspaces: asNumber(r.pitches_in_workspaces),
  };
}

function parseListResponse(data: unknown): { rows: UserRow[]; total: number | null } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { rows: [], total: null };
  }
  const obj = data as Record<string, unknown>;
  const rawRows = Array.isArray(obj.rows) ? obj.rows : [];
  const rows = rawRows.map(normalizeUser).filter((r): r is UserRow => r !== null);
  const total =
    typeof obj.total === "number" ? obj.total : obj.total != null ? Number(obj.total) : null;
  return { rows, total: total != null && !Number.isNaN(total) ? total : null };
}

function displayName(u: UserRow): string {
  return u.full_name.trim() || u.email || "—";
}

function initials(u: UserRow): string {
  const source = u.full_name.trim() || u.email.trim();
  if (!source) return "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatRelative(s: string, fallback = "—"): string {
  if (!s) return fallback;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return fallback;
  return formatDistanceToNow(d, { addSuffix: true });
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function UsersTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<UserRow[] | null>(null);
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
      const { data, error: rpcError } = await supabase.rpc("list_all_users", {
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
      setError(e instanceof Error ? e.message : "Failed to load users");
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
      const all: UserRow[] = [];
      let offset = 0;
      for (let i = 0; i < 200; i++) {
        const { data, error: rpcError } = await supabase.rpc("list_all_users", {
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
        "email_confirmed",
        "created_at",
        "last_sign_in_at",
        "workspaces",
        "tracks",
        "pitches",
        "has_2fa",
        "is_banned",
      ];
      const lines = [header.join(",")];
      for (const u of all) {
        lines.push(
          [
            csvEscape(displayName(u)),
            csvEscape(u.email),
            csvEscape(u.email_confirmed ? "yes" : "no"),
            csvEscape(u.created_at),
            csvEscape(u.last_sign_in_at),
            csvEscape(u.workspaces_count),
            csvEscape(u.tracks_in_workspaces),
            csvEscape(u.pitches_in_workspaces),
            csvEscape(u.has_2fa ? "yes" : "no"),
            csvEscape(u.is_banned ? "yes" : "no"),
          ].join(","),
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `users-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} users`);
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
            placeholder="Search by name or email..."
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
              <TableHead className="whitespace-nowrap">User</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Created</TableHead>
              <TableHead className="whitespace-nowrap">Last sign in</TableHead>
              <TableHead className="whitespace-nowrap text-center">Workspaces</TableHead>
              <TableHead className="whitespace-nowrap text-center">Tracks</TableHead>
              <TableHead className="whitespace-nowrap text-center">Pitches</TableHead>
              <TableHead className="whitespace-nowrap">Security</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows === null ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  {Array.from({ length: COLUMN_COUNT - 1 }).map((__, j) => (
                    <TableCell key={`sk-${i}-${j}`}>
                      <Skeleton className="h-4 w-20" />
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
                  {debouncedSearch ? "No matches" : "No users yet"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={displayName(u)} /> : null}
                        <AvatarFallback
                          className="text-xs font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#f97316,#ec4899)" }}
                        >
                          {initials(u)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{displayName(u)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span>{u.email || "—"}</span>
                      {u.email_confirmed && (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-green-500"
                          aria-label="Email confirmed"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatRelative(u.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : "Never"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge variant="outline" className="font-mono">
                      {u.workspaces_count.toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center text-muted-foreground">
                    {u.tracks_in_workspaces.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center text-muted-foreground">
                    {u.pitches_in_workspaces.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.has_2fa ? (
                        <Badge className="border-green-500/30 bg-green-500/15 text-green-600 hover:bg-green-500/20 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          2FA
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <Shield className="h-3 w-3" />
                          No 2FA
                        </Badge>
                      )}
                      {u.is_banned && (
                        <Badge className="border-red-500/30 bg-red-500/15 text-red-600 hover:bg-red-500/20 gap-1">
                          <Ban className="h-3 w-3" />
                          Banned
                        </Badge>
                      )}
                    </div>
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
