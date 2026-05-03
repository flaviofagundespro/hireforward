import { Link, useLocation } from "wouter";
import { UserButton, useUser, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Briefcase, LayoutDashboard, Settings, Loader2, ShieldAlert, X, CreditCard, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const IMP_SESSION_KEY = "hf_imp";
const PAYMENT_BANNER_DISMISSED_KEY = "hf_payment_banner_v1";

type ImpSession = {
  token: string;
  companyId: string;
  companyName: string;
  startedAt: string;
};

function readImpSession(): ImpSession | null {
  try {
    const raw = sessionStorage.getItem(IMP_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImpSession;
  } catch {
    return null;
  }
}

/* ─── Payment Issue Banner ───────────────────────────────────────────────── */

function PaymentIssueBanner() {
  const [location] = useLocation();

  // Per-session dismissal — resets on next login (sessionStorage is cleared on tab close)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(PAYMENT_BANNER_DISMISSED_KEY) === "1",
  );
  const [portalLoading, setPortalLoading] = useState(false);

  // Reuse the same query key as the billing page so they share a cache hit
  const { data } = useQuery<{ status: string } | null>({
    queryKey: ["billing-status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — don't hammer the API on every route change
    retry: false,
  });

  const isPastDue = data?.status === "past_due";
  const isSuspended = data?.status === "suspended";
  const needsBanner =
    (isPastDue || isSuspended) &&
    !dismissed &&
    !location.startsWith("/settings/billing");

  if (!needsBanner) return null;

  const handleFixNow = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const body = (await res.json()) as { url: string };
        window.location.href = body.url;
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(PAYMENT_BANNER_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  // past_due → amber-tinted red (urgent). suspended → solid deep-red (access at risk).
  const bgClass = isSuspended
    ? "bg-red-700"
    : "bg-gradient-to-r from-red-600 to-red-500";

  const message = isSuspended
    ? "Your account has been suspended due to a failed payment. Restore access now."
    : "Your subscription has a payment issue. Update your payment method to avoid losing access.";

  return (
    <div
      className={`${bgClass} text-white px-4 py-3 flex items-center justify-between gap-3 shrink-0 z-40 shadow-md`}
      role="alert"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-100" />
        <span className="text-sm font-medium leading-snug">
          {isSuspended ? "🔴" : "⚠️"} {message}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleFixNow}
          disabled={portalLoading}
          className="inline-flex items-center gap-1.5 bg-white text-red-700 hover:bg-red-50 active:bg-red-100 px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
        >
          {portalLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : null}
          Fix Now →
        </button>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss payment warning"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── App Layout ─────────────────────────────────────────────────────────── */

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [location] = useLocation();
  const [impSession, setImpSession] = useState<ImpSession | null>(null);

  useEffect(() => {
    const imp = readImpSession();
    setImpSession(imp);

    if (imp) {
      setAuthTokenGetter(() => Promise.resolve(imp.token));
    } else {
      setAuthTokenGetter(() => getToken());
    }
  }, [getToken]);

  const exitImpersonation = () => {
    sessionStorage.removeItem(IMP_SESSION_KEY);
    setImpSession(null);
    setAuthTokenGetter(() => getToken());
    window.location.href = "/admin";
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn && !impSession) {
    return null;
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/processes", label: "Processes", icon: Briefcase },
    { href: "/settings/billing", label: "Billing", icon: CreditCard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Impersonation banner */}
      {impSession && (
        <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-md z-50">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Admin view — viewing account of{" "}
              <span className="font-bold underline decoration-dotted">{impSession.companyName}</span>
            </span>
          </div>
          <button
            onClick={exitImpersonation}
            className="flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            Exit impersonation
          </button>
        </div>
      )}

      {/* Payment issue banner — shown on all pages except /settings/billing */}
      <PaymentIssueBanner />

      <div className="flex flex-1 md:flex-row flex-col overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-card border-r border-border flex flex-col flex-shrink-0">
          <div className="h-16 flex items-center px-6 border-b border-border">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="HireForward" className="h-6 w-6" />
              HireForward
            </Link>
          </div>

          <div className="flex-1 py-6 px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-border">
            {impSession ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {impSession.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{impSession.companyName}</span>
                  <span className="text-xs text-orange-500 font-medium">Admin view</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2">
                <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground truncate w-32">
                    {user?.fullName || user?.primaryEmailAddress?.emailAddress}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-32">
                    {user?.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden h-[100dvh]">
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
