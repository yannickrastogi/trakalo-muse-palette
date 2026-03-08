import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Mail, Shield, Eye, Headphones, UserCog, MoreHorizontal, Calendar, PenTool, BookOpen, Briefcase, UserCheck } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const ROLES = ["Admin", "Producer", "Songwriter", "Manager", "Publisher", "A&R", "Assistant", "Viewer"] as const;

const roleIcons: Record<string, React.ElementType> = {
  Admin: Shield,
  Producer: Headphones,
  Songwriter: PenTool,
  Manager: UserCog,
  Publisher: BookOpen,
  "A&R": Briefcase,
  Assistant: UserCheck,
  Viewer: Eye,
};

const roleColors: Record<string, string> = {
  Admin: "from-brand-orange to-brand-pink",
  Producer: "from-brand-purple to-[hsl(200,70%,50%)]",
  Songwriter: "from-brand-pink to-brand-orange",
  Manager: "from-brand-pink to-brand-purple",
  Publisher: "from-[hsl(200,70%,50%)] to-brand-purple",
  "A&R": "from-brand-orange to-brand-purple",
  Assistant: "from-brand-pink to-[hsl(200,70%,50%)]",
  Viewer: "from-muted-foreground/40 to-muted-foreground/20",
};

const members = [
  { name: "Kira Nomura", email: "kira@nightfallrecords.com", role: "Admin", joined: "2024-09-12", status: "active" },
  { name: "Dex Moraes", email: "dex@dexmoraes.com", role: "Producer", joined: "2024-11-03", status: "active" },
  { name: "Alina Voss", email: "alina@alinav.co", role: "Manager", joined: "2025-01-18", status: "active" },
  { name: "Marco Silva", email: "marco@studiosilva.io", role: "Songwriter", joined: "2025-02-22", status: "active" },
  { name: "JVNE", email: "mgmt@jvne.music", role: "Producer", joined: "2025-04-10", status: "active" },
  { name: "AYA", email: "aya@songbird.pub", role: "Publisher", joined: "2025-08-05", status: "invited" },
  { name: "Jun Tanaka", email: "jun@tanaka.jp", role: "A&R", joined: "2025-09-14", status: "active" },
  { name: "Sterling Sound NYC", email: "bookings@sterling.com", role: "Assistant", joined: "2025-06-01", status: "active" },
  { name: "Lena Park", email: "lena@lenapark.kr", role: "Viewer", joined: "2025-10-01", status: "active" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Team() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  const roleCounts = members.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <PageShell>
      <motion.div variants={container} initial="hidden" animate="show" className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-[1400px]">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("team.title")}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t("team.subtitle", { count: members.length })}</p>
          </div>
          <button className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold shrink-0 self-start min-h-[44px]">
            <Plus className="w-3.5 h-3.5" /> {t("team.inviteMember")}
          </button>
        </motion.div>

        {/* Role stat pills */}
        <motion.div variants={item} className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const Icon = roleIcons[role];
            return (
              <div
                key={role}
                className="card-premium flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
              >
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${roleColors[role]} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">{t(`team.role_${role.toLowerCase()}`)}</p>
                  <p className="text-sm font-bold text-foreground">{roleCounts[role] || 0}</p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Search */}
        <motion.div variants={item}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("team.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-[13px] placeholder:text-muted-foreground focus:outline-none focus-brand min-h-[44px]"
            />
          </div>
        </motion.div>

        {/* Members list */}
        <motion.div variants={item}>
          {isMobile ? (
            <div className="space-y-2.5">
              {filtered.map((m) => {
                const RoleIcon = roleIcons[m.role];
                return (
                  <div key={m.email} className="card-premium p-4 flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className={`bg-gradient-to-br ${roleColors[m.role]} text-primary-foreground text-2xs font-bold`}>
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div>
                        <p className="font-semibold text-foreground text-[13px] tracking-tight truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" /> {m.email}
                        </p>
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-2xs gap-1 border-border bg-secondary/50 text-secondary-foreground">
                          <RoleIcon className="w-3 h-3" /> {t(`team.role_${m.role.toLowerCase()}`)}
                        </Badge>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold ${
                          m.status === "active" ? "bg-emerald-500/12 text-emerald-400" : "bg-brand-orange/12 text-brand-orange"
                        }`}>
                          {m.status === "active" ? t("team.active") : t("team.invited")}
                        </span>
                      </div>
                      <p className="text-2xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {t("team.joined")} {formatDate(m.joined)}
                      </p>
                    </div>
                    <button className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.member")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden md:table-cell">{t("team.email")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.role")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest hidden lg:table-cell">{t("team.dateJoined")}</th>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-2xs uppercase tracking-widest">{t("team.status")}</th>
                      <th className="px-5 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => {
                      const RoleIcon = roleIcons[m.role];
                      return (
                        <tr key={m.email} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className={`bg-gradient-to-br ${roleColors[m.role]} text-primary-foreground text-2xs font-bold`}>
                                  {getInitials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground text-[13px] tracking-tight">{m.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{m.email}</td>
                          <td className="px-5 py-3.5">
                            <Badge variant="outline" className="text-2xs gap-1 border-border bg-secondary/50 text-secondary-foreground font-medium">
                              <RoleIcon className="w-3 h-3" /> {t(`team.role_${m.role.toLowerCase()}`)}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{formatDate(m.joined)}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-semibold ${
                              m.status === "active" ? "bg-emerald-500/12 text-emerald-400" : "bg-brand-orange/12 text-brand-orange"
                            }`}>
                              {m.status === "active" ? t("team.active") : t("team.invited")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">{t("team.noResults")}</div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </PageShell>
  );
}
