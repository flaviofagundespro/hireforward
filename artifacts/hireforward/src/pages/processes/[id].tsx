import { Link, useParams } from "wouter";
import { useState } from "react";
import { useGetProcess, useUpdateProcess, useGenerateManagerLink, getGetProcessQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, PlayCircle, PauseCircle, Copy, Code, MessageSquare, Briefcase, Calendar, Share2, Loader2, Check, Pencil, Plus, Trash2, GripVertical, Timer } from "lucide-react";
import { format } from "date-fns";

const IMP_SESSION_KEY = "hf_imp";
function getImpersonationToken(): string | null {
  try {
    const raw = sessionStorage.getItem(IMP_SESSION_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token: string }).token;
  } catch { return null; }
}

interface CriterionDraft {
  id?: string;
  name: string;
  weight: number;
  descriptors: Record<string, string>;
}

export default function ProcessDetail() {
  const { id: processId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();

  const { data: process, isLoading } = useGetProcess(processId);
  const updateProcess = useUpdateProcess();
  const generateManagerLink = useGenerateManagerLink();

  const [managerLinkDialog, setManagerLinkDialog] = useState(false);
  const [managerLink, setManagerLink] = useState("");
  const [copiedManager, setCopiedManager] = useState(false);

  const [editCriteriaOpen, setEditCriteriaOpen] = useState(false);
  const [criteriaEdits, setCriteriaEdits] = useState<CriterionDraft[]>([]);
  const [savingCriteria, setSavingCriteria] = useState(false);

  const [editTimeLimitOpen, setEditTimeLimitOpen] = useState(false);
  const [timeLimitInput, setTimeLimitInput] = useState<string>("");
  const [savingTimeLimit, setSavingTimeLimit] = useState(false);

  const openEditTimeLimit = () => {
    const current = process?.responseTimeLimitSeconds;
    setTimeLimitInput(current ? String(current) : "");
    setEditTimeLimitOpen(true);
  };

  const handleSaveTimeLimit = async () => {
    setSavingTimeLimit(true);
    try {
      const seconds = timeLimitInput.trim() === "" ? null : parseInt(timeLimitInput);
      if (timeLimitInput.trim() !== "" && (isNaN(seconds!) || seconds! < 10)) {
        toast({ title: "Invalid value", description: "Time limit must be at least 10 seconds.", variant: "destructive" });
        return;
      }
      updateProcess.mutate(
        { id: processId, data: { responseTimeLimitSeconds: seconds } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(processId) });
            setEditTimeLimitOpen(false);
            toast({ title: "Time limit updated", description: seconds ? `Candidates will have ${seconds}s per response.` : "No time limit set." });
          },
          onError: () => {
            toast({ title: "Error", description: "Failed to save time limit.", variant: "destructive" });
          },
        }
      );
    } finally {
      setSavingTimeLimit(false);
    }
  };

  const handleToggleStatus = () => {
    if (!process) return;
    const newStatus = process.status === "active" ? "paused" : "active";
    updateProcess.mutate(
      { id: processId, data: { status: newStatus as "active" | "paused" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(processId) });
        },
      }
    );
  };

  const handleShareWithManager = () => {
    generateManagerLink.mutate(
      { id: processId },
      {
        onSuccess: (data) => {
          setManagerLink(data.link);
          setManagerLinkDialog(true);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to generate manager link.", variant: "destructive" });
        },
      }
    );
  };

  const copyManagerLink = () => {
    navigator.clipboard.writeText(managerLink);
    setCopiedManager(true);
    setTimeout(() => setCopiedManager(false), 2000);
  };

  const openEditCriteria = () => {
    const drafts: CriterionDraft[] = (process?.criteria ?? []).map(c => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
      descriptors: (c.descriptors ?? {}) as Record<string, string>,
    }));
    if (drafts.length === 0) {
      drafts.push({ name: "", weight: 25, descriptors: { "1": "", "3": "", "5": "" } });
    }
    setCriteriaEdits(drafts);
    setEditCriteriaOpen(true);
  };

  const addCriterion = () => {
    setCriteriaEdits(prev => [...prev, { name: "", weight: 25, descriptors: { "1": "", "3": "", "5": "" } }]);
  };

  const removeCriterion = (i: number) => {
    setCriteriaEdits(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateCriterion = (i: number, field: keyof CriterionDraft, value: string | number) => {
    setCriteriaEdits(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const updateDescriptor = (i: number, level: string, value: string) => {
    setCriteriaEdits(prev => {
      const next = [...prev];
      next[i] = { ...next[i], descriptors: { ...next[i].descriptors, [level]: value } };
      return next;
    });
  };

  const totalWeight = criteriaEdits.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const handleSaveCriteria = async () => {
    const invalid = criteriaEdits.some(c => !c.name.trim());
    if (invalid) {
      toast({ title: "Validation error", description: "Each criterion must have a name.", variant: "destructive" });
      return;
    }
    if (totalWeight !== 100) {
      toast({ title: "Weight error", description: `Weights must sum to 100 (currently ${totalWeight}).`, variant: "destructive" });
      return;
    }

    setSavingCriteria(true);
    try {
      const authToken = getImpersonationToken() ?? await getToken();
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/processes/${processId}/criteria`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({ criteria: criteriaEdits.map(c => ({ name: c.name, weight: c.weight, descriptors: c.descriptors })) }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Criteria updated", description: "Evaluation rubric saved successfully." });
      queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(processId) });
      setEditCriteriaOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save criteria.", variant: "destructive" });
    } finally {
      setSavingCriteria(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64 col-span-1" />
        </div>
      </div>
    );
  }

  if (!process) {
    return <div className="p-8 text-center text-muted-foreground">Process not found.</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/processes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{process.title}</h1>
            <Badge
              variant={process.status === "active" ? "default" : "secondary"}
              className={process.status === "active" ? "bg-green-500/10 text-green-700 border-green-200" : ""}
            >
              {process.status.toUpperCase()}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {process.area} • {process.seniority}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Created {format(new Date(process.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(process.status === "active" || process.status === "paused") && (
            <Button variant="outline" onClick={handleToggleStatus}>
              {process.status === "active" ? (
                <><PauseCircle className="mr-2 h-4 w-4" /> Pause</>
              ) : (
                <><PlayCircle className="mr-2 h-4 w-4" /> Resume</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleShareWithManager} disabled={generateManagerLink.isPending}>
            {generateManagerLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Share
          </Button>
          <Link href={`/processes/${processId}/candidates`}>
            <Button className="bg-primary">
              <Users className="mr-2 h-4 w-4" /> View Candidates
            </Button>
          </Link>
        </div>
      </div>

      {/* Manager Link Dialog */}
      <Dialog open={managerLinkDialog} onOpenChange={setManagerLinkDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" /> Manager View Link</DialogTitle>
            <DialogDescription>
              Share this read-only link with hiring managers. They can view all candidate scores and evaluation details — no login required.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <Input value={managerLink} readOnly className="font-mono text-xs bg-muted" />
            <Button variant="outline" size="icon" onClick={copyManagerLink} className="shrink-0">
              {copiedManager ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">This link is permanent and always shows the latest evaluation data.</p>
        </DialogContent>
      </Dialog>

      {/* Edit Time Limit Dialog */}
      <Dialog open={editTimeLimitOpen} onOpenChange={setEditTimeLimitOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-primary" /> Response Time Limit</DialogTitle>
            <DialogDescription>
              Set how many seconds candidates have to submit each response. Leave blank for no limit. Applies only when tools are allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="time-limit">Seconds per response</Label>
              <Input
                id="time-limit"
                type="number"
                min={10}
                max={600}
                placeholder="e.g. 90 (leave blank for no limit)"
                value={timeLimitInput}
                onChange={e => setTimeLimitInput(e.target.value)}
              />
              {timeLimitInput && !isNaN(parseInt(timeLimitInput)) && parseInt(timeLimitInput) >= 10 && (
                <p className="text-sm text-muted-foreground">
                  Candidates will have <span className="font-semibold text-foreground">{Math.floor(parseInt(timeLimitInput) / 60)}m {parseInt(timeLimitInput) % 60}s</span> per response. Timer auto-submits when it reaches zero.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTimeLimitOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTimeLimit} disabled={savingTimeLimit || updateProcess.isPending}>
              {(savingTimeLimit || updateProcess.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Criteria Dialog */}
      <Dialog open={editCriteriaOpen} onOpenChange={setEditCriteriaOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Evaluation Criteria</DialogTitle>
            <DialogDescription>
              Define the rubric the AI uses to score candidates. Weights must sum to 100.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 pr-4">
            <div className="space-y-4 py-2">
              {criteriaEdits.map((c, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="col-span-2 grid gap-1">
                        <Label className="text-xs">Criterion Name</Label>
                        <Input
                          value={c.name}
                          onChange={e => updateCriterion(i, "name", e.target.value)}
                          placeholder="e.g. Technical Knowledge"
                          className="h-8"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Weight (%)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={c.weight}
                          onChange={e => updateCriterion(i, "weight", parseInt(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 mt-4"
                      onClick={() => removeCriterion(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="ml-7 grid grid-cols-3 gap-2">
                    {(["1", "3", "5"] as const).map(level => (
                      <div key={level} className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">
                          Level {level} {level === "1" ? "(Poor)" : level === "3" ? "(Good)" : "(Excellent)"}
                        </Label>
                        <Textarea
                          value={c.descriptors?.[level] ?? ""}
                          onChange={e => updateDescriptor(i, level, e.target.value)}
                          placeholder={`Describe score ${level}...`}
                          className="text-xs min-h-[60px] resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={addCriterion}>
                <Plus className="mr-2 h-4 w-4" /> Add Criterion
              </Button>
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 border-t pt-4 flex items-center justify-between">
            <div className={`text-sm font-medium ${totalWeight === 100 ? "text-green-600" : "text-red-500"}`}>
              Total weight: {totalWeight}% {totalWeight !== 100 && "(must be 100%)"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditCriteriaOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCriteria} disabled={savingCriteria}>
                {savingCriteria ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save Criteria
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">Evaluation Criteria</CardTitle>
                <CardDescription>The rubric the AI uses to evaluate candidates.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={openEditCriteria}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Criteria
              </Button>
            </CardHeader>
            <CardContent>
              {process.criteria && process.criteria.length > 0 ? (
                <div className="space-y-4">
                  {process.criteria.map((c, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-slate-50/50">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-foreground">{c.name}</h4>
                        <Badge variant="outline">Weight: {c.weight}%</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {c.descriptors && Object.entries(c.descriptors as Record<string, string>)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([level, desc]) => (
                            <div key={level} className="flex gap-2">
                              <span className="font-medium min-w-[20px]">{level}:</span>
                              <span>{desc}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No criteria defined yet.</p>
                  <Button variant="outline" size="sm" onClick={openEditCriteria}>
                    <Plus className="mr-2 h-4 w-4" /> Add Criteria
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 text-slate-300 p-4 rounded-md font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-96">
                {process.agentSystemPrompt || "No system prompt configured."}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Candidates</div>
                <div className="text-3xl font-bold">{process.candidatesTotal}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Evaluated</div>
                <div className="text-3xl font-bold">{process.candidatesEvaluated}</div>
              </div>
              <div className="pt-4 border-t space-y-2">
                <Button variant="outline" className="w-full" onClick={handleShareWithManager} disabled={generateManagerLink.isPending}>
                  {generateManagerLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                  Share with Manager
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle className="text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 text-sm">
              <div className="flex justify-between py-2.5 border-b">
                <span className="text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Interview Type</span>
                <span className="font-medium capitalize">{process.interviewType}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b">
                <span className="text-muted-foreground flex items-center gap-2"><Code className="h-4 w-4" /> Tools Allowed</span>
                <span className="font-medium">{process.toolsAllowed ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-muted-foreground flex items-center gap-2"><Timer className="h-4 w-4" /> Response Timer</span>
                <div className="flex items-center gap-2">
                  {process.responseTimeLimitSeconds ? (
                    <span className="font-medium text-orange-600">{process.responseTimeLimitSeconds}s / response</span>
                  ) : (
                    <span className="font-medium text-muted-foreground">No limit</span>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openEditTimeLimit}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
