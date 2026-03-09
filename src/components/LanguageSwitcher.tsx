import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const languages = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "pt", flag: "🇧🇷", label: "Português" },
  { code: "it", flag: "🇮🇹", label: "Italiano" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentLang = i18n.resolvedLanguage || i18n.language?.split("-")[0] || "en";
  const current = languages.find((l) => l.code === currentLang) || languages[0];

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px]"
        aria-label="Change language"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="text-[11px] font-semibold tracking-tight hidden sm:inline">{current.code.toUpperCase()}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1.5 w-48 bg-popover border border-border rounded-xl z-50 p-1 backdrop-blur-xl overflow-hidden max-h-[400px] overflow-y-auto"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              <div className="px-3 py-2 border-b border-border/50 mb-1">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-muted-foreground" />
                  <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Language</span>
                </div>
              </div>
              {languages.map((lang) => {
                const isActive = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleChange(lang.code)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span className="flex-1 text-left">{lang.label}</span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gradient-brand-horizontal)" }} />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
