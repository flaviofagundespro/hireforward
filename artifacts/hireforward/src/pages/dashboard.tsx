import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetDashboardSummary, useGetWeeklyActivity, useListProcesses, useGetCompanySettings } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, CheckCircle, Percent, ArrowRight, Coins, DollarSign, TrendingUp, Zap, Sparkles, X, Clock, Rocket } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function fetchUsage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/dashboard/usage`);
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json() as Promise<{
    month: { tokensInput: number; tokensOutput: number; tokensTotal: number; costUsd: number };
    year: { tokensInput: number; tokensOutput: number; tokensTotal: number; costUsd: number };
    months: { month: string; tokensInput: number; tokensOutput: number; costUsd: number }[];
    pricing: { priceInput: number; priceOutput: number; maxTokensPerSession: number };
  }>;
}

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  trial:      { bg: "bg-blue-50 border-blue-100",   text: "text-blue-900",  badge: "bg-blue-100 text-blue-700" },
  starter:    { bg: "bg-green-50 border-green-100",  text: "text-green-900", badge: "bg-green-100 text-green-700" },
  growth:     { bg: "bg-indigo-50 border-indigo-100", text: "text-indigo-900", badge: "bg-indigo-100 text-indigo-700" },
  enterprise: { bg: "bg-amber-50 border-amber-100",  text: "text-amber-900", badge: "bg-amber-100 text-amber-700" },
};

const TRIAL_DAYS = 14;

function TrialCountdown({ createdAt, plan }: { createdAt: string; plan: string }) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const daysSince = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  const daysLeft = Math.max(0, TRIAL_DAYS - daysSince);
  const pct = Math.min(1, daysSince / TRIAL_DAYS);

  if (daysLeft === 0 && plan === "enterprise") return null;

  const urgent = daysLeft <= 3;
  const warning = daysLeft <= 7 && daysLeft > 3;

  const ringColor = urgent ? "#ef4444" : warning ? "#f59e0b" : "#10b981";
  const bgClass  = urgent ? "bg-red-50 border-red-100"    : warning ? "bg-amber-50 border-amber-100"  : "bg-emerald-50 border-emerald-100";
  const textClass = urgent ? "text-red-800"                : warning ? "text-amber-800"                 : "text-emerald-800";
  const subClass  = urgent ? "text-red-600"                : warning ? "text-amber-600"                 : "text-emerald-600";

  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className={`flex items-center gap-5 rounded-xl border px-5 py-4 ${bgClass}`}>
      {/* SVG ring */}
      <div className="flex-shrink-0 relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={ringColor} strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-extrabold leading-none ${textClass}`}>{daysLeft}</span>
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${subClass}`}>days</span>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${textClass}`}>
          {daysLeft === 0
            ? `Your ${planLabel} trial has ended.`
            : urgent
            ? `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your ${planLabel} trial!`
            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining on your ${planLabel} trial.`}
        </p>
        <p className={`text-xs mt-0.5 ${subClass}`}>
          {daysLeft === 0
            ? "Upgrade now to keep all your processes and data."
            : "Upgrade before your trial ends to avoid any interruption."}
        </p>
      </div>

      {/* CTA */}
      <a href={`${basePath}/#pricing`} className="flex-shrink-0">
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: urgent ? "#ef4444" : warning ? "#f59e0b" : "#10b981" }}
        >
          <Rocket className="h-3.5 w-3.5" />
          Upgrade Now
        </button>
      </a>
    </div>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: weeklyActivity, isLoading: isLoadingWeekly } = useGetWeeklyActivity();
  const { data: processes, isLoading: isLoadingProcesses } = useListProcesses();
  const { data: usage, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["dashboard-usage"],
    queryFn: fetchUsage,
    retry: false,
  });
  const { data: companySettings } = useGetCompanySettings();

  const [planBanner, setPlanBanner] = useState<string | null>(null);

  // On first mount: pick up any plan chosen from the pricing page, apply it via API
  useEffect(() => {
    const pending = localStorage.getItem("hf_pending_plan");
    if (!pending) return;
    localStorage.removeItem("hf_pending_plan");

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: pending }),
      credentials: "include",
    })
      .then((r) => { if (r.ok) { setPlanBanner(pending); qc.invalidateQueries(); } })
      .catch(() => {});
  }, []);

  const activeProcesses = processes?.filter(p => p.status === "active") || [];

  const tokensMonth = usage?.month.tokensTotal ?? 0;
  const costMonth = usage?.month.costUsd ?? 0;
  const tokensYear = usage?.year.tokensTotal ?? 0;
  const costYear = usage?.year.costUsd ?? 0;

  const planColors = planBanner ? (PLAN_COLORS[planBanner] ?? PLAN_COLORS.trial) : null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Plan activation banner ─────────────────────────────────────────── */}
      {planBanner && planColors && (
        <div className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${planColors.bg}`}>
          <Sparkles className={`h-5 w-5 mt-0.5 flex-shrink-0 ${planColors.text}`} />
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${planColors.text}`}>
              Welcome to HireForward!{" "}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ml-1 ${planColors.badge}`}>
                {PLAN_LABELS[planBanner]} plan
              </span>{" "}
              {planBanner !== "trial" ? "— your 14-day free trial has started." : "— you're all set."}
            </p>
            <p className={`text-xs mt-0.5 opacity-75 ${planColors.text}`}>
              {planBanner === "trial"
                ? "You can upgrade to a paid plan anytime from Settings."
                : "No credit card charged yet. Full access starts now."}
            </p>
          </div>
          <button onClick={() => setPlanBanner(null)} className={`flex-shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity ${planColors.text}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your hiring activity and active processes.</p>
      </div>

      {/* ── Trial countdown widget ──────────────────────────────────────────── */}
      {companySettings?.createdAt && companySettings.plan !== "enterprise" && (
        <TrialCountdown createdAt={companySettings.createdAt} plan={companySettings.plan} />
      )}

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.totalCandidatesEvaluated || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Processes</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-primary">{summary?.activeProcesses || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Processes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.closedProcesses || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Approval</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.averageApprovalRate || 0}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Activity (Last 8 Weeks)</CardTitle>
            <CardDescription>Candidates evaluated per week.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingWeekly ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-md" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyActivity || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="candidatesEvaluated" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Active Processes</CardTitle>
            <CardDescription>Currently running job processes.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProcesses ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : activeProcesses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active processes found.
              </div>
            ) : (
              <div className="space-y-6">
                {activeProcesses.slice(0, 5).map(process => (
                  <div key={process.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/processes/${process.id}`} className="font-medium hover:underline text-foreground">
                        {process.title}
                      </Link>
                      <Badge variant="outline" className="text-xs">{process.area}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{process.candidatesEvaluated} / {process.candidatesTotal} evaluated</span>
                      <span>{Math.round((process.candidatesEvaluated / (process.candidatesTotal || 1)) * 100)}%</span>
                    </div>
                    <Progress value={(process.candidatesEvaluated / (process.candidatesTotal || 1)) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6">
              <Link href="/processes">
                <Button variant="outline" className="w-full">
                  View All Processes <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Usage</h2>
          <span className="text-xs text-muted-foreground ml-1">— tokens consumed in AI interviews &amp; evaluations</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Tokens (mo.)</CardTitle>
              <Coins className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {tokensMonth.toLocaleString()}
                  </div>
                  <p className="text-xs text-blue-500 mt-1">
                    {usage?.month.tokensInput.toLocaleString()} in · {usage?.month.tokensOutput.toLocaleString()} out
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-100 dark:bg-green-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Cost (mo.)</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    ${costMonth.toFixed(4)}
                  </div>
                  <p className="text-xs text-green-500 mt-1">USD accumulated this month</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-100 dark:bg-purple-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Tokens (year)</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {tokensYear.toLocaleString()}
                  </div>
                  <p className="text-xs text-purple-500 mt-1">Accumulated YTD</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-100 dark:bg-orange-950/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Cost (year)</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoadingUsage ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    ${costYear.toFixed(4)}
                  </div>
                  <p className="text-xs text-orange-500 mt-1">Total {new Date().getFullYear()}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly usage bar chart */}
        {!isLoadingUsage && (usage?.months ?? []).length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Tokens per Month (last 6 months)</CardTitle>
              <CardDescription>Input (blue) + Output (purple) tokens consumed per month.</CardDescription>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage?.months ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                    formatter={(val: number, name: string) => [val.toLocaleString(), name === "tokensInput" ? "Input" : "Output"]}
                  />
                  <Bar dataKey="tokensInput" stackId="a" fill="#93c5fd" radius={[0, 0, 4, 4]} name="tokensInput" />
                  <Bar dataKey="tokensOutput" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} name="tokensOutput" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {!isLoadingUsage && tokensMonth === 0 && (
          <div className="mt-4 p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No tokens consumed this month yet. AI usage will appear here after the first interviews.</p>
          </div>
        )}
      </div>
    </div>
  );
}
