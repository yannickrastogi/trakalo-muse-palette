import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import trakalogLogo from "@/assets/trakalog-logo.png";
import { useTranslation } from "react-i18next";

export default function Auth() {
  const { t } = useTranslation();
  const { session, loading, needsMfaVerification, signInWithGoogle, signInWithEmail, signUpWithEmail, verifyMfa } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const redirectParam = searchParams.get("redirect");
  const inviteParam = searchParams.get("invite");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session && !needsMfaVerification) {
    localStorage.setItem("trakalog_just_logged_in", "1");
    if (inviteParam) {
      return <Navigate to={"/invite/" + inviteParam} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (session && needsMfaVerification) {
    const handleMfaVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      const { error } = await verifyMfa(mfaCode);
      if (error) {
        toast.error(error.message);
        setMfaCode("");
      }
      setSubmitting(false);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: "var(--gradient-brand)" }} />
        </div>
        <div className="relative z-10 w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-center gap-2">
            <img src={trakalogLogo} alt="Trakalog" className="w-16 h-16 rounded-xl object-contain" />
            <h1 className="text-2xl font-bold tracking-tight gradient-text font-[Sora] mt-2">TRAKALOG</h1>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">{t("auth.twoFactorTitle", "Two-Factor Authentication")}</h2>
              <p className="text-sm text-muted-foreground text-center">{t("auth.twoFactorDescription", "Enter the 6-digit code from your authenticator app")}</p>
            </div>
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code">{t("auth.verificationCode", "Verification code")}</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={submitting || mfaCode.length !== 6}>
                {submitting ? t("auth.verifying", "Verifying...") : t("auth.verify", "Verify")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signInWithEmail(email, password);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error, needsConfirmation } = await signUpWithEmail(email, password);
    if (error) {
      toast.error(error.message);
    } else if (needsConfirmation) {
      toast.success(t("auth.checkEmail"));
    }
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    // Store redirect URL so we can use it after OAuth callback
    if (redirectParam) {
      localStorage.setItem("trakalog_auth_redirect", redirectParam);
    }
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Glow effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: "var(--gradient-brand)" }} />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <img
            src={trakalogLogo}
            alt="Trakalog"
            className="w-16 h-16 rounded-xl object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight gradient-text font-[Sora] mt-2">
            TRAKALOG
          </h1>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase font-medium">
            {t("auth.smartCatalogManager")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">{t("auth.login")}</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">{t("auth.register")}</TabsTrigger>
            </TabsList>

            {/* ── Google ── */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 mb-4 h-11 text-sm font-medium"
              onClick={handleGoogle}
              disabled={submitting}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("auth.continueWithGoogle")}
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">{t("auth.or")}</span></div>
            </div>

            {/* ── Login tab ── */}
            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t("auth.email")}</Label>
                  <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("auth.password")}</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" value={email ? password : ""} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full h-11" disabled={submitting}>
                  {submitting ? t("auth.signingIn") : t("auth.signIn")}
                </Button>
              </form>
            </TabsContent>

            {/* ── Register tab ── */}
            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t("auth.email")}</Label>
                  <Input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t("auth.password")}</Label>
                  <Input id="reg-password" type="password" placeholder={t("auth.minChars")} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full h-11" disabled={submitting}>
                  {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("auth.termsAgree")}
        </p>
      </div>
    </div>
  );
}
