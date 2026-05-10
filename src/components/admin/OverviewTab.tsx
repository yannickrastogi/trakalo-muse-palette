import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ListMusic, Briefcase, UserPlus, Contact } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface AdminOverview {
  waitlist_total: number;
  waitlist_this_week: number;
  users_total: number;
  workspaces_total: number;
  tracks_total: number;
  contacts_total: number;
}

interface DailyPoint {
  date: string;
  count: number;
}

// get_admin_overview returns nested objects:
//   { waitlist: { total, this_week }, users: { total }, workspaces: { total },
//     tracks: { total }, contacts: { total } }
// Older shape (flat keys) is kept as a fallback.
function normalizeOverview(raw: unknown): AdminOverview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const group = (key: string): Record<string, unknown> => {
    const v = r[key];
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  };
  const waitlist = group("waitlist");
  const users = group("users");
  const workspaces = group("workspaces");
  const tracks = group("tracks");
  const contacts = group("contacts");
  return {
    waitlist_total: num(waitlist.total ?? r.waitlist_total),
    waitlist_this_week: num(waitlist.this_week ?? r.waitlist_this_week),
    users_total: num(users.total ?? r.users_total),
    workspaces_total: num(workspaces.total ?? r.workspaces_total),
    tracks_total: num(tracks.total ?? r.tracks_total),
    contacts_total: num(contacts.total ?? r.contacts_total),
  };
}

function normalizeDaily(raw: unknown): DailyPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const dateRaw = (r.date ?? r.day ?? r.signup_date ?? "") as string;
    const countRaw = (r.count ?? r.signups ?? r.total ?? 0) as number | string;
    return {
      date: typeof dateRaw === "string" ? dateRaw : String(dateRaw),
      count: typeof countRaw === "number" ? countRaw : Number(countRaw) || 0,
    };
  });
}

function formatTick(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OverviewTab() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [daily, setDaily] = useState<DailyPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const [overviewRes, dailyRes] = await Promise.all([
          supabase.rpc("get_admin_overview", { _user_id: user.id }),
          supabase.rpc("get_waitlist_signups_30d", { _user_id: user.id }),
        ]);
        if (cancelled) return;
        if (overviewRes.error) throw overviewRes.error;
        if (dailyRes.error) throw dailyRes.error;
        setOverview(normalizeOverview(overviewRes.data));
        setDaily(normalizeDaily(dailyRes.data));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load overview");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <KpiCard
          icon={<UserPlus className="h-4 w-4" />}
          label="Waitlist"
          value={overview?.waitlist_total}
          delta={overview?.waitlist_this_week}
          deltaLabel="this week"
          loading={!overview}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Users"
          value={overview?.users_total}
          loading={!overview}
        />
        <KpiCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Workspaces"
          value={overview?.workspaces_total}
          loading={!overview}
        />
        <KpiCard
          icon={<ListMusic className="h-4 w-4" />}
          label="Tracks"
          value={overview?.tracks_total}
          loading={!overview}
        />
        <KpiCard
          icon={<Contact className="h-4 w-4" />}
          label="Contacts"
          value={overview?.contacts_total}
          loading={!overview}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Signups last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {!daily ? (
            <Skeleton className="h-[260px] w-full" />
          ) : daily.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              No signups in the last 30 days
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatTick}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => formatTick(String(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#signupsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  deltaLabel,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
        <div className="mt-2">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-2xl font-bold tracking-tight">
              {(value ?? 0).toLocaleString()}
            </div>
          )}
          {!loading && typeof delta === "number" && delta > 0 && (
            <div className="mt-1 text-xs font-medium text-orange-500">
              +{delta.toLocaleString()} {deltaLabel}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
