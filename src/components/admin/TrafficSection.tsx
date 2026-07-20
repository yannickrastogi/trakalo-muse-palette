import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Users, CalendarDays, Clock } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface VisitTotals {
  visits_all_time: number;
  visitors_all_time: number;
  visits_period: number;
  visitors_period: number;
  visits_7d: number;
  visits_24h: number;
}
interface SourceRow { source: string; visits: number; visitors: number; }
interface DayRow { day: string; visits: number; visitors: number; }
interface PageRow { path: string; visits: number; }
interface CampaignRow { campaign: string; source: string; visits: number; }
interface VisitStats {
  period_days: number;
  totals: VisitTotals;
  by_source: SourceRow[];
  by_day: DayRow[];
  top_pages: PageRow[];
  top_campaigns: CampaignRow[];
}

const PERIODS = [7, 30, 90];

// Human-readable source labels (fr).
const SOURCE_LABELS: Record<string, string> = {
  direct: "Accès direct",
  ai_assistant: "Assistant IA",
  chatgpt: "ChatGPT",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  twitter: "Twitter / X",
  x: "Twitter / X",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
  google: "Google",
  bing: "Bing",
  spotify: "Spotify",
  apple: "Apple Music",
  email: "Email",
  newsletter: "Newsletter",
  referral: "Site référent",
};
function sourceLabel(s: string | null | undefined): string {
  if (!s) return "Inconnu";
  return SOURCE_LABELS[s] || (s.charAt(0).toUpperCase() + s.slice(1));
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

function normalize(raw: unknown): VisitStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const t = (r.totals ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  return {
    period_days: num(r.period_days),
    totals: {
      visits_all_time: num(t.visits_all_time),
      visitors_all_time: num(t.visitors_all_time),
      visits_period: num(t.visits_period),
      visitors_period: num(t.visitors_period),
      visits_7d: num(t.visits_7d),
      visits_24h: num(t.visits_24h),
    },
    by_source: arr(r.by_source)
      .map((s) => ({ source: str(s.source), visits: num(s.visits), visitors: num(s.visitors) }))
      .sort((a, b) => b.visits - a.visits),
    by_day: arr(r.by_day).map((d) => ({ day: str(d.day), visits: num(d.visits), visitors: num(d.visitors) })),
    top_pages: arr(r.top_pages).map((p) => ({ path: str(p.path), visits: num(p.visits) })),
    top_campaigns: arr(r.top_campaigns).map((c) => ({ campaign: str(c.campaign), source: str(c.source), visits: num(c.visits) })),
  };
}

function formatTick(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function TrafficSection() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setStats(null);
    setError(null);
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_visit_stats", {
          _user_id: user.id,
          _days: days,
        });
        if (cancelled) return;
        if (rpcErr) throw rpcErr;
        setStats(normalize(data));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load traffic stats");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, days]);

  const totals = stats?.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Traffic</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors " +
                (days === p
                  ? "bg-orange-500/10 text-orange-500"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {p} j
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard icon={<Clock className="h-4 w-4" />} label="Visites (24h)" value={totals?.visits_24h} loading={!stats} />
            <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Visites (7 jours)" value={totals?.visits_7d} loading={!stats} />
            <StatCard icon={<Eye className="h-4 w-4" />} label={"Visites (" + days + " j)"} value={totals?.visits_period} loading={!stats} />
            <StatCard icon={<Users className="h-4 w-4" />} label="Visiteurs uniques" value={totals?.visitors_period} loading={!stats} />
          </div>

          {/* Visits per day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visites par jour</CardTitle>
            </CardHeader>
            <CardContent>
              {!stats ? (
                <Skeleton className="h-[260px] w-full" />
              ) : stats.by_day.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Aucune visite sur la période
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.by_day} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="day"
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
                      <Area type="monotone" dataKey="visits" stroke="#f97316" strokeWidth={2} fill="url(#visitsFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sources + Top pages */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sources de provenance</CardTitle>
              </CardHeader>
              <CardContent>
                {!stats ? (
                  <Skeleton className="h-40 w-full" />
                ) : stats.by_source.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Source</th>
                        <th className="pb-2 text-right font-medium">Visites</th>
                        <th className="pb-2 text-right font-medium">Visiteurs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_source.map((s, i) => (
                        <tr key={(s.source || "unknown") + ":" + i} className="border-t border-border/50">
                          <td className="py-2">{sourceLabel(s.source)}</td>
                          <td className="py-2 text-right tabular-nums">{s.visits.toLocaleString()}</td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">{s.visitors.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pages les plus vues</CardTitle>
              </CardHeader>
              <CardContent>
                {!stats ? (
                  <Skeleton className="h-40 w-full" />
                ) : stats.top_pages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Page</th>
                        <th className="pb-2 text-right font-medium">Visites</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top_pages.map((p) => (
                        <tr key={p.path} className="border-t border-border/50">
                          <td className="py-2 font-mono text-xs truncate max-w-[240px]">{p.path}</td>
                          <td className="py-2 text-right tabular-nums">{p.visits.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Campaigns — only when non-empty */}
          {stats && stats.top_campaigns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Campagnes</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Campagne</th>
                      <th className="pb-2 text-left font-medium">Source</th>
                      <th className="pb-2 text-right font-medium">Visites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_campaigns.map((c, i) => (
                      <tr key={c.campaign + ":" + c.source + ":" + i} className="border-t border-border/50">
                        <td className="py-2">{c.campaign || "—"}</td>
                        <td className="py-2 text-muted-foreground">{sourceLabel(c.source)}</td>
                        <td className="py-2 text-right tabular-nums">{c.visits.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
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
            <div className="text-2xl font-bold tracking-tight">{(value ?? 0).toLocaleString()}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
