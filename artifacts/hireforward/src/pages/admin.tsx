import { useState, useEffect } from "react";
import { useAdminLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import {
  Coins, DollarSign, Activity, Building, Loader2, Mail, Eye, EyeOff,
  CheckCircle, XCircle, Send, LayoutDashboard, Settings2, Bot, Zap, Globe,
  ChevronRight, Search, BarChart2, ScrollText, Sliders, ExternalLink,
  AlertTriangle, Users, Wrench,
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
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

type Tab = "overview" | "ai" | "email" | "platform" | "logs";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-700",
  inactive: "bg-slate-100 text-slate-600",
  past_due: "bg-orange-100 text-orange-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-500",
};

const AI_PROVIDERS = [
  { id: "anthropic", name: "Anthropic Claude", description: "State of the art in reasoning and instruction following", defaultModel: "claude-sonnet-4-6", defaultBaseUrl: null, models: ["claude-opus-4-5", "claude-sonnet-4-6", "claude-haiku-4-5"] },
  { id: "openrouter", name: "OpenRouter", description: "Unified access to dozens of models", defaultModel: "anthropic/claude-3.5-sonnet", defaultBaseUrl: "https://openrouter.ai/api/v1", models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "meta-llama/llama-3.1-70b-instruct"] },
  { id: "azure_openai", name: "Azure OpenAI", description: "OpenAI hosted on Azure infrastructure", defaultModel: "gpt-4o", defaultBaseUrl: null, models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "groq", name: "Groq", description: "Ultra-fast inference with dedicated LPU", defaultModel: "llama-3.3-70b-versatile", defaultBaseUrl: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { id: "deepseek", name: "DeepSeek", description: "High-performance models at very low cost", defaultModel: "deepseek-chat", defaultBaseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "nvidia_nim", name: "NVIDIA NIM", description: "Open-source models optimized on NVIDIA GPUs", defaultModel: "meta/llama-3.1-70b-instruct", defaultBaseUrl: "https://integrate.api.nvidia.com/v1", models: ["meta/llama-3.1-70b-instruct", "mistralai/mistral-7b-instruct-v0.3"] },
  { id: "google_vertex", name: "Google Vertex AI", description: "Gemini and Google Cloud models", defaultModel: "google/gemini-2.0-flash-001", defaultBaseUrl: "https://openrouter.ai/api/v1", models: ["google/gemini-2.0-flash-001", "google/gemini-2.5-pro-preview"] },
];

const PLATFORM_CONFIG_DEFAULTS: Record<string, string> = {
  platform_name: "HireForward",
  platform_maintenance_mode: "false",
  platform_maintenance_message: "We are performing scheduled maintenance. We'll be back shortly.",
  invite_expiry_days: "7",
  ai_price_input_per_1m: "3.00",
  ai_price_output_per_1m: "15.00",
  ai_max_tokens_per_session: "50000",
  ai_timeout_seconds: "30",
};

export default function Admin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(localStorage.getItem(ADMIN_TOKEN_KEY));
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Overview data
  const [usage, setUsage] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("all");

  // Email config
  const [emailConfig, setEmailConfig] = useState<Record<string, string>>({
    email_enabled: "false", email_provider: "resend", email_api_key: "",
    email_sender_name: "", email_sender_address: "", email_reply_to: "",
  });
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaveStatus, setEmailSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // AI config
  const [aiProviders, setAiProviders] = useState<any[]>(AI_PROVIDERS);
  const [aiConfig, setAiConfig] = useState<Record<string, string>>({
    ai_provider: "anthropic", ai_api_key: "", ai_model: "", ai_base_url: "", ai_api_version: "",
  });
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [aiSaveStatus, setAiSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [showAIKey, setShowAIKey] = useState(false);

  // Platform config
  const [platformConfig, setPlatformConfig] = useState<Record<string, string>>(PLATFORM_CONFIG_DEFAULTS);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(false);
  const [isSavingPlatform, setIsSavingPlatform] = useState(false);
  const [platformSaveStatus, setPlatformSaveStatus] = useState<"idle" | "ok" | "error">("idle");

  // Activity logs
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const login = useAdminLogin();

  useEffect(() => {
    if (!token) return;
    setIsLoadingData(true);
    Promise.all([
      adminFetch<any>("/api/admin/token-usage", token),
      adminFetch<any[]>("/api/admin/token-usage/monthly", token),
      adminFetch<any[]>("/api/admin/companies", token),
    ])
      .then(([u, m, c]) => { setUsage(u); setMonthly(m); setCompanies(c); })
      .catch(() => { localStorage.removeItem(ADMIN_TOKEN_KEY); setToken(null); })
      .finally(() => setIsLoadingData(false));
  }, [token]);

  useEffect(() => {
    if (!token || activeTab !== "ai") return;
    setIsLoadingAI(true);
    adminFetch<any>("/api/admin/ai-config", token)
      .then((data) => {
        if (data.providers) setAiProviders(data.providers);
        setAiConfig({
          ai_provider: data.ai_provider ?? "anthropic",
          ai_api_key: data.ai_api_key ?? "",
          ai_model: data.ai_model ?? "",
          ai_base_url: data.ai_base_url ?? "",
          ai_api_version: data.ai_api_version ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setIsLoadingAI(false));
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || activeTab !== "email") return;
    setIsLoadingEmail(true);
    adminFetch<Record<string, string>>("/api/admin/email-config", token)
      .then((cfg) => setEmailConfig({
        email_enabled: cfg.email_enabled ?? "false",
        email_provider: cfg.email_provider ?? "resend",
        email_api_key: cfg.email_api_key ?? "",
        email_sender_name: cfg.email_sender_name ?? "",
        email_sender_address: cfg.email_sender_address ?? "",
        email_reply_to: cfg.email_reply_to ?? "",
      }))
      .catch(() => {})
      .finally(() => setIsLoadingEmail(false));
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || activeTab !== "platform") return;
    setIsLoadingPlatform(true);
    adminFetch<Record<string, string>>("/api/admin/platform-config", token)
      .then((cfg) => setPlatformConfig({ ...PLATFORM_CONFIG_DEFAULTS, ...cfg }))
      .catch(() => {})
      .finally(() => setIsLoadingPlatform(false));
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || activeTab !== "logs") return;
    setIsLoadingLogs(true);
    adminFetch<any[]>("/api/admin/activity-logs", token)
      .then(setActivityLogs)
      .catch(() => {})
      .finally(() => setIsLoadingLogs(false));
  }, [token, activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { email, password } }, {
      onSuccess: (data) => { localStorage.setItem(ADMIN_TOKEN_KEY, data.token); setToken(data.token); },
    });
  };

  const handleLogout = () => { localStorage.removeItem(ADMIN_TOKEN_KEY); setToken(null); };

  const handleSaveAIConfig = async () => {
    if (!token) return;
    setIsSavingAI(true); setAiSaveStatus("idle");
    try {
      await adminFetch("/api/admin/ai-config", token, { method: "PUT", body: JSON.stringify(aiConfig) });
      setAiSaveStatus("ok"); setTimeout(() => setAiSaveStatus("idle"), 3000);
    } catch { setAiSaveStatus("error"); } finally { setIsSavingAI(false); }
  };

  const handleSaveEmailConfig = async () => {
    if (!token) return;
    setIsSavingEmail(true); setEmailSaveStatus("idle");
    try {
      await adminFetch("/api/admin/email-config", token, { method: "PUT", body: JSON.stringify(emailConfig) });
      setEmailSaveStatus("ok"); setTimeout(() => setEmailSaveStatus("idle"), 3000);
    } catch { setEmailSaveStatus("error"); } finally { setIsSavingEmail(false); }
  };

  const handleSavePlatformConfig = async () => {
    if (!token) return;
    setIsSavingPlatform(true); setPlatformSaveStatus("idle");
    try {
      await adminFetch("/api/admin/platform-config", token, { method: "PUT", body: JSON.stringify(platformConfig) });
      setPlatformSaveStatus("ok"); setTimeout(() => setPlatformSaveStatus("idle"), 3000);
    } catch { setPlatformSaveStatus("error"); } finally { setIsSavingPlatform(false); }
  };

  const handleTestEmail = async () => {
    if (!token || !testEmailTo) return;
    setIsSendingTest(true); setTestResult(null);
    try {
      await adminFetch("/api/admin/email-config/test", token, { method: "POST", body: JSON.stringify({ to: testEmailTo }) });
      setTestResult({ ok: true, message: `Test email sent to ${testEmailTo}` });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message ?? "Failed to send test email." });
    } finally { setIsSendingTest(false); }
  };

  // Filtered companies
  const filteredCompanies = companies.filter(c => {
    const matchSearch = !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()) || (c.hrContactEmail ?? "").toLowerCase().includes(companySearch.toLowerCase());
    const matchStatus = companyStatusFilter === "all" || c.status === companyStatusFilter;
    return matchSearch && matchStatus;
  });

  // Company summary stats
  const activeCount = companies.filter(c => c.status === "active").length;
  const trialCount = companies.filter(c => c.status === "trial").length;
  const suspendedCount = companies.filter(c => c.status === "suspended" || c.status === "past_due").length;

  if (!token) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-white">HireForward Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-slate-900 border-slate-700 text-white" />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={login.isPending}>
                {login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div className="font-bold text-lg tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          HireForward Owner Console
        </div>
        <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
          Logout
        </Button>
      </header>

      <div className="border-b bg-white sticky top-[65px] z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "ai", label: "AI Provider", icon: Bot },
            { id: "email", label: "Email", icon: Mail },
            { id: "platform", label: "Platform", icon: Sliders },
            { id: "logs", label: "Logs", icon: ScrollText },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-6 max-w-7xl mx-auto">

        {/* ── Overview Tab ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-24 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Tokens (mo.)", value: usage?.tokensUsedMonth.toLocaleString() ?? "0", icon: Coins, color: "bg-blue-50 text-blue-600" },
                    { label: "Cost (mo.)", value: `$${(usage?.costMonthUsd ?? 0).toFixed(2)}`, icon: DollarSign, color: "bg-green-50 text-green-600" },
                    { label: "Tokens (YTD)", value: usage?.tokensUsedYear.toLocaleString() ?? "0", icon: Activity, color: "bg-purple-50 text-purple-600" },
                    { label: "Total Companies", value: String(companies.length), icon: Building, color: "bg-orange-50 text-orange-600" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="bg-white shadow-sm border-slate-200">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
                            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                          </div>
                          <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Company status summary */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Active", count: activeCount, color: "text-green-600 bg-green-50 border-green-200" },
                    { label: "Trial", count: trialCount, color: "text-blue-600 bg-blue-50 border-blue-200" },
                    { label: "Delinquent / Suspended", count: suspendedCount, color: "text-red-600 bg-red-50 border-red-200" },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={`p-4 rounded-xl border flex items-center gap-3 ${color}`}>
                      <span className="text-2xl font-bold">{count}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b pb-4"><CardTitle className="text-lg">Tokens per Month</CardTitle></CardHeader>
                    <CardContent className="pt-6 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthly}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#64748b" }} />
                          <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#64748b" }} />
                          <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                          <Bar dataKey="tokensOutput" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} name="Output" />
                          <Bar dataKey="tokensInput" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Input" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b pb-4"><CardTitle className="text-lg">Top Companies by Cost</CardTitle></CardHeader>
                    <CardContent className="pt-6 h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usage?.topCompanies ?? []} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#64748b" }} />
                          <YAxis dataKey="companyName" type="category" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: "#1e293b", fontWeight: 500 }} width={120} />
                          <RechartsTooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} formatter={(val) => `$${Number(val).toFixed(2)}`} />
                          <Bar dataKey="costUsd" fill="#10b981" radius={[0, 4, 4, 0]} name="Cost ($)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Companies table */}
                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="text-lg">Companies</CardTitle>
                      <div className="flex gap-2 flex-wrap">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Search by name or email…"
                            value={companySearch}
                            onChange={e => setCompanySearch(e.target.value)}
                            className="pl-8 h-8 text-sm w-48"
                          />
                        </div>
                        <div className="flex gap-1">
                          {[
                            { val: "all", label: "All" },
                            { val: "active", label: "Active" },
                            { val: "trial", label: "Trial" },
                            { val: "suspended", label: "Suspended" },
                            { val: "past_due", label: "Past Due" },
                          ].map(({ val, label }) => (
                            <button
                              key={val}
                              onClick={() => setCompanyStatusFilter(val)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${companyStatusFilter === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead>Company</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Processes</TableHead>
                          <TableHead className="text-right">Candidates</TableHead>
                          <TableHead className="text-right">Tokens (mo.)</TableHead>
                          <TableHead className="text-right">Cost (mo.)</TableHead>
                          <TableHead className="text-right">Registered</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompanies.map(c => (
                          <TableRow key={c.id} className="hover:bg-slate-50">
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{c.name}</p>
                                {c.hrContactEmail && <p className="text-xs text-slate-400">{c.hrContactEmail}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 font-medium uppercase tracking-wider">{c.plan}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {c.status.replace("_", " ")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-slate-600">{c.processesCreated}</TableCell>
                            <TableCell className="text-right text-slate-600">{c.candidatesEvaluated}</TableCell>
                            <TableCell className="text-right text-slate-600 font-mono text-sm">{c.tokensUsedMonth.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-slate-900 font-medium">${c.costMonth.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-slate-500 text-sm">{format(new Date(c.createdAt), "MM/dd/yy")}</TableCell>
                            <TableCell>
                              <button
                                onClick={() => navigate(`/admin/companies/${c.id}`)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                              >
                                View <ChevronRight className="h-3 w-3" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredCompanies.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                              No companies found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── AI Provider Tab ───────────────────────────────────────────────── */}
        {activeTab === "ai" && (
          <div className="max-w-3xl space-y-6 py-6">
            {isLoadingAI ? (
              <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading configuration…
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-600" /> AI Provider
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Choose the AI provider and model used for all interviews and evaluations on the platform.</p>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4"><CardTitle className="text-base">Select Provider</CardTitle></CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiProviders.map((p: any) => {
                        const isActive = aiConfig.ai_provider === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setAiConfig(c => ({ ...c, ai_provider: p.id, ai_model: c.ai_model || p.defaultModel, ai_base_url: c.ai_base_url || p.defaultBaseUrl || "" }))}
                            className={`text-left p-4 rounded-xl border-2 transition-all ${isActive ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-semibold text-sm text-slate-900">{p.name}</span>
                              {isActive && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
                            <div className="mt-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${isActive ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                                {p.defaultModel}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {aiConfig.ai_provider && (
                  <Card className="shadow-sm">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Provider Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">API Key</Label>
                        <div className="relative">
                          <Input
                            type={showAIKey ? "text" : "password"}
                            placeholder={aiConfig.ai_provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                            value={aiConfig.ai_api_key}
                            onChange={e => setAiConfig(c => ({ ...c, ai_api_key: e.target.value }))}
                            className="pr-10 font-mono text-sm"
                          />
                          <button type="button" onClick={() => setShowAIKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {aiConfig.ai_provider === "anthropic" && (
                          <p className="text-xs text-slate-400">Leave blank to use the Replit integration (recommended).</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Model</Label>
                        <Input
                          placeholder={aiProviders.find((p: any) => p.id === aiConfig.ai_provider)?.defaultModel ?? ""}
                          value={aiConfig.ai_model}
                          onChange={e => setAiConfig(c => ({ ...c, ai_model: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {(aiProviders.find((p: any) => p.id === aiConfig.ai_provider)?.models ?? []).map((m: string) => (
                            <button key={m} type="button" onClick={() => setAiConfig(c => ({ ...c, ai_model: m }))}
                              className={`text-[11px] px-2 py-0.5 rounded border font-mono transition-colors ${aiConfig.ai_model === m ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {aiConfig.ai_provider !== "anthropic" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Base URL</Label>
                          <Input
                            placeholder={aiProviders.find((p: any) => p.id === aiConfig.ai_provider)?.defaultBaseUrl ?? ""}
                            value={aiConfig.ai_base_url}
                            onChange={e => setAiConfig(c => ({ ...c, ai_base_url: e.target.value }))}
                            className="font-mono text-sm"
                          />
                        </div>
                      )}

                      {aiConfig.ai_provider === "azure_openai" && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">API Version</Label>
                          <Input placeholder="2024-08-01-preview" value={aiConfig.ai_api_version} onChange={e => setAiConfig(c => ({ ...c, ai_api_version: e.target.value }))} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveAIConfig} disabled={isSavingAI} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSavingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Configuration
                  </Button>
                  {aiSaveStatus === "ok" && <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><CheckCircle className="h-4 w-4" /> Saved</span>}
                  {aiSaveStatus === "error" && <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium"><XCircle className="h-4 w-4" /> Failed to save</span>}
                </div>

                <Card className="bg-amber-50 border-amber-200 shadow-none">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800">
                      <span className="font-semibold">Warning:</span> changing the provider affects all ongoing interviews immediately.
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── Email Config Tab ──────────────────────────────────────────────── */}
        {activeTab === "email" && (
          <div className="max-w-2xl space-y-6 py-6">
            {isLoadingEmail ? (
              <div className="flex items-center gap-3 text-slate-500 py-12 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading configuration…</div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600" /> Email Configuration</h2>
                  <p className="text-sm text-slate-500 mt-1">Configure the transactional email provider for interview invites and notifications.</p>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Provider Settings</CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{emailConfig.email_enabled === "true" ? "Enabled" : "Disabled"}</span>
                        <Switch checked={emailConfig.email_enabled === "true"} onCheckedChange={(v) => setEmailConfig(c => ({ ...c, email_enabled: v ? "true" : "false" }))} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Provider</Label>
                      <div className="flex items-center gap-2 p-3 border rounded-lg bg-slate-50">
                        <div className="w-6 h-6 bg-black rounded flex items-center justify-center"><span className="text-white text-[10px] font-bold">R</span></div>
                        <span className="text-sm font-medium">Resend</span>
                        <span className="ml-auto text-xs text-slate-400">resend.com</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">API Key</Label>
                      <div className="relative">
                        <Input type={showApiKey ? "text" : "password"} placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx" value={emailConfig.email_api_key} onChange={e => setEmailConfig(c => ({ ...c, email_api_key: e.target.value }))} className="pr-10 font-mono text-sm" />
                        <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4"><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" /> Sender Identity</CardTitle></CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {[
                      { id: "email_sender_name", label: "Sender Name", placeholder: "HireForward" },
                      { id: "email_sender_address", label: "Sender Email Address", placeholder: "noreply@yourdomain.com" },
                      { id: "email_reply_to", label: "Reply-To Address (optional)", placeholder: "hr@yourcompany.com" },
                    ].map(({ id, label, placeholder }) => (
                      <div key={id} className="space-y-2">
                        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
                        <Input id={id} placeholder={placeholder} value={emailConfig[id] ?? ""} onChange={e => setEmailConfig(c => ({ ...c, [id]: e.target.value }))} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSaveEmailConfig} disabled={isSavingEmail} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSavingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Configuration
                  </Button>
                  {emailSaveStatus === "ok" && <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><CheckCircle className="h-4 w-4" /> Saved</span>}
                  {emailSaveStatus === "error" && <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium"><XCircle className="h-4 w-4" /> Failed to save</span>}
                </div>

                <Card className="shadow-sm border-dashed">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4 text-slate-500" /> Send Test Email</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input type="email" placeholder="test@example.com" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} className="flex-1" />
                      <Button onClick={handleTestEmail} disabled={isSendingTest || !testEmailTo} variant="outline">
                        {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    {testResult && (
                      <div className={`flex items-center gap-2 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
                        {testResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {testResult.message}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── Platform Config Tab ───────────────────────────────────────────── */}
        {activeTab === "platform" && (
          <div className="max-w-2xl space-y-6 py-6">
            {isLoadingPlatform ? (
              <div className="flex items-center gap-3 text-slate-500 py-12 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><Sliders className="h-5 w-5 text-blue-600" /> Platform Settings</h2>
                  <p className="text-sm text-slate-500 mt-1">Adjust global platform behaviour for all customers.</p>
                </div>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4"><CardTitle className="text-base flex items-center gap-2"><Building className="h-4 w-4" /> Identity</CardTitle></CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Platform Name</Label>
                      <Input value={platformConfig.platform_name} onChange={e => setPlatformConfig(c => ({ ...c, platform_name: e.target.value }))} placeholder="HireForward" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Maintenance Mode</CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{platformConfig.platform_maintenance_mode === "true" ? "Active" : "Inactive"}</span>
                        <Switch
                          checked={platformConfig.platform_maintenance_mode === "true"}
                          onCheckedChange={v => setPlatformConfig(c => ({ ...c, platform_maintenance_mode: v ? "true" : "false" }))}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-3">
                    {platformConfig.platform_maintenance_mode === "true" && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2 text-sm text-orange-800">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                        Maintenance mode active — customers cannot access the platform.
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Maintenance Message</Label>
                      <Input
                        value={platformConfig.platform_maintenance_message}
                        onChange={e => setPlatformConfig(c => ({ ...c, platform_maintenance_message: e.target.value }))}
                        placeholder="We are performing scheduled maintenance…"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Candidates</CardTitle></CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Default invite deadline (days)</Label>
                      <Input
                        type="number" min={1} max={90}
                        value={platformConfig.invite_expiry_days}
                        onChange={e => setPlatformConfig(c => ({ ...c, invite_expiry_days: e.target.value }))}
                      />
                      <p className="text-xs text-slate-400">Number of days before the interview link expires after sending.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="border-b pb-4"><CardTitle className="text-base flex items-center gap-2"><Coins className="h-4 w-4" /> AI Pricing (for cost calculation)</CardTitle></CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Input (USD / 1M tokens)</Label>
                        <Input
                          type="number" min={0} step={0.01}
                          value={platformConfig.ai_price_input_per_1m}
                          onChange={e => setPlatformConfig(c => ({ ...c, ai_price_input_per_1m: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Output (USD / 1M tokens)</Label>
                        <Input
                          type="number" min={0} step={0.01}
                          value={platformConfig.ai_price_output_per_1m}
                          onChange={e => setPlatformConfig(c => ({ ...c, ai_price_output_per_1m: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Max tokens / session</Label>
                        <Input
                          type="number" min={1000}
                          value={platformConfig.ai_max_tokens_per_session}
                          onChange={e => setPlatformConfig(c => ({ ...c, ai_max_tokens_per_session: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Timeout (seconds)</Label>
                        <Input
                          type="number" min={5} max={300}
                          value={platformConfig.ai_timeout_seconds}
                          onChange={e => setPlatformConfig(c => ({ ...c, ai_timeout_seconds: e.target.value }))}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Estimated current cost per 1k tokens: ${((Number(platformConfig.ai_price_input_per_1m) + Number(platformConfig.ai_price_output_per_1m)) / 2000).toFixed(4)} (input+output average)
                    </p>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSavePlatformConfig} disabled={isSavingPlatform} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSavingPlatform ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Settings
                  </Button>
                  {platformSaveStatus === "ok" && <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><CheckCircle className="h-4 w-4" /> Saved</span>}
                  {platformSaveStatus === "error" && <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium"><XCircle className="h-4 w-4" /> Failed to save</span>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Logs Tab ──────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="space-y-6 py-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><ScrollText className="h-5 w-5 text-blue-600" /> Audit Log</h2>
              <p className="text-sm text-slate-500 mt-1">Actions performed in the admin panel — configuration changes, impersonation, and company updates.</p>
            </div>

            {isLoadingLogs ? (
              <div className="flex items-center gap-3 text-slate-500 py-12 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading logs…</div>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  {activityLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No actions recorded yet</p>
                      <p className="text-sm mt-1">Admin actions will appear here as they are performed.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Action</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead>IP</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{log.action}</span>
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}` : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                              {log.details ? JSON.stringify(log.details) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-400">{log.ip ?? "—"}</TableCell>
                            <TableCell className="text-sm text-slate-500">{format(new Date(log.createdAt), "dd/MM/yy HH:mm")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
