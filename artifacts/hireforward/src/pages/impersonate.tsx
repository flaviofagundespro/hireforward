import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertTriangle, CheckCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const IMP_SESSION_KEY = "hf_imp";

export default function Impersonate() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("Impersonation token not found in URL.");
      setStatus("error");
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/admin/impersonate/validate?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Invalid or expired token.");
        }
        return res.json();
      })
      .then(({ companyId, companyName }: { companyId: string; companyName: string }) => {
        // Store impersonation session
        sessionStorage.setItem(IMP_SESSION_KEY, JSON.stringify({
          token,
          companyId,
          companyName,
          startedAt: new Date().toISOString(),
        }));
        setCompanyName(companyName);
        setStatus("ok");

        // Auto-redirect after 2s
        setTimeout(() => navigate("/dashboard"), 2000);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to validate the token.");
        setStatus("error");
      });
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-slate-100">
        <CardHeader>
          <CardTitle className="text-xl text-center text-white">HireForward — Impersonation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto" />
              <p className="text-slate-300">Validating access session…</p>
            </>
          )}

          {status === "ok" && (
            <>
              <div className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-orange-400 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-orange-400" />
              </div>
              <p className="text-white font-semibold text-lg">Access confirmed</p>
              <p className="text-slate-300 text-sm">
                You are viewing the account of <span className="text-orange-300 font-semibold">{companyName}</span>.
              </p>
              <p className="text-slate-400 text-xs">Redirecting to dashboard…</p>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => navigate("/dashboard")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Go to Dashboard now
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
              <p className="text-white font-semibold">Invalid token</p>
              <p className="text-slate-300 text-sm">{error}</p>
              <p className="text-slate-400 text-xs">The link may have expired (valid for 4 hours). Request a new link from the admin panel.</p>
              <Button variant="outline" className="w-full border-slate-600 text-slate-300" onClick={() => navigate("/admin")}>
                Back to Admin
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
