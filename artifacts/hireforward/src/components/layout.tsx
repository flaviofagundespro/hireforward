import { Link, useLocation } from "wouter";
import { UserButton, useUser, useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Briefcase, LayoutDashboard, Settings, Loader2, ShieldAlert, X, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const IMP_SESSION_KEY = "hf_imp";

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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [location] = useLocation();
  const [impSession, setImpSession] = useState<ImpSession | null>(null);

  useEffect(() => {
    const imp = readImpSession();
    setImpSession(imp);

    if (imp) {
      // During impersonation, use the impersonation token as Bearer
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
