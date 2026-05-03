import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayout } from "./components/layout";
import NotFound from "./pages/not-found";

// Pages
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Processes from "./pages/processes/index";
import NewProcess from "./pages/processes/new";
import ProcessDetail from "./pages/processes/[id]";
import CandidatesList from "./pages/processes/candidates";
import CandidateDetail from "./pages/candidates/[id]";
import SharedReport from "./pages/report/[token]";
import Interview from "./pages/interview/[token]";
import Admin from "./pages/admin";
import AdminCompany from "./pages/admin-company";
import Impersonate from "./pages/impersonate";
import Settings from "./pages/settings";
import Billing from "./pages/settings/billing";
import ManagerView from "./pages/manager/[token]";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(230 50% 25%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215.4 16.3% 46.9%)",
    colorDanger: "hsl(0 84.2% 60.2%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214 32% 91%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold text-primary",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium text-foreground",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "font-medium text-primary hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground bg-white px-2",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // Capture ?plan= from URL and persist it before Clerk takes over the flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan && ["trial", "starter", "growth", "enterprise"].includes(plan)) {
      localStorage.setItem("hf_pending_plan", plan);
    }
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ProtectedRoute({ component: Component, layout = true }: { component: any, layout?: boolean }) {
  const { isLoaded, isSignedIn } = useUser();
  const hasImpersonation = !!sessionStorage.getItem("hf_imp");

  if (!isLoaded && !hasImpersonation) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (!isSignedIn && !hasImpersonation) return <Redirect to="/sign-in" />;

  if (layout) {
    return <AppLayout><Component /></AppLayout>;
  }
  return <Component />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return <div className="p-8 text-red-500">Missing VITE_CLERK_PUBLISHABLE_KEY</div>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/i/:token" component={Interview} />
            <Route path="/report/:token" component={SharedReport} />
            <Route path="/admin" component={Admin} />
            <Route path="/admin/companies/:id" component={AdminCompany} />
            <Route path="/impersonate" component={Impersonate} />
            <Route path="/manager/:token" component={ManagerView} />
            
            {/* Protected Routes */}
            <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
            <Route path="/processes/new"><ProtectedRoute component={NewProcess} /></Route>
            <Route path="/processes/:id/candidates"><ProtectedRoute component={CandidatesList} /></Route>
            <Route path="/processes/:id"><ProtectedRoute component={ProcessDetail} /></Route>
            <Route path="/processes"><ProtectedRoute component={Processes} /></Route>
            <Route path="/candidates/:id"><ProtectedRoute component={CandidateDetail} /></Route>
            <Route path="/settings/billing"><ProtectedRoute component={Billing} /></Route>
            <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
            
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;