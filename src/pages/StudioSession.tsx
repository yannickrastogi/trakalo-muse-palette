import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/constants";
import { DEFAULT_COVER } from "@/lib/constants";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { Music, User, Mail, Briefcase, DollarSign, CheckCircle, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

var PRO_SUGGESTIONS = ["ASCAP", "BMI", "SESAC", "SOCAN", "SACEM", "PRS", "GEMA", "JASRAC", "APRA"];

var ROLE_OPTIONS = [
  { value: "Songwriter", labelKey: "studioQr.songwriter" },
  { value: "Producer", labelKey: "studioQr.producer" },
  { value: "Composer", labelKey: "studioQr.composer" },
  { value: "Topliner", labelKey: "studioQr.topliner" },
  { value: "Beat Maker", labelKey: "studioQr.beatMaker" },
  { value: "Musician", labelKey: "studioQr.musician" },
  { value: "Mix Engineer", labelKey: "studioQr.mixEngineer" },
  { value: "Mastering Engineer", labelKey: "studioQr.masteringEngineer" },
  { value: "Featured Artist", labelKey: "studioQr.featuredArtist" },
  { value: "Background Vocalist", labelKey: "studioQr.backgroundVocalist" },
  { value: "Other", labelKey: "studioQr.other" },
];

var inputClass = "h-11 w-full px-4 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none focus:border-primary/40 transition-colors";

export default function StudioSession() {
  var anonClient = useRef(createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })).current;
  var { token } = useParams();
  var { t } = useTranslation();

  var [loading, setLoading] = useState<boolean>(true);
  var [error, setError] = useState<string | null>(null);
  var [trackData, setTrackData] = useState<{ id: string; title: string; artist: string; cover_url: string | null; workspace_id: string } | null>(null);
  var [mode, setMode] = useState<"welcome" | "form" | "success">("welcome");
  var [step, setStep] = useState<1 | 2 | 3>(1);
  var [fullName, setFullName] = useState("");
  var [email, setEmail] = useState("");
  var [artistName, setArtistName] = useState("");
  var [roles, setRoles] = useState<string[]>([]);
  var [proName, setProName] = useState("");
  var [ipiNumber, setIpiNumber] = useState("");
  var [publisherName, setPublisherName] = useState("");
  // Split is calculated automatically by admin — guest doesn't choose
  var [confirmed, setConfirmed] = useState(false);
  var [submitting, setSubmitting] = useState(false);
  var [submitError, setSubmitError] = useState<string | null>(null);
  var [existingSubmissions, setExistingSubmissions] = useState<{ full_name: string }[]>([]);

  useEffect(function () {
    if (!token) {
      setError(t("studioQr.invalidToken"));
      setLoading(false);
      return;
    }

    anonClient
      .from("tracks")
      .select("id, title, artist, cover_url, workspace_id")
      .eq("qr_token", token)
      .single()
      .then(function (res) {
        if (res.error || !res.data) {
          setError(t("studioQr.invalidToken"));
          setLoading(false);
          return;
        }
        setTrackData(res.data);

        anonClient
          .from("studio_submissions")
          .select("full_name")
          .eq("track_id", res.data.id)
          .neq("status", "rejected")
          .then(function (subRes) {
            if (subRes.data) {
              setExistingSubmissions(subRes.data);
            }
            setLoading(false);
          }).catch(function (err) { console.error("Error:", err); });
      }).catch(function (err) { console.error("Error:", err); });
  }, [token]);

  function toggleRole(value: string) {
    setRoles(function (prev) {
      if (prev.indexOf(value) >= 0) {
        return prev.filter(function (r) { return r !== value; });
      }
      return prev.concat([value]);
    });
  }

  function handleSubmit() {
    if (!trackData) return;
    if (!fullName.trim()) {
      setSubmitError(t("studioQr.nameRequired"));
      return;
    }
    if (!email.trim()) {
      setSubmitError(t("studioQr.emailRequired"));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    anonClient
      .from("studio_submissions")
      .insert({
        track_id: trackData.id,
        email: email.trim(),
        full_name: fullName.trim(),
        artist_name: artistName.trim() || null,
        roles: roles,
        pro_name: proName.trim() || null,
        ipi_number: ipiNumber.trim() || null,
        publisher_name: publisherName.trim() || null,
        proposed_split: 0,
        justification: null,
      })
      .then(function (res) {
        setSubmitting(false);
        if (res.error) {
          if (res.error.code === "23505") {
            setSubmitError(t("studioQr.alreadySubmittedError"));
          } else {
            setSubmitError(res.error.message);
          }
          return;
        }
        // Auto-add collaborator to admin's contacts
        var nameParts = fullName.trim().split(" ");
        var firstName = nameParts[0] || "";
        var lastName = nameParts.slice(1).join(" ") || "";
        anonClient.functions.invoke("auto-add-contact", {
          body: {
            workspace_id: trackData.workspace_id,
            email: email.trim(),
            first_name: firstName,
            last_name: lastName,
            role: roles.length > 0 ? roles.join(", ") : null,
            company: publisherName.trim() || null,
          },
        });
        setMode("success");
      }).catch(function (err) { console.error("Error:", err); });
  }

  var stepLabels = useMemo(function () {
    return [
      t("studioQr.stepIdentity"),
      t("studioQr.stepRole"),
      t("studioQr.stepConfirm"),
    ];
  }, [t]);

  function NavHeader() {
    return (
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3">
              <img src={trakalogLogo} alt="Trakalog" className="h-10" />
              <span
                className="text-xl font-bold tracking-wider uppercase"
                style={{
                  background: "linear-gradient(90deg, #f97316, #ec4899, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Trakalog
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-1">
              Catalog Manager
            </span>
          </div>
        </div>
      </header>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  // Error
  if (error || !trackData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg text-foreground">{error || t("studioQr.invalidToken")}</p>
        </div>
      </div>
    );
  }

  // Success
  if (mode === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-lg mx-auto px-4 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}>
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-3">{t("studioQr.thankYou")}</h2>
          <p className="text-muted-foreground">{t("studioQr.thankYouDesc")}</p>

          {existingSubmissions.length > 0 && (
            <div className="mt-8">
              <p className="text-sm text-muted-foreground">{t("studioQr.alreadySubmitted")}</p>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {existingSubmissions.map(function (s, i) {
                  return (
                    <span key={i} className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground">
                      {s.full_name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Welcome
  if (mode === "welcome") {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader />

        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <img
            src={trackData.cover_url || DEFAULT_COVER}
            alt={trackData.title}
            className="rounded-2xl max-w-[200px] mx-auto shadow-lg"
          />
          <h1 className="text-2xl font-bold text-foreground mt-6">{trackData.title}</h1>
          <p className="text-muted-foreground mt-1">{trackData.artist}</p>
          <p className="text-muted-foreground mt-6">{t("studioQr.invitedContribution")}</p>

          <div className="flex flex-col gap-3 mt-8">
            <button
              className="btn-brand w-full min-h-[44px] rounded-xl font-semibold"
              onClick={function () { setMode("form"); }}
            >
              {t("studioQr.continueAsGuest")}
            </button>
            <Link
              to="/auth"
              className="w-full min-h-[44px] rounded-xl border border-border text-muted-foreground flex items-center justify-center font-semibold hover:bg-secondary transition-colors"
            >
              {t("studioQr.signIn")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map(function (s, i) {
            var isActive = step === s;
            var isCompleted = step > s;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors " +
                      (isCompleted
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-brand-orange text-white"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    {isCompleted ? "\u2713" : s}
                  </div>
                  <span className={"text-[10px] mt-1 " + (isActive ? "text-brand-orange" : "text-muted-foreground")}>
                    {stepLabels[i]}
                  </span>
                </div>
                {i < 3 && (
                  <div
                    className={
                      "flex-1 h-[2px] mx-2 " +
                      (isCompleted ? "bg-emerald-500" : "bg-border")
                    }
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Identity */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <User className="h-4 w-4" />
                {t("studioQr.fullName")} *
              </label>
              <input
                type="text"
                className={inputClass}
                value={fullName}
                onChange={function (e) { setFullName(e.target.value); }}
                placeholder={t("studioQr.fullNamePlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("studioQr.email")} *
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={function (e) { setEmail(e.target.value); }}
                placeholder={t("studioQr.emailPlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Music className="h-4 w-4" />
                {t("studioQr.artistName")}
              </label>
              <input
                type="text"
                className={inputClass}
                value={artistName}
                onChange={function (e) { setArtistName(e.target.value); }}
                placeholder={t("studioQr.artistNamePlaceholder")}
              />
            </div>
            <button
              className="btn-brand w-full min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2"
              onClick={function () {
                if (!fullName.trim() || !email.trim()) return;
                setStep(2);
              }}
            >
              {t("studioQr.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2: Role & PRO */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {t("studioQr.roleInTrack")}
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ROLE_OPTIONS.map(function (opt) {
                  var active = roles.indexOf(opt.value) >= 0;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={
                        "px-3 py-2 rounded-xl text-sm font-medium border min-h-[44px] transition-colors " +
                        (active
                          ? "bg-brand-orange/10 border-brand-orange text-brand-orange"
                          : "bg-secondary border-border text-muted-foreground hover:border-primary/40")
                      }
                      onClick={function () { toggleRole(opt.value); }}
                    >
                      {t(opt.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t("studioQr.proName")}</label>
              <input
                type="text"
                className={inputClass}
                value={proName}
                onChange={function (e) { setProName(e.target.value); }}
                list="pro-suggestions"
                placeholder={t("studioQr.proPlaceholder")}
              />
              <datalist id="pro-suggestions">
                {PRO_SUGGESTIONS.map(function (p) {
                  return <option key={p} value={p} />;
                })}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t("studioQr.ipiNumber")}</label>
              <input
                type="text"
                className={inputClass}
                value={ipiNumber}
                onChange={function (e) { setIpiNumber(e.target.value); }}
                placeholder={t("studioQr.ipiPlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t("studioQr.publisher")}</label>
              <input
                type="text"
                className={inputClass}
                value={publisherName}
                onChange={function (e) { setPublisherName(e.target.value); }}
                placeholder={t("studioQr.publisherPlaceholder")}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 min-h-[44px] rounded-xl border border-border text-muted-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
                onClick={function () { setStep(1); }}
              >
                <ArrowLeft className="h-4 w-4" /> {t("studioQr.back")}
              </button>
              <button
                className="flex-1 btn-brand min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2"
                onClick={function () { setStep(3); }}
              >
                {t("studioQr.next")} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">{t("studioQr.review")}</h3>
            <div className="card-premium p-4 space-y-3 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("studioQr.fullName")}</span>
                <span className="text-foreground font-medium">{fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("studioQr.email")}</span>
                <span className="text-foreground font-medium">{email}</span>
              </div>
              {artistName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioQr.artistName")}</span>
                  <span className="text-foreground font-medium">{artistName}</span>
                </div>
              )}
              {roles.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioQr.roleInTrack")}</span>
                  <span className="text-foreground font-medium">{roles.join(", ")}</span>
                </div>
              )}
              {proName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioQr.proName")}</span>
                  <span className="text-foreground font-medium">{proName}</span>
                </div>
              )}
              {ipiNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioQr.ipiNumber")}</span>
                  <span className="text-foreground font-medium">{ipiNumber}</span>
                </div>
              )}
              {publisherName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("studioQr.publisher")}</span>
                  <span className="text-foreground font-medium">{publisherName}</span>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={function (e) { setConfirmed(e.target.checked); }}
                className="accent-brand-orange w-5 h-5"
              />
              <span className="text-sm text-foreground">{t("studioQr.confirmAccuracy")}</span>
            </label>

            {submitError && (
              <p className="text-destructive text-sm">{submitError}</p>
            )}

            <div className="flex gap-2">
              <button
                className="flex-1 min-h-[44px] rounded-xl border border-border text-muted-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
                onClick={function () { setStep(2); }}
              >
                <ArrowLeft className="h-4 w-4" /> {t("studioQr.back")}
              </button>
              <button
                className="flex-1 btn-brand min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={!confirmed || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {submitting ? t("studioQr.submitting") : t("studioQr.submit")}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
