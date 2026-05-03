import { useState, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useGetProcess,
  useListCandidates,
  useCreateCandidate,
  useUpdateCandidatePipelineStage,
  getListCandidatesQueryKey,
} from "@workspace/api-client-react";
import type { Candidate, CandidatePipelineStage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Search, Mail, Loader2, Upload, FileText,
  X, CheckCircle2, AlertCircle, LayoutList, Kanban,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const IMP_SESSION_KEY = "hf_imp";
function getImpersonationToken(): string | null {
  try {
    const raw = sessionStorage.getItem(IMP_SESSION_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token: string }).token;
  } catch { return null; }
}

type StatusFilter = "all" | "invited" | "started" | "completed" | "expired";
type ViewMode = "table" | "kanban";

type PipelineStageKey = "new" | "reviewing" | "shortlisted" | "approved" | "rejected";

const PIPELINE_COLUMNS: {
  key: PipelineStageKey;
  label: string;
  color: string;
  headerBg: string;
  dot: string;
}[] = [
  { key: "new", label: "Invited", color: "blue", headerBg: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
  { key: "reviewing", label: "Under Review", color: "amber", headerBg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" },
  { key: "shortlisted", label: "Shortlisted", color: "indigo", headerBg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  { key: "approved", label: "Approved", color: "green", headerBg: "bg-green-50 border-green-200", dot: "bg-green-400" },
  { key: "rejected", label: "Rejected", color: "red", headerBg: "bg-red-50 border-red-200", dot: "bg-red-300" },
];

interface CsvRow {
  name: string;
  email: string;
  valid: boolean;
  error?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("email") || firstLine.includes("nome");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines
    .filter(l => l.trim().length > 0)
    .map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
      const name = cols[0] ?? "";
      const email = cols[1] ?? "";
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return {
        name,
        email,
        valid: name.length > 0 && emailValid,
        error: !name ? "Missing name" : !emailValid ? "Invalid email" : undefined,
      };
    });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "invited": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Invited</Badge>;
    case "started": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">In Progress</Badge>;
    case "completed": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Completed</Badge>;
    case "expired": return <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Expired</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function getRecommendationBadge(rec?: string | null) {
  if (!rec) return null;
  const r = rec.toLowerCase();
  if (r.includes("strong") || r.includes("hire")) return <Badge className="bg-green-500 text-white hover:bg-green-600 text-xs">{rec}</Badge>;
  if (r.includes("no") || r.includes("reject")) return <Badge variant="destructive" className="text-xs">{rec}</Badge>;
  return <Badge variant="secondary" className="text-xs">{rec}</Badge>;
}

function getStageBadge(stage?: string | null) {
  const col = PIPELINE_COLUMNS.find(c => c.key === stage);
  if (!col) return null;
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colorMap[col.color] ?? ""}`}>
      {col.label}
    </Badge>
  );
}

interface KanbanCardProps {
  candidate: Candidate;
  onClickReport: () => void;
}

function KanbanCard({ candidate, onClickReport }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: candidate.id,
    data: { candidate },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{candidate.name}</p>
          <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
        </div>
        {getStatusBadge(candidate.status)}
      </div>
      {candidate.overallScore !== null && candidate.overallScore !== undefined && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">Score</span>
          <span className="font-bold text-sm">{candidate.overallScore}</span>
        </div>
      )}
      {candidate.recommendation && (
        <div className="mt-1.5">{getRecommendationBadge(candidate.recommendation)}</div>
      )}
      {candidate.status === "completed" && (
        <button
          onClick={(e) => { e.stopPropagation(); onClickReport(); }}
          className="mt-2 w-full text-xs text-primary hover:underline text-left"
          onPointerDown={e => e.stopPropagation()}
        >
          View report →
        </button>
      )}
      <p className="text-[10px] text-muted-foreground mt-2">
        {format(new Date(candidate.createdAt), "MMM d")}
      </p>
    </div>
  );
}

interface KanbanColumnProps {
  column: typeof PIPELINE_COLUMNS[number];
  candidates: Candidate[];
  onClickReport: (id: string) => void;
  isOver: boolean;
}

function KanbanColumn({ column, candidates, onClickReport, isOver }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col rounded-xl border-2 transition-colors min-w-[240px] w-[240px] shrink-0 ${column.headerBg} ${isOver ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${column.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dot}`} />
          <span className="font-semibold text-sm">{column.label}</span>
        </div>
        <span className="text-xs font-medium bg-white/70 rounded-full px-2 py-0.5 text-muted-foreground">
          {candidates.length}
        </span>
      </div>
      <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-[120px]">
          {candidates.map(c => (
            <KanbanCard
              key={c.id}
              candidate={c}
              onClickReport={() => onClickReport(c.id)}
            />
          ))}
          {candidates.length === 0 && (
            <div className="flex-1 flex items-center justify-center min-h-[80px]">
              <p className="text-xs text-muted-foreground/60 italic">No candidates</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function CandidatesList() {
  const { id: processId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { getToken } = useAuth();

  const { data: process, isLoading: isLoadingProcess } = useGetProcess(processId);
  const { data: candidates, isLoading: isLoadingCandidates } = useListCandidates(processId);
  const createCandidate = useCreateCandidate();
  const updateStage = useUpdateCandidatePipelineStage();

  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importResults, setImportResults] = useState<{ ok: number; failed: number }>({ ok: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const [optimisticStages, setOptimisticStages] = useState<Record<string, PipelineStageKey>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allCandidates = candidates ?? [];

  const getCandidateStage = (c: Candidate): PipelineStageKey => {
    return (optimisticStages[c.id] ?? c.pipelineStage ?? "new") as PipelineStageKey;
  };

  const statusCounts = {
    all: allCandidates.length,
    invited: allCandidates.filter(c => c.status === "invited").length,
    started: allCandidates.filter(c => c.status === "started").length,
    completed: allCandidates.filter(c => c.status === "completed").length,
    expired: allCandidates.filter(c => c.status === "expired").length,
  };

  const filteredCandidates = allCandidates.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddCandidate = () => {
    if (!newName || !newEmail) return;
    createCandidate.mutate(
      { id: processId, data: { name: newName, email: newEmail } },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setNewName("");
          setNewEmail("");
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(processId) });
          toast({ title: "Candidate invited", description: `Invite sent to ${newEmail}.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add candidate.", variant: "destructive" });
        },
      }
    );
  };

  const handleResend = async (candidateId: string, candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResendingId(candidateId);
    try {
      const authToken = getImpersonationToken() ?? await getToken();
      const res = await fetch(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/processes/${processId}/candidates/${candidateId}/resend-invite`,
        { method: "POST", headers: { "Authorization": `Bearer ${authToken}` } }
      );
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(processId) });
      toast({ title: "Invite resent", description: `A new interview link was sent to ${candidateName}.` });
    } catch {
      toast({ title: "Error", description: "Failed to resend invite.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
      setImportDone(false);
      setImportProgress(0);
      setImportResults({ ok: 0, failed: 0 });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
      setImportDone(false);
      setImportProgress(0);
      setImportResults({ ok: 0, failed: 0 });
    };
    reader.readAsText(file);
  };

  const validRows = csvRows.filter(r => r.valid);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await new Promise<void>((resolve, reject) => {
          createCandidate.mutate(
            { id: processId, data: { name: row.name, email: row.email } },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
        ok++;
      } catch {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }
    setImporting(false);
    setImportDone(true);
    setImportResults({ ok, failed });
    queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(processId) });
  };

  const resetImport = () => {
    setCsvRows([]);
    setImportDone(false);
    setImportProgress(0);
    setImportResults({ ok: 0, failed: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragStart = (event: DragStartEvent) => {
    const candidate = event.active.data.current?.candidate as Candidate;
    setActiveCandidate(candidate ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const over = event.over;
    if (!over) { setOverColumn(null); return; }
    const overIsColumn = PIPELINE_COLUMNS.some(c => c.key === over.id);
    if (overIsColumn) {
      setOverColumn(over.id as string);
    } else {
      const overCandidate = allCandidates.find(c => c.id === over.id);
      if (overCandidate) {
        setOverColumn(getCandidateStage(overCandidate));
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCandidate(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!over || !active) return;

    const draggedId = active.id as string;

    let targetStage: PipelineStageKey | null = null;
    const overIsColumn = PIPELINE_COLUMNS.some(c => c.key === over.id);
    if (overIsColumn) {
      targetStage = over.id as PipelineStageKey;
    } else {
      const overCandidate = allCandidates.find(c => c.id === over.id);
      if (overCandidate && overCandidate.id !== draggedId) {
        targetStage = getCandidateStage(overCandidate);
      }
    }

    if (!targetStage) return;

    const currentStage = getCandidateStage(allCandidates.find(c => c.id === draggedId)!);
    if (currentStage === targetStage) return;

    setOptimisticStages(prev => ({ ...prev, [draggedId]: targetStage! }));

    updateStage.mutate(
      { candidateId: draggedId, data: { stage: targetStage as CandidatePipelineStage } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey(processId) });
          setOptimisticStages(prev => {
            const next = { ...prev };
            delete next[draggedId];
            return next;
          });
        },
        onError: () => {
          setOptimisticStages(prev => {
            const next = { ...prev };
            delete next[draggedId];
            return next;
          });
          toast({ title: "Error", description: "Failed to update pipeline stage.", variant: "destructive" });
        },
      }
    );
  };

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "invited", label: "Invited" },
    { key: "started", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "expired", label: "Expired" },
  ];

  if (isLoadingProcess) {
    return <div className="p-6 md:p-8"><Skeleton className="h-8 w-64 mb-8" /></div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-full mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/processes/${processId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Candidates</h1>
            <p className="text-muted-foreground">{process?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutList className="h-4 w-4" /> Table
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "kanban"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Kanban className="h-4 w-4" /> Kanban
            </button>
          </div>

          <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) resetImport(); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Candidates from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with columns: <strong>Name, Email</strong>. The first row can be a header.
                </DialogDescription>
              </DialogHeader>

              {csvRows.length === 0 ? (
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-foreground">Drop your CSV here or click to browse</p>
                  <p className="text-sm text-muted-foreground mt-1">Columns: Name, Email</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {importDone ? (
                    <div className="rounded-lg p-4 bg-muted/30 flex flex-col items-center gap-3 py-6">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                      <p className="text-lg font-semibold">Import Complete</p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600 font-medium">{importResults.ok} imported</span>
                        {importResults.failed > 0 && (
                          <span className="text-red-500 font-medium">{importResults.failed} failed</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {csvRows.length} rows parsed —{" "}
                          <span className="text-green-600">{validRows.length} valid</span>
                          {csvRows.filter(r => !r.valid).length > 0 && (
                            <span className="text-red-500">, {csvRows.filter(r => !r.valid).length} invalid (will be skipped)</span>
                          )}
                        </p>
                        <Button variant="ghost" size="sm" onClick={resetImport}>
                          <X className="h-4 w-4 mr-1" /> Clear
                        </Button>
                      </div>

                      <div className="max-h-52 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvRows.map((row, i) => (
                              <TableRow key={i} className={!row.valid ? "opacity-50" : ""}>
                                <TableCell className="text-center">
                                  {row.valid ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                                  ) : (
                                    <span title={row.error}><AlertCircle className="h-4 w-4 text-red-400 inline" /></span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{row.name || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{row.email || <span className="italic">empty</span>}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {importing && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Sending invites...</span>
                            <span>{importProgress}%</span>
                          </div>
                          <Progress value={importProgress} className="h-2" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsImportOpen(false); resetImport(); }}>
                  {importDone ? "Close" : "Cancel"}
                </Button>
                {!importDone && csvRows.length > 0 && (
                  <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                    {importing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Import {validRows.length} Candidate{validRows.length !== 1 ? "s" : ""}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" /> Add Candidate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Candidate</DialogTitle>
                <DialogDescription>
                  Invite a new candidate to take the AI interview for this process.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddCandidate} disabled={!newName || !newEmail || createCandidate.isPending}>
                  {createCandidate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                className="pl-9 h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">Drag cards to move between stages</p>
          </div>

          {isLoadingCandidates ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_COLUMNS.map(col => (
                <div key={col.key} className="min-w-[240px] w-[240px] h-64 rounded-xl border-2 bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_COLUMNS.map(col => {
                  const colCandidates = filteredCandidates.filter(c => getCandidateStage(c) === col.key);
                  return (
                    <KanbanColumn
                      key={col.key}
                      column={col}
                      candidates={colCandidates}
                      onClickReport={(id) => setLocation(`/candidates/${id}`)}
                      isOver={overColumn === col.key}
                    />
                  );
                })}
              </div>
              <DragOverlay>
                {activeCandidate && (
                  <div className="bg-white border border-primary/30 rounded-lg p-3 shadow-xl rotate-2 w-[220px]">
                    <p className="font-medium text-sm truncate">{activeCandidate.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{activeCandidate.email}</p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>Candidate List</CardTitle>
                  <CardDescription>View and manage candidates in this process.</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name or email..."
                    className="pl-9 h-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {filterButtons.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {label}
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
                      statusFilter === key ? "bg-white/20" : "bg-background"
                    }`}>
                      {statusCounts[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCandidates ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="h-8 w-8 opacity-30" />
                        <p className="font-medium">
                          {statusFilter !== "all"
                            ? `No ${statusFilter === "started" ? "in-progress" : statusFilter} candidates`
                            : search
                            ? "No candidates match your search"
                            : "No candidates yet"}
                        </p>
                        {statusFilter === "all" && !search && (
                          <p className="text-sm">Add candidates individually or import a CSV file.</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <TableRow
                      key={candidate.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => {
                        if (candidate.status === "completed") {
                          setLocation(`/candidates/${candidate.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{candidate.name}</div>
                        <div className="text-sm text-muted-foreground">{candidate.email}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                      <TableCell>{getStageBadge(getCandidateStage(candidate))}</TableCell>
                      <TableCell>
                        {candidate.overallScore !== null && candidate.overallScore !== undefined ? (
                          <span className="font-semibold text-lg">{candidate.overallScore}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getRecommendationBadge(candidate.recommendation)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(candidate.createdAt), "MMM d")}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        {candidate.status !== "completed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            disabled={resendingId === candidate.id}
                            onClick={(e) => handleResend(candidate.id, candidate.name, e)}
                          >
                            {resendingId === candidate.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Mail className="h-3 w-3 mr-1" />
                            )}
                            Resend
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary"
                            onClick={() => setLocation(`/candidates/${candidate.id}`)}
                          >
                            View Report →
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
