import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft, Building2, Activity, Briefcase, ScrollText, Loader2,
  Coins, DollarSign, Users, TrendingUp, Copy, CheckCircle, XCircle,
  ExternalLink, UserCheck, FileText,
} from "lucide-react";
import { format } from "date-fns";

const ADMIN_TOKEN_KEY = "hf_admin_token";

async function adminFetch<T>(path: string, token: string, opts?: RequestInit): Promise<T> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

type CompanyTab = "profile" | "usage" | "processes" | "logs";

const STATUS_LABELS: Record<string, string> = {
  active: "Active", inactive: "Inactive", trial: "Trial",
  past_due: "Past Due", suspended: "Suspended", cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-700",
  inactive: "bg-slate-100 text-slate-600",
  past_due: "bg-orange-100 text-orange-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const PROCESS_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  closed: "bg-slate-200 text-slate-500",
};

export default function AdminCompany() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);

  const [activeTab, setActiveTab] = useState<CompanyTab>("profile");
  const [company, setCompany] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editStatus, setEditStatus] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");

  // Impersonation
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Invoice
  const [invoiceMonth, setInvoiceMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });

  const loadCompany = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminFetch<any>(`/api/admin/companies/${id}`, token);
      setCompany(data);
      setEditStatus(data.status);
      setEditPlan(data.plan);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  useEffect(() => {
    if (!token || !id) return;
    if (activeTab === "usage" && !usage) {
      adminFetch<any>(`/api/admin/companies/${id}/usage`, token).then(setUsage).catch(() => {});
    }
    if (activeTab === "processes" && processes.length === 0) {
      adminFetch<any[]>(`/api/admin/companies/${id}/processes`, token).then(setProcesses).catch(() => {});
    }
    if (activeTab === "logs" && logs.length === 0) {
      adminFetch<any>(`/api/admin/companies/${id}/usage`, token)
        .then(d => setLogs(d.recentLogs ?? []))
        .catch(() => {});
    }
  }, [activeTab, token, id]);

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <p className="mb-4">You must be logged in to the admin console.</p>
          <Button onClick={() => navigate("/admin")} variant="outline">Go to Admin Login</Button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!token || !id) return;
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      await adminFetch(`/api/admin/companies/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ status: editStatus, plan: editPlan }),
      });
      setSaveStatus("ok");
      setCompany((c: any) => ({ ...c, status: editStatus, plan: editPlan }));
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImpersonate = async () => {
    if (!token || !id) return;
    setImpersonating(true);
    try {
      const { token: impToken, companyName } = await adminFetch<{ token: string; companyName: string }>(
        `/api/admin/companies/${id}/impersonate`,
        token,
        { method: "POST" }
      );
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const link = `${window.location.origin}${base}/impersonate?token=${impToken}`;
      setImpersonateLink(link);
    } catch {
      alert("Failed to generate impersonation link.");
    } finally {
      setImpersonating(false);
    }
  };

  const copyLink = () => {
    if (!impersonateLink) return;
    navigator.clipboard.writeText(impersonateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: CompanyTab; label: string; icon: any }[] = [
    { id: "profile", label: "Profile", icon: Building2 },
    { id: "usage", label: "Usage", icon: Activity },
    { id: "processes", label: "Processes", icon: Briefcase },
    { id: "logs", label: "API Logs", icon: ScrollText },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </button>
          <span className="text-slate-600">/</span>
          <span className="font-semibold">{company?.name ?? "Loading..."}</span>
        </div>
        {company && (
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[company.status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABELS[company.status] ?? company.status}
            </span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded uppercase font-mono">{company.plan}</span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="border-b bg-white sticky top-[65px] z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabId
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-500">{error}</div>
        ) : (
          <>
            {/* ── Profile Tab ──────────────────────────────────────────────── */}
            {activeTab === "profile" && company && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Company Info */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base">Company Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 grid grid-cols-2 gap-4 text-sm">
                      {[
                        ["ID", company.id],
                        ["Name", company.name],
                        ["Website", company.website ?? "—"],
                        ["Industry", company.industry ?? "—"],
                        ["Size", company.companySize ?? "—"],
                        ["Timezone", company.timezone ?? "—"],
                        ["Interview Language", company.interviewLanguage ?? "—"],
                        ["Registered", format(new Date(company.createdAt), "MM/dd/yyyy HH:mm")],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                          <p className="font-medium text-slate-800 break-all">{value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> HR Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 grid grid-cols-3 gap-4 text-sm">
                      {[
                        ["Name", company.hrContactName ?? "—"],
                        ["Email", company.hrContactEmail ?? "—"],
                        ["Phone", company.hrContactPhone ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                          <p className="font-medium text-slate-800">{value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Users ({company.users?.length ?? 0})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Registered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(company.users ?? []).map((u: any) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-mono text-sm">{u.email}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">{format(new Date(u.createdAt), "MM/dd/yyyy")}</TableCell>
                            </TableRow>
                          ))}
                          {company.users?.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center text-slate-400 py-6">No users registered</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Actions */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base">Manage</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Account Status</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Plan</Label>
                        <Select value={editPlan} onValueChange={setEditPlan}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["trial", "starter", "growth", "enterprise"].map(p => (
                              <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button onClick={handleSave} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                      </Button>

                      {saveStatus === "ok" && (
                        <p className="text-green-600 text-sm flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Saved</p>
                      )}
                      {saveStatus === "error" && (
                        <p className="text-red-600 text-sm flex items-center gap-1"><XCircle className="h-4 w-4" /> Failed to save</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4" /> Impersonate</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-3">
                      <p className="text-xs text-slate-500">Generates a temporary access link (4h) to view this company's account in the main app.</p>
                      <Button
                        onClick={handleImpersonate}
                        disabled={impersonating}
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        {impersonating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                        Generate Access Link
                      </Button>

                      {impersonateLink && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input value={impersonateLink} readOnly className="text-xs font-mono flex-1" />
                            <Button size="sm" variant="outline" onClick={copyLink}>
                              {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => window.open(impersonateLink, "_blank")}
                          >
                            Open in New Tab
                          </Button>
                          <p className="text-[10px] text-orange-600">Expires in 4 hours. Share with caution.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── Usage Tab ─────────────────────────────────────────────────── */}
            {activeTab === "usage" && (
              <div className="space-y-6">
                {/* Invoice download card */}
                <Card className="shadow-sm border-dashed border-slate-300 bg-slate-50">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                          <FileText className="h-5 w-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">Monthly Invoice</p>
                          <p className="text-xs text-slate-500 mt-0.5">Generate a printable PDF invoice for any billing period</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="month"
                          value={invoiceMonth}
                          max={new Date().toISOString().slice(0, 7)}
                          onChange={e => setInvoiceMonth(e.target.value)}
                          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() => {
                            const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                            window.open(`${base}/api/admin/companies/${id}/invoice?month=${invoiceMonth}&token=${token}`, "_blank");
                          }}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" /> Download Invoice
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {!usage ? (
                  <div className="flex items-center justify-center py-24 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Tokens (mo.)", value: usage.tokensMonth.toLocaleString(), icon: Coins, color: "bg-blue-50 text-blue-600" },
                        { label: "Cost (mo.)", value: `$${usage.costMonth.toFixed(2)}`, icon: DollarSign, color: "bg-green-50 text-green-600" },
                        { label: "Processes", value: usage.processesTotal, icon: Briefcase, color: "bg-purple-50 text-purple-600" },
                        { label: "Candidates evaluated", value: `${usage.candidatesEvaluated}/${usage.candidatesTotal}`, icon: UserCheck, color: "bg-orange-50 text-orange-600" },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <Card key={label}>
                          <CardContent className="p-5">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">{label}</p>
                                <p className="text-xl font-bold text-slate-900">{value}</p>
                              </div>
                              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="border-b pb-4">
                          <CardTitle className="text-base">Tokens per Month (12m)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usage.monthly}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#64748b" }} />
                              <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#64748b" }} />
                              <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                              <Bar dataKey="tokensOutput" stackId="a" fill="#3b82f6" name="Output" radius={[0, 0, 3, 3]} />
                              <Bar dataKey="tokensInput" stackId="a" fill="#93c5fd" name="Input" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="border-b pb-4">
                          <CardTitle className="text-base">Cost per Month ($)</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usage.monthly}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#64748b" }} />
                              <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#64748b" }} tickFormatter={(v) => `$${v}`} />
                              <RechartsTooltip formatter={(v) => `$${Number(v).toFixed(3)}`} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                              <Bar dataKey="costUsd" fill="#10b981" name="Cost ($)" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="border-b pb-4">
                        <CardTitle className="text-base">Annual Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {[
                          ["Tokens (year)", usage.tokensYear.toLocaleString()],
                          ["Cost (year)", `$${usage.costYear.toFixed(2)}`],
                          ["Total candidates", usage.candidatesTotal],
                          ["Completion rate", usage.candidatesTotal > 0 ? `${Math.round((usage.candidatesEvaluated / usage.candidatesTotal) * 100)}%` : "—"],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                            <p className="font-bold text-slate-900 text-lg">{value}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* ── Processes Tab ─────────────────────────────────────────────── */}
            {activeTab === "processes" && (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">Recruitment Processes ({processes.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {processes.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No processes created</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Position</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Candidates</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processes.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.title}</TableCell>
                            <TableCell className="text-slate-500">{p.area}</TableCell>
                            <TableCell><span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{p.interviewType}</span></TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROCESS_STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-slate-600">{p.candidatesEvaluated}/{p.candidatesTotal}</span>
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">{format(new Date(p.createdAt), "dd/MM/yyyy")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Logs Tab ──────────────────────────────────────────────────── */}
            {activeTab === "logs" && (
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">API Usage Logs (last 30)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>No usage records</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Process</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="text-right">Tokens In</TableHead>
                          <TableHead className="text-right">Tokens Out</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-sm text-slate-600">{l.processTitle ?? "—"}</TableCell>
                            <TableCell className="text-sm text-slate-600">{l.candidateName ?? "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{l.tokensInput.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{l.tokensOutput.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-medium text-sm">${l.costUsd.toFixed(4)}</TableCell>
                            <TableCell className="text-slate-500 text-sm">{format(new Date(l.createdAt), "dd/MM HH:mm")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
