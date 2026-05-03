import { useState, useEffect } from "react";
import { useGetCompanySettings, useUpdateCompanySettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, Users, Clock, Languages, Phone, Mail, User, Save, Loader2 } from "lucide-react";

const INDUSTRIES = [
  "Technology", "Finance & Banking", "Healthcare", "Education", "Retail & E-commerce",
  "Manufacturing", "Consulting", "Media & Entertainment", "Real Estate", "Other",
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "500+", label: "500+ employees" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "pt", label: "Portuguese (PT-BR)" },
  { value: "es", label: "Spanish" },
];

const TIMEZONES = [
  "UTC", "America/Sao_Paulo", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin",
  "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
];

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    website: "",
    industry: "",
    companySize: "",
    timezone: "",
    interviewLanguage: "en",
    hrContactName: "",
    hrContactEmail: "",
    hrContactPhone: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name ?? "",
        logoUrl: settings.logoUrl ?? "",
        website: settings.website ?? "",
        industry: settings.industry ?? "",
        companySize: settings.companySize ?? "",
        timezone: settings.timezone ?? "",
        interviewLanguage: settings.interviewLanguage ?? "en",
        hrContactName: settings.hrContactName ?? "",
        hrContactEmail: settings.hrContactEmail ?? "",
        hrContactPhone: settings.hrContactPhone ?? "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        data: {
          name: form.name || undefined,
          logoUrl: form.logoUrl || null,
          website: form.website || null,
          industry: form.industry || null,
          companySize: form.companySize || null,
          timezone: form.timezone || null,
          interviewLanguage: form.interviewLanguage || null,
          hrContactName: form.hrContactName || null,
          hrContactEmail: form.hrContactEmail || null,
          hrContactPhone: form.hrContactPhone || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Settings saved", description: "Your company settings have been updated." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save settings. Try again.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Company Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your company profile and interview defaults.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="capitalize">
            {settings?.plan ?? "trial"} plan
          </Badge>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" /> Company Profile
          </CardTitle>
          <CardDescription>Basic information about your company. This appears in candidate-facing pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Website
              </Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Industry
              </Label>
              <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Company Size
            </Label>
            <Select value={form.companySize} onValueChange={(v) => setForm({ ...form, companySize: v })}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.logoUrl && (
            <div className="p-3 border rounded-lg bg-slate-50 flex items-center gap-3">
              <img src={form.logoUrl} alt="Logo preview" className="h-10 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
              <span className="text-sm text-muted-foreground">Logo preview</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interview Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Languages className="h-5 w-5 text-primary" /> Interview Defaults
          </CardTitle>
          <CardDescription>Default language and timezone for AI-conducted interviews.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> Interview Language
              </Label>
              <Select value={form.interviewLanguage} onValueChange={(v) => setForm({ ...form, interviewLanguage: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Default Timezone
              </Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" /> HR Contact
          </CardTitle>
          <CardDescription>Contact information for your HR team, shown to candidates in email communications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hrContactName" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> HR Contact Name
            </Label>
            <Input
              id="hrContactName"
              value={form.hrContactName}
              onChange={(e) => setForm({ ...form, hrContactName: e.target.value })}
              placeholder="Jane Smith"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hrContactEmail" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> HR Contact Email
              </Label>
              <Input
                id="hrContactEmail"
                type="email"
                value={form.hrContactEmail}
                onChange={(e) => setForm({ ...form, hrContactEmail: e.target.value })}
                placeholder="hr@yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hrContactPhone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> HR Contact Phone
              </Label>
              <Input
                id="hrContactPhone"
                value={form.hrContactPhone}
                onChange={(e) => setForm({ ...form, hrContactPhone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button size="lg" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
