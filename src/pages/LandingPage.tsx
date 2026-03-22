import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Music, Rocket, Link2, BarChart3, Disc3, Building2, Mic2, ArrowRight, ChevronDown } from "lucide-react";
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

function WaitlistForm({ id }: { id?: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase() });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.success(t("landing.alreadyOnWaitlist"));
        setSubmitted(true);
      } else {
        toast.error(t("landing.somethingWentWrong"));
      }
      return;
    }

    toast.success(t("landing.onTheList"));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
        <Disc3 className="w-4 h-4" />
        {t("landing.onWaitlist")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} id={id} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@label.com"
        className="flex-1 h-12 px-4 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange/40 transition-all min-h-[44px]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="h-12 px-6 rounded-xl btn-brand text-sm font-semibold whitespace-nowrap flex items-center gap-2 justify-center w-full sm:w-auto min-h-[44px]"
      >
        {submitting ? t("landing.joining") : t("landing.getEarlyAccess")}
        {!submitting && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}

const featureKeys = [
  { icon: Music, titleKey: "landing.catalogManagement", descKey: "landing.catalogManagementDesc", color: "text-brand-orange", bg: "bg-brand-orange/10" },
  { icon: Rocket, titleKey: "landing.professionalPitches", descKey: "landing.professionalPitchesDesc", color: "text-brand-pink", bg: "bg-brand-pink/10" },
  { icon: Link2, titleKey: "landing.secureSharing", descKey: "landing.secureSharingDesc", color: "text-brand-purple", bg: "bg-brand-purple/10" },
  { icon: BarChart3, titleKey: "landing.engagementAnalytics", descKey: "landing.engagementAnalyticsDesc", color: "text-primary", bg: "bg-primary/10" },
];

const audienceKeys = [
  { key: "artists", icon: Mic2, labelKey: "landing.artists", color: "text-brand-pink", bg: "bg-brand-pink/10" },
  { key: "producers", icon: Music, labelKey: "landing.producers", color: "text-brand-orange", bg: "bg-brand-orange/10" },
  { key: "labels", icon: Building2, labelKey: "landing.labels", color: "text-brand-purple", bg: "bg-brand-purple/10" },
];

export default function LandingPage() {
  const { t, i18n } = useTranslation();

  // Force English on first landing visit — does not affect logged-in app language
  useEffect(() => {
    const visited = sessionStorage.getItem(LANDING_VISITED_KEY);
    if (!visited) {
      i18n.changeLanguage("en");
      sessionStorage.setItem(LANDING_VISITED_KEY, "1");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain" />
            <span className="text-sm sm:text-lg font-bold tracking-tight gradient-text">TRAKALOG</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("landing.features")}</a>
            <a href="#cta" className="hover:text-foreground transition-colors">{t("landing.pricing")}</a>
            <a href="mailto:contact@trakalog.com" className="hover:text-foreground transition-colors">{t("landing.contact")}</a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            <Link
              to="/auth"
              className="inline-flex px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold min-h-[44px] items-center border border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10 transition-all duration-200 whitespace-nowrap"
            >
              {t("landing.signIn")}
            </Link>
            <a
              href="#hero-form"
              className="px-2.5 sm:px-4 py-2 rounded-lg btn-brand text-xs sm:text-sm font-semibold min-h-[44px] inline-flex items-center whitespace-nowrap"
            >
              {t("landing.getEarlyAccess")}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-20 sm:pb-28"
      >
        <div className="max-w-3xl text-center sm:text-left mx-auto sm:mx-0">
          <motion.h1
            variants={fadeUp}
            className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
          >
            {t("landing.heroTitle")}{" "}
            <span className="gradient-text">{t("landing.heroHighlight")}</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-5 sm:mt-6 text-base sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto sm:mx-0"
          >
            {t("landing.heroDesc")}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6 sm:mt-8 flex justify-center sm:justify-start">
            <WaitlistForm id="hero-form" />
          </motion.div>
        </div>

        {/* App mockup placeholder */}
        <motion.div
          variants={fadeUp}
          className="mt-16 rounded-2xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: "0 24px 80px hsl(0 0% 0% / 0.4), var(--shadow-inner-glow)" }}
        >
          <div className="h-8 bg-secondary/50 border-b border-border flex items-center gap-1.5 px-4">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-brand-orange/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <img
            src="/images/app-preview.png"
            alt="Trakalog App Preview"
            className="w-full h-auto rounded-b-2xl"
          />
        </motion.div>
      </motion.section>

      {/* Features */}
      <section id="features" className="bg-card/50 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold gradient-text uppercase tracking-widest mb-3">{t("landing.features")}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight">{t("landing.featuresTitle")}</motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5"
          >
            {featureKeys.map((f) => (
              <motion.div
                key={f.titleKey}
                variants={fadeUp}
                className="card-premium p-6 sm:p-8 group"
              >
                <div className={"w-12 h-12 rounded-xl " + f.bg + " flex items-center justify-center mb-5"}>
                  <f.icon className={"w-6 h-6 " + f.color} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social proof */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground font-medium mb-8">{t("landing.builtFor")}</motion.p>
          <motion.div variants={fadeUp} className="grid grid-cols-3 max-w-xl mx-auto">
            {audienceKeys.map((a) => (
              <div key={a.key} className="flex flex-col items-center gap-2.5">
                <div className={"w-14 h-14 rounded-2xl flex items-center justify-center " + a.bg}>
                  <a.icon className={"w-6 h-6 " + a.color} />
                </div>
                <span className="text-sm font-medium text-foreground text-center">{t(a.labelKey)}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* CTA */}
      <section id="cta" className="bg-card/50 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center flex flex-col items-center"
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {t("landing.ctaTitle")}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground mb-8 max-w-md">
              {t("landing.ctaDesc")}
            </motion.p>
            <motion.div variants={fadeUp}>
              <WaitlistForm />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={trakalogLogo} alt="Trakalog" className="w-7 h-7 rounded-lg object-contain" />
            <span className="text-sm font-semibold gradient-text">TRAKALOG</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t("landing.privacyPolicy")}</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">{t("landing.termsOfService")}</Link>
            <a href="mailto:contact@trakalog.com" className="hover:text-foreground transition-colors">{t("landing.contact")}</a>
          </div>
          <p className="text-xs text-muted-foreground/60">{t("landing.copyright")}</p>
        </div>
      </footer>
    </div>
  );
}
