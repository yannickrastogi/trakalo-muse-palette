import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
type PlanId = "starter" | "pro" | "business";
type BillingCycle = "monthly" | "yearly";

const PLANS: {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 10,
    yearly: 90,
    features: ["Catalogue pré-release", "Partage sécurisé", "Watermarking invisible"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 25,
    yearly: 225,
    features: ["Tout Starter", "Smart A&R", "Sonic DNA", "Viewers gratuits"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 45,
    yearly: 405,
    features: ["Tout Pro", "Sécurité enterprise", "Leak tracing avancé", "Sièges illimités"],
  },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [pending, setPending] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_subscription");
    if (error) {
      toast.error("Impossible de charger votre abonnement.");
      setSub(null);
    } else {
      setSub((data as Subscription | null) ?? null);
      if (data && (data as Subscription).billing_cycle === "yearly") setCycle("yearly");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Retour de Stripe : ?checkout=success | cancel → toast puis nettoyage de l'URL.
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;
    if (checkout === "success") {
      toast.success("Paiement confirmé ! Votre compte sera mis à jour dans un instant.");
    } else if (checkout === "cancel") {
      toast("Paiement annulé.");
    }
    searchParams.delete("checkout");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redirectToStripe = async (
    key: string,
    body: { plan: PlanId; billing_cycle: BillingCycle } | { credits_pack: number },
  ) => {
    setPending(key);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", { body });
      if (error) {
        const msg = await readFunctionError(error);
        toast.error(msg ?? "La création du paiement a échoué. Réessayez.");
        return;
      }
      if (isSafeStripeUrl(data?.url)) {
        window.location.href = data.url;
      } else {
        toast.error("Réponse de paiement invalide.");
      }
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
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
        toast.error(msg ?? "Impossible d'ouvrir le portail de facturation.");
        return;
      }
      if (isSafeStripeUrl(data?.url)) {
        window.location.href = data.url;
      } else {
        toast.error("Réponse du portail invalide.");
      }
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Facturation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez votre abonnement, vos crédits et votre moyen de paiement.
            </p>
          </div>
          {hasBillingAccount && (
            <Button variant="outline" onClick={openPortal} disabled={pending !== null}>
              {pending === "portal" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Gérer mon abonnement
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
                  <p className="text-sm text-muted-foreground">Plan actuel</p>
                  <p className="font-semibold capitalize">
                    {currentPlan ?? "Aucun abonnement"}
                    {sub?.billing_cycle ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({sub.billing_cycle === "yearly" ? "annuel" : "mensuel"})
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              {sub?.subscription_status && (
                <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
                  {sub.cancel_at_period_end ? "Annulation programmée" : sub.subscription_status}
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
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
                (cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              Annuel
              <span className="ml-1.5 text-xs text-emerald-600">−25%</span>
            </button>
          </div>
        </div>

        {/* Cartes plans */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = cycle === "yearly" ? plan.yearly : plan.monthly;
            const isCurrent = currentPlan === plan.id && sub?.billing_cycle === cycle && isActive;
            const key = "plan-" + plan.id;
            return (
              <Card
                key={plan.id}
                className={"flex flex-col " + (plan.highlighted ? "border-primary shadow-sm" : "")}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.highlighted && <Badge>Populaire</Badge>}
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">${price}</span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {cycle === "yearly" ? "an" : "mois"}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
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
                    disabled={pending !== null || isCurrent}
                    onClick={() => redirectToStripe(key, { plan: plan.id, billing_cycle: cycle })}
                  >
                    {pending === key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isCurrent ? "Plan actuel" : "S'abonner"}
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
            <h2 className="text-lg font-semibold">Crédits IA</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Achetez des crédits ponctuels pour Smart A&amp;R, transcription et analyses.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CREDIT_PACKS.map((pack) => {
              const key = "credits-" + pack.credits;
              return (
                <Card key={pack.credits} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{pack.credits} crédits</p>
                    <p className="text-sm text-muted-foreground">Paiement unique</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold">${pack.price}</span>
                    <Button
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() => redirectToStripe(key, { credits_pack: pack.credits })}
                    >
                      {pending === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Acheter
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
