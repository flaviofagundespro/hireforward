import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Zap, TrendingUp, Building2, ExternalLink, Loader2, AlertCircle, Users, Activity, DollarSign, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

type BillingStatus = {
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  candidateLimit: number;
  usage: {
    candidatesThisMonth: number;
    tokensInputThisMonth: number;
    tokensOutputThisMonth: number;
    costUsdThisMonth: number;
  };
  subscription: {
    id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
};

type Plan = {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: { id: string; unitAmount: number; currency: string }[];
};

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-slate-100 text-slate-700 border-slate-200",
  starter: "bg-blue-100 text-blue-700 border-blue-200",
  growth: "bg-violet-100 text-violet-700 border-violet-200",
  enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

const PLAN_ORDER = ["starter", "growth", "enterprise"];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Billing() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isSuccess = location.includes("success=1") || new URLSearchParams(window.location.search).get("success") === "1";
  const isCanceled = new URLSearchParams(window.location.search).get("canceled") === "1";

  const { data: billing, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["billing-status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load billing");
      return res.json();
    },
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      if (!res.ok) return { plans: [] };
      return res.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to start checkout");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setCheckoutLoading(null);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to open portal");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setPortalLoading(false);
    },
  });

  const handleCheckout = (priceId: string) => {
    setCheckoutLoading(priceId);
    checkoutMutation.mutate(priceId);
  };

  const handlePortal = () => {
    setPortalLoading(true);
    portalMutation.mutate();
  };

  const plans = (plansData?.plans ?? [])
    .filter((p) => {
      const key = (p.metadata?.plan_key ?? p.name.toLowerCase()) as string;
      return PLAN_ORDER.includes(key);
    })
    .sort((a, b) => {
      const aKey = a.metadata?.plan_key ?? a.name.toLowerCase();
      const bKey = b.metadata?.plan_key ?? b.name.toLowerCase();
      return PLAN_ORDER.indexOf(aKey) - PLAN_ORDER.indexOf(bKey);
    });

  const currentPlan = billing?.plan ?? "trial";
  const candidateLimit = billing?.candidateLimit ?? 3;
  const candidatesUsed = billing?.usage.candidatesThisMonth ?? 0;
  const usagePct = candidateLimit >= 999999 ? 0 : Math.min(100, Math.round((candidatesUsed / candidateLimit) * 100));
  const isAtLimit = candidatesUsed >= candidateLimit && candidateLimit < 999999;
  const isPaidPlan = currentPlan !== "trial";

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and monitor usage.</p>
      </div>

      {isSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium">Subscription activated! Your plan has been upgraded.</span>
        </div>
      )}

      {isCanceled && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Checkout was canceled. Your plan was not changed.</span>
        </div>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg">Current Plan</CardTitle>
              <CardDescription>Your active subscription and billing cycle.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`capitalize border ${PLAN_COLORS[currentPlan] ?? PLAN_COLORS.trial} font-semibold px-3 py-1`}>
                {currentPlan}
              </Badge>
              {isPaidPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {billingLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <>
              {billing?.subscription && (
                <div className="text-sm text-muted-foreground">
                  Current period:{" "}
                  <span className="text-foreground font-medium">
                    {formatDate(billing.subscription.current_period_start)} — {formatDate(billing.subscription.current_period_end)}
                  </span>
                  {billing.subscription.cancel_at_period_end && (
                    <span className="ml-2 text-amber-600 font-medium">· Cancels at period end</span>
                  )}
                </div>
              )}

              {currentPlan === "trial" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  You're on the free trial — limited to <strong>{candidateLimit} interviews</strong> total. Upgrade to unlock more.
                </div>
              )}

              {/* Candidate usage bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-4 w-4" /> Interviews this month
                  </span>
                  <span className={`font-semibold ${isAtLimit ? "text-red-600" : "text-foreground"}`}>
                    {candidatesUsed} / {candidateLimit >= 999999 ? "∞" : candidateLimit}
                  </span>
                </div>
                {candidateLimit < 999999 && (
                  <Progress value={usagePct} className={`h-2 ${isAtLimit ? "[&>div]:bg-red-500" : ""}`} />
                )}
                {isAtLimit && (
                  <p className="text-xs text-red-600 font-medium">
                    Limit reached — new interview invites are blocked. Upgrade to continue.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {billingLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{billing?.usage.candidatesThisMonth ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Interviews this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatTokens((billing?.usage.tokensInputThisMonth ?? 0) + (billing?.usage.tokensOutputThisMonth ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Tokens consumed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      ${(billing?.usage.costUsdThisMonth ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">AI cost this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Plan Selection (shown when on trial or upgrading) */}
      {!isPaidPlan && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Choose a Plan</h2>
            <p className="text-sm text-muted-foreground">Upgrade to unlock more interviews and features.</p>
          </div>

          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
                Plans are loading. The Stripe integration may still be syncing — check back in a moment.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const key = plan.metadata?.plan_key ?? plan.name.toLowerCase();
                const price = plan.prices[0];
                const isEnterprise = key === "enterprise";
                const candidateLabel = plan.metadata?.highlight ?? "";
                const isPopular = key === "growth";

                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col ${isPopular ? "border-2 border-primary shadow-md" : ""}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        Most popular
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        {key === "starter" && <Zap className="h-5 w-5 text-blue-500" />}
                        {key === "growth" && <TrendingUp className="h-5 w-5 text-violet-500" />}
                        {key === "enterprise" && <Building2 className="h-5 w-5 text-amber-500" />}
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                      </div>
                      <div className="mt-2">
                        {isEnterprise ? (
                          <span className="text-2xl font-bold text-foreground">Custom</span>
                        ) : price ? (
                          <>
                            <span className="text-3xl font-bold text-foreground">
                              ${Math.round((price.unitAmount ?? 0) / 100)}
                            </span>
                            <span className="text-muted-foreground text-sm">/month</span>
                          </>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 gap-4">
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      {candidateLabel && (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          {candidateLabel}
                        </div>
                      )}
                      <div className="mt-auto pt-2">
                        {isEnterprise ? (
                          <Button variant="outline" className="w-full" asChild>
                            <a href="mailto:sales@hireforward.ai?subject=Enterprise Plan Inquiry">
                              Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                        ) : price ? (
                          <Button
                            className="w-full"
                            variant={isPopular ? "default" : "outline"}
                            onClick={() => handleCheckout(price.id)}
                            disabled={checkoutLoading === price.id}
                          >
                            {checkoutLoading === price.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Get Started
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manage subscription section for paid plans */}
      {isPaidPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Subscription Management
            </CardTitle>
            <CardDescription>
              Update your payment method, download invoices, or cancel your subscription via the billing portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Open Billing Portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
