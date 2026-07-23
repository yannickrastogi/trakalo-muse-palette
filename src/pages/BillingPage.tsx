import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Loader2, CreditCard, Sparkles, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Catalogue statique (les prix RÉELS sont résolus côté Stripe via stripe_prices) ─── */
type PlanId = "free" | "starter" | "pro" | "business";
type PaidPlanId = "starter" | "pro" | "business";
type BillingCycle = "monthly" | "yearly";

/* name = nom commercial (non traduit) ; les features sont résolues via i18n (billing.plans.<id>.features). */
const PLANS: {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  highlighted?: boolean;
}[] = [
  { id: "free", name: "Free", monthly: 0, yearly: 0 },
  { id: "starter", name: "Starter", monthly: 10, yearly: 90 },
  { id: "pro", name: "Pro", monthly: 25, yearly: 225, highlighted: true },
  { id: "business", name: "Business", monthly: 45, yearly: 405 },
];

const CREDIT_PACKS: { credits: number; price: number }[] = [
  { credits: 25, price: 5 },
  { credits: 100, price: 15 },
];

/* Statuts Stripe indiquant un abonnement réel (⇒ portail de facturation disponible). */
const BILLABLE_STATUSES = new Set(["active", "trialing", "past_due", "canceled", "unpaid"]);

interface Subscription {
  plan: string | null;
  billing_cycle: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  ai_credits_purchased: number | null;
  ai_credits_monthly_used: number | null;
}

/** Défense en profondeur : n'accepte qu'une URL de redirection Stripe en HTTPS. */
function isSafeStripeUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "stripe.com" || u.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
}

/** Extrait un message d'erreur lisible d'une FunctionsHttpError sans exposer d'interne. */
async function readFunctionError(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body && typeof body.error === "string") return body.error;
    }
  } catch {
    /* ignore — on retombe sur le message générique */
  }
  return null;
}

export default function BillingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [pending, setPending] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_subscription");
    if (error) {
      toast.error(t("billing.toast.loadFailed"));
      setSub(null);
    } else {
      setSub((data as Subscription | null) ?? null);
      if (data && (data as Subscription).billing_cycle === "yearly") setCycle("yearly");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Retour de Stripe : ?checkout=success | cancel → toast puis nettoyage de l'URL.
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;
    if (checkout === "success") {
      toast.success(t("billing.toast.checkoutSuccess"));
    } else if (checkout === "cancel") {
      toast(t("billing.toast.checkoutCanceled"));
    }
    searchParams.delete("checkout");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redirectToStripe = async (
    key: string,
    body: { plan: PaidPlanId; billing_cycle: BillingCycle } | { credits_pack: number },
  ) => {
    setPending(key);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", { body });
      if (error) {
        const msg = await readFunctionError(error);
        toast.error(msg ?? t("billing.toast.checkoutFailed"));
        return;
      }
      if (isSafeStripeUrl(data?.url)) {
        window.location.href = data.url;
      } else {
        toast.error(t("billing.toast.invalidPaymentResponse"));
      }
    } catch {
      toast.error(t("billing.toast.genericError"));
    } finally {
      setPending(null);
    }
  };

  const openPortal = async () => {
    setPending("portal");
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", { body: {} });
      if (error) {
        const msg = await readFunctionError(error);
        toast.error(msg ?? t("billing.toast.portalFailed"));
        return;
      }
      if (isSafeStripeUrl(data?.url)) {
        window.location.href = data.url;
      } else {
        toast.error(t("billing.toast.invalidPortalResponse"));
      }
    } catch {
      toast.error(t("billing.toast.genericError"));
    } finally {
      setPending(null);
    }
  };

  const currentPlan = sub?.plan ?? null;
  const isActive = sub?.subscription_status === "active" || sub?.subscription_status === "trialing";
  const hasBillingAccount = !!sub && BILLABLE_STATUSES.has(sub.subscription_status ?? "");

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        {/* En-tête */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("billing.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("billing.subtitle")}</p>
          </div>
          {hasBillingAccount && (
            <Button variant="outline" onClick={openPortal} disabled={pending !== null}>
              {pending === "portal" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {t("billing.managePlan")}
            </Button>
          )}
        </div>

        {/* Plan actuel */}
        {loading ? (
          <Skeleton className="mb-8 h-20 w-full rounded-lg" />
        ) : (
          <Card className="mb-8">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
                  <p className="font-semibold capitalize">
                    {currentPlan ?? t("billing.noSubscription")}
                    {sub?.billing_cycle ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({sub.billing_cycle === "yearly" ? t("billing.cycleYearlyLower") : t("billing.cycleMonthlyLower")})
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              {sub?.subscription_status && (
                <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
                  {sub.cancel_at_period_end
                    ? t("billing.cancelScheduled")
                    : t(`billing.status.${sub.subscription_status}`, { defaultValue: sub.subscription_status ?? "" })}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Toggle Mensuel / Annuel */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
                (cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t("billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
                (cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {t("billing.yearly")}
              <span className="ml-1.5 text-xs text-emerald-600">{t("billing.discountBadge")}</span>
            </button>
          </div>
        </div>

        {/* Cartes plans */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = cycle === "yearly" ? plan.yearly : plan.monthly;
            const isFree = plan.id === "free";
            // Sur le plan gratuit : "actuel" dès qu'aucun abonnement payant actif.
            const isCurrent = isFree
              ? !isActive || currentPlan === "free" || currentPlan == null
              : currentPlan === plan.id && sub?.billing_cycle === cycle && isActive;
            const key = "plan-" + plan.id;
            return (
              <Card
                key={plan.id}
                className={"flex flex-col " + (plan.highlighted ? "border-primary shadow-sm" : "")}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.highlighted && <Badge>{t("billing.popular")}</Badge>}
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">${price}</span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {cycle === "yearly" ? t("billing.perYear") : t("billing.perMonth")}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {(t(`billing.plans.${plan.id}.features`, { returnObjects: true }) as string[]).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={pending !== null || isCurrent || isFree}
                    onClick={
                      isFree
                        ? undefined
                        : () => redirectToStripe(key, { plan: plan.id as PaidPlanId, billing_cycle: cycle })
                    }
                  >
                    {pending === key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isFree ? t("billing.free") : isCurrent ? t("billing.currentPlan") : t("billing.subscribe")}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Crédits IA */}
        <div className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("billing.creditsTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t("billing.creditsSubtitle")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CREDIT_PACKS.map((pack) => {
              const key = "credits-" + pack.credits;
              return (
                <Card key={pack.credits} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{t("billing.creditsCount", { count: pack.credits })}</p>
                    <p className="text-sm text-muted-foreground">{t("billing.oneTimePayment")}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold">${pack.price}</span>
                    <Button
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() => redirectToStripe(key, { credits_pack: pack.credits })}
                    >
                      {pending === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t("billing.buy")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
