import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Download, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;

interface WaitlistRow {
  id: string;
  email: string;
  created_at: string;
  status: "pending" | "invited" | string;
  total_count?: number;
}

function normalizeRow(raw: unknown): WaitlistRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const email = r.email;
  if (typeof email !== "string") return null;
  return {
    id: String(r.id ?? email),
    email,
    created_at: String(r.created_at ?? ""),
    status: (r.status as string) || "pending",
    total_count:
      typeof r.total_count === "number"
        ? r.total_count
        : r.total_count != null
          ? Number(r.total_count)
          : undefined,
  };
}

function formatDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function WaitlistTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmEmails, setConfirmEmails] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reqIdRef = useRef(0);

  // Debounce search input
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
      const { data, error: rpcError } = await supabase.rpc("list_waitlist_signups", {
        _user_id: user.id,
        _search: debouncedSearch || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (reqId !== reqIdRef.current) return;
      if (rpcError) throw rpcError;
      const list = Array.isArray(data) ? data : [];
      const normalized = list.map(normalizeRow).filter((r): r is WaitlistRow => r !== null);
      setRows(normalized);
      const t = normalized[0]?.total_count;
      if (typeof t === "number") {
        setTotal(t);
      } else if (page === 0 && normalized.length < PAGE_SIZE) {
        setTotal(normalized.length);
      }
      // Drop selections that no longer exist on this page
      setSelected((prev) => {
        if (prev.size === 0) return prev;
        const visible = new Set(normalized.map((r) => r.email));
        const next = new Set<string>();
        for (const e of prev) if (visible.has(e)) next.add(e);
        return next;
      });
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load waitlist");
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

  const allOnPageSelected = useMemo(() => {
    if (!rows || rows.length === 0) return false;
    return rows.every((r) => selected.has(r.email));
  }, [rows, selected]);

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!rows) return next;
      if (checked) {
        for (const r of rows) next.add(r.email);
      } else {
        for (const r of rows) next.delete(r.email);
      }
      return next;
    });
  };

  const toggleOne = (email: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(email);
      else next.delete(email);
      return next;
    });
  };

  const startInviteSingle = (email: string) => {
    setConfirmEmails([email]);
  };

  const startInviteBulk = () => {
    if (selected.size === 0) return;
    setConfirmEmails(Array.from(selected));
  };

  const confirmInvites = async () => {
    if (!confirmEmails || confirmEmails.length === 0) return;
    setSending(true);
    let okCount = 0;
    let failCount = 0;
    for (const email of confirmEmails) {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("send-waitlist-invite", {
          body: { email },
        });
        const ok = !fnErr && (data === null || data === undefined || (data as { success?: boolean })?.success !== false);
        if (ok) {
          okCount++;
        } else {
          failCount++;
          const msg =
            (data as { error?: string })?.error ||
            fnErr?.message ||
            "Unknown error";
          toast.error(`${email}: ${msg}`);
        }
      } catch (e) {
        failCount++;
        toast.error(`${email}: ${e instanceof Error ? e.message : "Failed"}`);
      }
    }
    setSending(false);
    setConfirmEmails(null);
    if (okCount > 0) {
      toast.success(
        okCount === 1
          ? "Invitation sent"
          : `${okCount} invitations sent`,
      );
    }
    setSelected(new Set());
    loadPage();
    void failCount;
  };

  const exportCsv = async () => {
    if (!user?.id || exporting) return;
    setExporting(true);
    try {
      const all: WaitlistRow[] = [];
      let offset = 0;
      // Paginate 100 at a time until exhausted
      // Cap at 100 pages (10k rows) as a safety bound
      for (let i = 0; i < 100; i++) {
        const { data, error: rpcError } = await supabase.rpc("list_waitlist_signups", {
          _user_id: user.id,
          _search: debouncedSearch || null,
          _limit: EXPORT_PAGE_SIZE,
          _offset: offset,
        });
        if (rpcError) throw rpcError;
        const list = Array.isArray(data) ? data : [];
        const normalized = list.map(normalizeRow).filter((r): r is WaitlistRow => r !== null);
        all.push(...normalized);
        if (normalized.length < EXPORT_PAGE_SIZE) break;
        offset += EXPORT_PAGE_SIZE;
      }

      const header = ["email", "created_at", "status"];
      const lines = [header.join(",")];
      for (const r of all) {
        lines.push([csvEscape(r.email), csvEscape(r.created_at), csvEscape(r.status)].join(","));
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `waitlist-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} rows`);
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
            placeholder="Search by email..."
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={startInviteBulk}>
              <Mail className="mr-1.5 h-4 w-4" />
              Invite {selected.size} selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(c) => toggleAllOnPage(c === true)}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows === null ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : !rows || rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {debouncedSearch ? "No matches" : "No waitlist signups yet"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const checked = selected.has(row.email);
                const isInvited = row.status === "invited";
                return (
                  <TableRow key={row.id} data-state={checked ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => toggleOne(row.email, c === true)}
                        aria-label={`Select ${row.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.email}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                    <TableCell>
                      {isInvited ? (
                        <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 border-green-500/30">
                          invited
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30">
                          pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={isInvited ? "ghost" : "outline"}
                        onClick={() => startInviteSingle(row.email)}
                        disabled={isInvited}
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        {isInvited ? "Invited" : "Send invite"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {total > 0
            ? `Showing ${showingFrom}-${showingTo} of ${total}`
            : "Showing 0 of 0"}
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

      <Dialog
        open={confirmEmails !== null}
        onOpenChange={(o) => {
          if (!o && !sending) setConfirmEmails(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmEmails && confirmEmails.length === 1
                ? "Send invitation?"
                : `Send ${confirmEmails?.length ?? 0} invitations?`}
            </DialogTitle>
            <DialogDescription>
              {confirmEmails && confirmEmails.length === 1
                ? `An invitation email will be sent to ${confirmEmails[0]} and they'll be added to the whitelist.`
                : `Invitation emails will be sent and these addresses will be added to the whitelist.`}
            </DialogDescription>
          </DialogHeader>

          {confirmEmails && confirmEmails.length > 1 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              {confirmEmails.map((e) => (
                <div key={e} className="py-0.5">{e}</div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmEmails(null)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={confirmInvites} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
