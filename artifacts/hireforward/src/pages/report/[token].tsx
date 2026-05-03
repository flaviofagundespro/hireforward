import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ThumbsUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Timer } from "lucide-react";
import { useState, useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from "recharts";

interface CriterionScore {
  name: string;
  score: number;
  max: number;
  weight?: number;
  justification?: string;
}

interface TranscriptMsg {
  role: string;
  content: string;
  timestamp?: string;
}

interface SharedReportData {
  candidateName: string;
  processTitle: string | null;
  processArea: string | null;
  expiresAt: string;
  evaluation: {
    overallScore: number;
    recommendation: string;
    criteriaScores: CriterionScore[];
    highlights: string[];
    redFlags: string[];
    summary: string;
    createdAt: string;
  } | null;
  transcript: TranscriptMsg[];
}

async function fetchSharedReport(token: string): Promise<SharedReportData> {
  const res = await fetch(`/api/report/${token}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Report not found");
  }
  return res.json();
}

/* ── Score Ring ──────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const radius = 72;
  const sw = 10;
  const nr = radius - sw / 2;
  const circ = nr * 2 * Math.PI;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const track = score >= 80 ? "#dcfce7" : score >= 60 ? "#fef3c7" : "#fee2e2";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle stroke={track} fill="transparent" strokeWidth={sw} r={nr} cx={radius} cy={radius} />
        <circle stroke={color} fill="transparent" strokeWidth={sw}
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
          strokeLinecap="round" r={nr} cx={radius} cy={radius}
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

/* ── Recommendation Badge ────────────────────────────────────────────────── */
function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const r = recommendation.toLowerCase();
  let v = { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" };
  if (r.includes("strong hire")) v = { bg: "bg-green-50", text: "text-green-800", border: "border-green-200", dot: "bg-green-500" };
  else if (r.includes("hire")) v = { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
  else if (r.includes("fence") || r.includes("hold")) v = { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
  else if (r.includes("no") || r.includes("reject")) v = { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm ${v.bg} ${v.text} ${v.border}`}>
      <span className={`w-2 h-2 rounded-full ${v.dot}`} />
      {recommendation}
    </div>
  );
}

/* ── Radar Chart ─────────────────────────────────────────────────────────── */
function CriteriaRadarChart({ criteriaScores }: { criteriaScores: CriterionScore[] }) {
  const data = criteriaScores.map((c) => ({
    subject: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
    score: Math.round((c.score / c.max) * 100),
    fullMark: 100,
  }));
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickCount={4} />
        <Radar name="Score" dataKey="score" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.15} strokeWidth={2}
          dot={{ r: 4, fill: "#1e3a5f", strokeWidth: 0 }} />
        <Tooltip formatter={(v: number) => [`${v}/100`, "Score"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Response Timing ─────────────────────────────────────────────────────── */
function computeResponsePairs(transcript: TranscriptMsg[]) {
  const pairs: { qi: number; q: string; a: string; secs: number }[] = [];
  let qi = 0;
  for (let i = 0; i < transcript.length - 1; i++) {
    const m = transcript[i], n = transcript[i + 1];
    if (m.role === "assistant" && n.role === "user" && m.timestamp && n.timestamp) {
      const d = (new Date(n.timestamp).getTime() - new Date(m.timestamp).getTime()) / 1000;
      if (d > 0 && d < 3600) {
        qi++;
        pairs.push({ qi, q: m.content.slice(0, 100) + (m.content.length > 100 ? "…" : ""), a: n.content.slice(0, 80) + (n.content.length > 80 ? "…" : ""), secs: Math.round(d) });
      }
    }
  }
  return pairs;
}
function fmt(s: number) { if (s < 60) return `${s}s`; const m = Math.floor(s / 60); const r = s % 60; return r ? `${m}m ${r}s` : `${m}m`; }

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => fetchSharedReport(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <SharedHeader />
        <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6">
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-56 md:col-span-1 rounded-xl" />
            <Skeleton className="h-56 md:col-span-2 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <SharedHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="text-5xl mb-2">🔗</div>
          <h1 className="text-2xl font-bold text-foreground">Report not found</h1>
          <p className="text-muted-foreground max-w-sm">
            This link may have expired or been revoked. Ask the sender to generate a new one.
          </p>
          <a href="/" className="mt-4 text-sm font-medium text-primary hover:underline">← Back to HireForward</a>
        </div>
        <PoweredBy />
      </div>
    );
  }

  const { candidateName, processTitle, evaluation, transcript, expiresAt } = data;
  const criteriaScores = (evaluation?.criteriaScores ?? []) as CriterionScore[];
  const msgs = (transcript ?? []) as TranscriptMsg[];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SharedHeader />

      <main className="flex-1 py-10 px-4 md:px-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Title row */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{candidateName}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {processTitle && <span>{processTitle}</span>}
              <span className="text-slate-300">•</span>
              <span>Expires {format(new Date(expiresAt), "MMM d, yyyy")}</span>
            </div>
          </div>

          {evaluation ? (
            <>
              {/* Score + Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="flex flex-col items-center justify-center py-8 px-4 bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Overall Score</p>
                  <ScoreRing score={evaluation.overallScore} />
                  <div className="mt-6">
                    <RecommendationBadge recommendation={evaluation.recommendation} />
                  </div>
                </Card>

                <Card className="col-span-2 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">AI Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{evaluation.summary}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                      <div>
                        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-700 mb-3">
                          <ThumbsUp className="h-3.5 w-3.5" /> Highlights
                        </h4>
                        <ul className="space-y-2">
                          {evaluation.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                              <span className="leading-snug">{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-3">
                          <AlertTriangle className="h-3.5 w-3.5" /> Red Flags
                        </h4>
                        <ul className="space-y-2">
                          {evaluation.redFlags.length > 0
                            ? evaluation.redFlags.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                                  <span className="leading-snug">{r}</span>
                                </li>
                              ))
                            : <li className="text-sm text-muted-foreground italic">None identified.</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Radar + Criteria */}
              {criteriaScores.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Skills Radar</CardTitle>
                      <CardDescription>AI-scored criteria as a percentage of maximum.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CriteriaRadarChart criteriaScores={criteriaScores} />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Criteria Breakdown</CardTitle>
                      <CardDescription>Score and justification per rubric criterion.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 overflow-y-auto max-h-[360px] pr-2">
                      {criteriaScores.map((c, i) => {
                        const pct = Math.round((c.score / c.max) * 100);
                        const bar = pct >= 80 ? "bg-green-500" : pct >= 55 ? "bg-amber-400" : "bg-red-400";
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-foreground">{c.name}</span>
                              <span className="text-sm font-semibold tabular-nums">
                                {c.score}<span className="text-muted-foreground font-normal">/{c.max}</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%`, transition: "width 0.5s ease" }} />
                            </div>
                            {c.justification && (
                              <p className="text-xs text-muted-foreground leading-relaxed bg-slate-50 rounded-md px-3 py-2">{c.justification}</p>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Response Timing */}
              {msgs.length > 0 && <ResponseTimingCard transcript={msgs} />}

              {/* Transcript */}
              <Card className="shadow-sm overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                >
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ChatIcon className="h-4 w-4" /> Interview Transcript
                    </CardTitle>
                    {transcriptOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
                {transcriptOpen && (
                  <CardContent className="border-t pt-6 bg-slate-50/60 space-y-4">
                    {msgs.length > 0 ? msgs.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-white border text-foreground rounded-bl-sm"}`}>
                          {msg.role === "assistant" && <div className="text-xs font-semibold text-primary mb-1">AI Interviewer</div>}
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          {msg.timestamp && (
                            <div className={`text-xs mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {format(new Date(msg.timestamp), "h:mm:ss a")}
                            </div>
                          )}
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground italic text-center py-8">No transcript available.</p>}
                  </CardContent>
                )}
              </Card>
            </>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-muted-foreground">Evaluation is not yet available for this candidate.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <PoweredBy />
    </div>
  );
}

/* ── Response Timing Card ────────────────────────────────────────────────── */
function ResponseTimingCard({ transcript }: { transcript: TranscriptMsg[] }) {
  const pairs = useMemo(() => computeResponsePairs(transcript), [transcript]);
  if (!pairs.length) return null;
  const times = pairs.map((p) => p.secs);
  const max = Math.max(...times), min = Math.min(...times);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const slowI = times.indexOf(max), fastI = times.indexOf(min);
  const barColor = (s: number) => { const p = max > min ? (s - min) / (max - min) : 0.5; return p >= 0.75 ? "bg-red-400" : p >= 0.45 ? "bg-amber-400" : "bg-emerald-400"; };
  const badge = (idx: number) => idx === slowI ? "bg-red-50 text-red-700 border-red-200" : idx === fastI ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> Response Timing</CardTitle>
            <CardDescription className="mt-1">How long the candidate took to respond to each question.</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> fast</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> moderate</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> slow</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 border rounded-lg p-3 text-center"><div className="text-2xl font-bold">{fmt(avg)}</div><div className="text-xs text-muted-foreground mt-0.5">avg response</div></div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-emerald-700">{fmt(min)}</div><div className="text-xs text-muted-foreground mt-0.5">fastest</div></div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-red-600">{fmt(max)}</div><div className="text-xs text-muted-foreground mt-0.5">slowest</div></div>
        </div>
        <div className="space-y-3">
          {pairs.map((p, i) => (
            <div key={i} className="group">
              <div className="flex items-center justify-between mb-1 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground w-5 text-right">Q{p.qi}</span>
                  <span className="text-xs text-muted-foreground truncate">{p.q}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(i === slowI || i === fastI) && pairs.length > 1 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge(i)}`}>{i === slowI ? "slowest" : "fastest"}</span>
                  )}
                  <span className={`text-sm font-bold tabular-nums ${badge(i).split(" ")[1]}`}>{fmt(p.secs)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0" />
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor(p.secs)}`} style={{ width: `${Math.max(max > 0 ? (p.secs / max) * 100 : 50, 3)}%` }} />
                </div>
              </div>
              <div className="flex items-start gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="w-5 shrink-0" />
                <p className="text-[11px] text-muted-foreground italic leading-snug">&ldquo;{p.a}&rdquo;</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Shared Header ───────────────────────────────────────────────────────── */
function SharedHeader() {
  return (
    <header className="h-14 flex items-center justify-between px-6 md:px-10 border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
      <a href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground hover:opacity-80 transition-opacity">
        <div className="h-6 w-6 rounded bg-slate-900 flex items-center justify-center text-white text-xs font-black">H</div>
        HireForward
      </a>
      <span className="text-xs font-medium text-muted-foreground border border-slate-200 rounded-full px-3 py-1 bg-slate-50">
        Read-only report
      </span>
    </header>
  );
}

/* ── Powered By Badge ────────────────────────────────────────────────────── */
function PoweredBy() {
  return (
    <footer className="py-8 text-center border-t border-slate-100 bg-white">
      <a
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">Powered by</span>
        <span className="font-semibold text-foreground">HireForward</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-400 group-hover:text-primary transition-colors text-xs">AI-native recruitment platform</span>
      </a>
    </footer>
  );
}

/* ── Chat Icon ───────────────────────────────────────────────────────────── */
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
