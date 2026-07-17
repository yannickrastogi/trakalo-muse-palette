import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { toast } from "sonner";
import {
  Shield,
  Waves,
  Send,
  Compass,
  PenTool,
  Users,
  Layers,
  Radio,
  Bell,
  Languages,
  ArrowRight,
  ChevronDown,
  Disc3,
} from "lucide-react";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { useTranslation } from "react-i18next";

const LANDING_LANGUAGES = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "it", label: "IT", flag: "🇮🇹" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "ko", label: "KO", flag: "🇰🇷" },
  { code: "ja", label: "JA", flag: "🇯🇵" },
];

const LANDING_VISITED_KEY = "trakalog_landing_visited";

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANDING_LANGUAGES.find((l) => l.code === i18n.language) || LANDING_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Select language"
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all min-h-[44px]"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={"w-3 h-3 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 py-1 rounded-lg border border-border bg-card shadow-lg z-50 min-w-[120px]"
          >
            {LANDING_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => selectLanguage(lang.code)}
                className={"w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors min-h-[44px] "
                  + (lang.code === current.code
                    ? "text-brand-orange bg-brand-orange/5 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60")}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

// Early-access form (Trakalog Access). Operational copy comes from the default
// `translation` namespace (already localized in all 8 langs); the marketing copy
// around it comes from the `landing` namespace. Writes go through the
// add-to-waitlist Edge Function — the public page never imports the supabase client.
function EarlyAccessForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    let res: Response;
    try {
      res = await fetch(SUPABASE_URL + "/functions/v1/add-to-waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), source: "landing-access" }),
      });
    } catch (err) {
      console.error("waitlist network error:", err);
      setSubmitting(false);
      toast.error(t("landing.somethingWentWrong"));
      return;
    }

    setSubmitting(false);
    const json = res.ok ? await res.json().catch(() => null) : null;

    if (!res.ok || !json?.success) {
      toast.error(t("landing.somethingWentWrong"));
      return;
    }

    toast.success(json.duplicate ? t("landing.alreadyOnWaitlist") : t("landing.onTheList"));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium max-w-md">
        <Disc3 className="w-4 h-4 shrink-0" />
        {t("landing.onWaitlist")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 w-full max-w-md">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("landing.namePlaceholder", "Name")}
          className="flex-1 h-12 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange/40 transition-all min-h-[44px]"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@label.com"
          className="flex-1 h-12 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange/40 transition-all min-h-[44px]"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="h-12 px-6 rounded-xl btn-brand text-sm font-semibold whitespace-nowrap flex items-center gap-2 justify-center min-h-[44px]"
      >
        {submitting ? t("landing.joining") : t("landing.getEarlyAccess")}
        {!submitting && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}

// Reusable full-width content section: icon badge + kicker + title + body.
function Section({
  id,
  icon: Icon,
  kicker,
  title,
  alt,
  children,
}: {
  id?: string;
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  alt?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className={alt ? "bg-card/40 border-y border-border/40" : ""}>
      <div className="max-w-4xl mx-auto px-5 sm:px-6 py-20 sm:py-28">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="flex flex-col items-start"
        >
          <motion.div
            variants={fadeUp}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 border border-border/50 flex items-center justify-center mb-6"
          >
            <Icon className="w-6 h-6 text-brand-pink" />
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs sm:text-sm font-semibold gradient-text uppercase tracking-[0.2em] mb-3">
            {kicker}
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl">
            {title}
          </motion.h2>
          <motion.div variants={fadeUp} className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl space-y-4">
            {children}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t, i18n } = useTranslation("landing");
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);

  // Force English on first landing visit — does not affect logged-in app language
  useEffect(() => {
    const visited = sessionStorage.getItem(LANDING_VISITED_KEY);
    if (!visited) {
      i18n.changeLanguage("en");
      sessionStorage.setItem(LANDING_VISITED_KEY, "1");
    }
  }, []);

  const scrollToProtection = () => {
    document.getElementById("protection")?.scrollIntoView({ behavior: "smooth" });
  };

  // Pre-launch: every primary CTA opens the same waitlist form (in the Access
  // section) — no auth / signup exposed yet.
  const openWaitlist = () => {
    setShowEarlyAccess(true);
    document.getElementById("access")?.scrollIntoView({ behavior: "smooth" });
  };

  // Stable ids so the grid items never remount on language switch (which left
  // whileInView items stuck at opacity 0).
  const moreItems = [
    { id: "radio", icon: Radio, title: t("more.radioTitle"), desc: t("more.radioDesc") },
    { id: "notif", icon: Bell, title: t("more.notifTitle"), desc: t("more.notifDesc") },
    { id: "team", icon: Users, title: t("more.teamTitle"), desc: t("more.teamDesc") },
    { id: "lang", icon: Languages, title: t("more.langTitle"), desc: t("more.langDesc") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain" />
            <span className="text-sm sm:text-lg font-bold tracking-tight gradient-text">TRAKALOG</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            <button
              onClick={openWaitlist}
              className="px-2.5 sm:px-4 py-2 rounded-lg btn-brand text-xs sm:text-sm font-semibold min-h-[44px] inline-flex items-center whitespace-nowrap"
            >
              {t("joinWaitlist")}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(24 95% 53% / 0.10), transparent 70%)" }}
        />
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-4xl mx-auto px-5 sm:px-6 pt-24 sm:pt-36 pb-20 sm:pb-28 text-center flex flex-col items-center"
        >
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]"
          >
            {t("hero.title")}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl"
          >
            {t("hero.subtitle")}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-9 flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
            <button
              onClick={openWaitlist}
              className="h-12 px-7 rounded-xl btn-brand text-sm sm:text-base font-semibold inline-flex items-center gap-2 justify-center min-h-[44px]"
            >
              {t("joinWaitlist")}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToProtection}
              className="h-12 px-7 rounded-xl border border-border text-sm sm:text-base font-semibold text-foreground hover:bg-secondary/60 transition-all inline-flex items-center gap-2 justify-center min-h-[44px]"
            >
              {t("hero.ctaSecondary")}
              <ChevronDown className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* Protection */}
      <Section id="protection" icon={Shield} alt kicker={t("protection.kicker")} title={t("protection.title")}>
        <p>{t("protection.body")}</p>
      </Section>

      {/* Intelligence */}
      <Section icon={Waves} kicker={t("intelligence.kicker")} title={t("intelligence.title")}>
        <p>{t("intelligence.body1")}</p>
        <p>{t("intelligence.body2")}</p>
      </Section>

      {/* Pitch */}
      <Section icon={Send} alt kicker={t("pitch.kicker")} title={t("pitch.title")}>
        <p>{t("pitch.body")}</p>
      </Section>

      {/* Access */}
      <section id="access" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(50% 60% at 80% 20%, hsl(330 81% 60% / 0.08), transparent 70%)" }}
        />
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="flex flex-col items-start"
          >
            <motion.div variants={fadeUp} className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 border border-border/50 flex items-center justify-center mb-6">
              <Compass className="w-6 h-6 text-brand-pink" />
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-3">
              <span className="text-xs sm:text-sm font-semibold gradient-text uppercase tracking-[0.2em]">{t("access.kicker")}</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/10 border border-brand-orange/25">
                {t("access.badge")}
              </span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-8 max-w-3xl">
              {t("access.title")}
            </motion.h2>
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full mb-8">
              <div className="card-premium p-6">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center mb-4">
                  <Disc3 className="w-5 h-5 text-brand-orange" />
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">{t("access.bodyMakers")}</p>
              </div>
              <div className="card-premium p-6">
                <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center mb-4">
                  <Compass className="w-5 h-5 text-brand-purple" />
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">{t("access.bodySeekers")}</p>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={openWaitlist}
                className="h-12 px-6 rounded-xl btn-brand text-sm font-semibold inline-flex items-center gap-2 justify-center min-h-[44px]"
              >
                {t("joinWaitlist")}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowEarlyAccess(true)}
                className="h-12 px-6 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-secondary/60 transition-all inline-flex items-center justify-center min-h-[44px]"
              >
                {t("access.ctaEarlyAccess")}
              </button>
            </motion.div>
            {showEarlyAccess && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                <EarlyAccessForm />
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Splits */}
      <Section icon={PenTool} alt kicker={t("splits.kicker")} title={t("splits.title")}>
        <p>{t("splits.body")}</p>
      </Section>

      {/* Contacts */}
      <Section icon={Users} kicker={t("contacts.kicker")} title={t("contacts.title")}>
        <p>{t("contacts.body")}</p>
      </Section>

      {/* Organization */}
      <Section icon={Layers} alt kicker={t("organization.kicker")} title={t("organization.title")}>
        <p>{t("organization.body")}</p>
      </Section>

      {/* And more */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-20 sm:py-28">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, margin: "-80px" }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            {t("more.title")}
          </motion.h2>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {moreItems.map((m) => (
              <motion.div key={m.id} variants={fadeUp} className="card-premium p-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-orange/15 via-brand-pink/15 to-brand-purple/15 border border-border/50 flex items-center justify-center mb-4">
                  <m.icon className="w-5 h-5 text-brand-pink" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{m.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Closer */}
      <section className="relative overflow-hidden bg-card/40 border-y border-border/40">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(60% 60% at 50% 100%, hsl(270 70% 60% / 0.10), transparent 70%)" }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-24 sm:py-36 text-center flex flex-col items-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              {t("closer.title")}
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
              {t("closer.body")}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9">
              <button
                onClick={openWaitlist}
                className="px-8 py-3.5 rounded-xl btn-brand text-base font-semibold inline-flex items-center gap-2 min-h-[44px]"
              >
                {t("joinWaitlist")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={trakalogLogo} alt="Trakalog" className="w-7 h-7 rounded-lg object-contain" />
            <span className="text-sm font-semibold gradient-text">TRAKALOG</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t("landing.privacyPolicy", { ns: "translation", defaultValue: "Privacy" })}</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">{t("landing.termsOfService", { ns: "translation", defaultValue: "Terms" })}</Link>
            <a href="mailto:contact@trakalog.com" className="hover:text-foreground transition-colors">contact@trakalog.com</a>
          </div>
          <p className="text-xs text-muted-foreground/60">© {new Date().getFullYear()} Trakalog</p>
        </div>
      </footer>
    </div>
  );
}
