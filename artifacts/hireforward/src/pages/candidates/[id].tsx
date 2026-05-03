import { useLocation, useParams } from "wouter";
import { useGetCandidate, useGetEvaluation } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Mail, ThumbsUp, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Timer, MessageSquare, Star, Share2, Check,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from "recharts";

interface TranscriptMsg {
  role: string;
  content: string;
  timestamp?: string;
}

interface CriterionScore {
  name: string;
  score: number;
  max: number;
  weight?: number;
  justification?: string;
}

interface ResponsePair {
  questionIndex: number;
  questionSnippet: string;
  responseSnippet: string;
  responseTimeSecs: number;
}

function computeResponsePairs(transcript: TranscriptMsg[]): ResponsePair[] {
  const pairs: ResponsePair[] = [];
  let qIndex = 0;
  for (let i = 0; i < transcript.length - 1; i++) {
    const msg = transcript[i];
    const next = transcript[i + 1];
    if (msg.role === "assistant" && next.role === "user" && msg.timestamp && next.timestamp) {
      const delta = (new Date(next.timestamp).getTime() - new Date(msg.timestamp).getTime()) / 1000;
      if (delta > 0 && delta < 3600) {
        qIndex++;
        pairs.push({
          questionIndex: qIndex,
          questionSnippet: msg.content.length > 120 ? msg.content.slice(0, 120) + "…" : msg.content,
          responseSnippet: next.content.length > 80 ? next.content.slice(0, 80) + "…" : next.content,
          responseTimeSecs: Math.round(delta),
        });
      }
    }
  }
  return pairs;
}

function formatSecs(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 72;
  const strokeWidth = 10;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  const trackColor = score >= 80 ? "#dcfce7" : score >= 60 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke={trackColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const r = recommendation.toLowerCase();
  let variant = { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" };
  if (r.includes("strong hire")) variant = { bg: "bg-green-50", text: "text-green-800", border: "border-green-200", dot: "bg-green-500" };
  else if (r.includes("hire")) variant = { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" };
  else if (r.includes("fence") || r.includes("hold")) variant = { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" };
  else if (r.includes("no") || r.includes("reject")) variant = { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm ${variant.bg} ${variant.text} ${variant.border}`}>
      <span className={`w-2 h-2 rounded-full ${variant.dot}`} />
      {recommendation}
    </div>
  );
}

function CriteriaRadarChart({ criteriaScores }: { criteriaScores: CriterionScore[] }) {
  const data = criteriaScores.map((c) => ({
    subject: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
    score: Math.round((c.score / c.max) * 100),
    fullMark: 100,
  }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickCount={4}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#1e3a5f"
          fill="#1e3a5f"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 4, fill: "#1e3a5f", strokeWidth: 0 }}
        />
        <Tooltip
          formatter={(value: number) => [`${value}/100`, "Score"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ResponseHeatmap({ transcript }: { transcript: TranscriptMsg[] }) {
  const pairs = useMemo(() => computeResponsePairs(transcript), [transcript]);

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-6">
        No timing data available — messages may not have timestamps.
      </p>
    );
  }

  const times = pairs.map((p) => p.responseTimeSecs);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const slowestIdx = times.indexOf(maxTime);
  const fastestIdx = times.indexOf(minTime);

  const getBarColor = (secs: number) => {
    const pct = maxTime > minTime ? (secs - minTime) / (maxTime - minTime) : 0.5;
    if (pct >= 0.75) return "bg-red-400";
    if (pct >= 0.45) return "bg-amber-400";
    return "bg-emerald-400";
  };

  const getBadgeStyle = (secs: number, idx: number) => {
    if (idx === slowestIdx) return "bg-red-50 text-red-700 border-red-200";
    if (idx === fastestIdx) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getLabel = (idx: number) => {
    if (idx === slowestIdx && pairs.length > 1) return "slowest";
    if (idx === fastestIdx && pairs.length > 1) return "fastest";
    return null;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{formatSecs(avgTime)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">avg response</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{formatSecs(minTime)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">fastest reply</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{formatSecs(maxTime)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">slowest reply</div>
        </div>
      </div>
      <div className="space-y-3">
        {pairs.map((pair, idx) => {
          const pct = maxTime > 0 ? (pair.responseTimeSecs / maxTime) * 100 : 50;
          const label = getLabel(idx);
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-1 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground w-5 text-right">Q{pair.questionIndex}</span>
                  <span className="text-xs text-muted-foreground truncate">{pair.questionSnippet}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {label && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getBadgeStyle(pair.responseTimeSecs, idx)}`}>
                      {label}
                    </span>
                  )}
                  <span className={`text-sm font-bold tabular-nums ${getBadgeStyle(pair.responseTimeSecs, idx).split(" ")[1]}`}>
                    {formatSecs(pair.responseTimeSecs)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0" />
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(pair.responseTimeSecs)}`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="w-5 shrink-0" />
                <p className="text-[11px] text-muted-foreground italic leading-snug">&ldquo;{pair.responseSnippet}&rdquo;</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-right">
        Hover a row to preview the candidate's response. Times measured from AI question to candidate send.
      </p>
    </div>
  );
}

export default function CandidateDetail() {
  const { id: candidateId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: candidate, isLoading: isLoadingCandidate } = useGetCandidate(candidateId);
  const { data: evaluation, isLoading: isLoadingEval } = useGetEvaluation(candidateId);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}/share-report`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate share link");
      return res.json() as Promise<{ token: string; link: string }>;
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.link).then(() => {
        setCopied(true);
        toast({ title: "Link copied!", description: "Share this link — it expires in 30 days." });
        setTimeout(() => setCopied(false), 3000);
      }).catch(() => {
        toast({ title: "Link generated", description: data.link });
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate share link.", variant: "destructive" });
    },
  });

  const handleShare = useCallback(() => {
    shareMutation.mutate();
  }, [shareMutation]);

  if (isLoadingCandidate || (candidate?.status === "completed" && isLoadingEval)) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-1 rounded-xl" />
          <Skeleton className="h-64 col-span-2 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!candidate) return <div className="p-8 text-center text-muted-foreground">Candidate not found.</div>;

  const transcript = (candidate.transcript ?? []) as TranscriptMsg[];
  const criteriaScores = (evaluation?.criteriaScores ?? []) as CriterionScore[];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          onClick={() => setLocation(`/processes/${candidate.jobProcessId}/candidates`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">{candidate.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {candidate.email}
            </span>
            <span className="text-slate-300">•</span>
            <span>Added {format(new Date(candidate.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {candidate.status === "completed" && evaluation && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleShare}
              disabled={shareMutation.isPending}
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-green-600" /> Copied!</>
              ) : shareMutation.isPending ? (
                <><Share2 className="h-3.5 w-3.5 animate-pulse" /> Sharing…</>
              ) : (
                <><Share2 className="h-3.5 w-3.5" /> Share Report</>
              )}
            </Button>
          )}
          {candidate.status !== "completed" && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Interview Incomplete
            </Badge>
          )}
        </div>
      </div>

      {candidate.status === "completed" && evaluation ? (
        <>
          {/* Score + Recommendation + Summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score ring card */}
            <Card className="flex flex-col items-center justify-center py-8 px-4 bg-gradient-to-b from-white to-slate-50/60 border shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Overall Score</p>
              <ScoreRing score={evaluation.overallScore} />
              <div className="mt-6">
                <RecommendationBadge recommendation={evaluation.recommendation} />
              </div>
            </Card>

            {/* Summary + Highlights / Red Flags */}
            <Card className="col-span-2 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground leading-relaxed">{evaluation.summary}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                  {/* Highlights */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-700 mb-3">
                      <ThumbsUp className="h-3.5 w-3.5" /> Highlights
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.highlights.map((h: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                          <span className="leading-snug">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Red Flags */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5" /> Red Flags
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.redFlags.length > 0 ? evaluation.redFlags.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                          <span className="leading-snug">{r}</span>
                        </li>
                      )) : (
                        <li className="text-sm text-muted-foreground italic">None identified.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart + Criteria Breakdown */}
          {criteriaScores.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radar */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Skills Radar</CardTitle>
                  <CardDescription>AI-scored criteria mapped as a percentage of maximum.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CriteriaRadarChart criteriaScores={criteriaScores} />
                </CardContent>
              </Card>

              {/* Criteria list */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Criteria Breakdown</CardTitle>
                  <CardDescription>Score and AI justification per rubric criterion.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 overflow-y-auto max-h-[360px] pr-2">
                  {criteriaScores.map((c, i) => {
                    const pct = Math.round((c.score / c.max) * 100);
                    const barColor =
                      pct >= 80 ? "bg-green-500" : pct >= 55 ? "bg-amber-400" : "bg-red-400";
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {c.score}<span className="text-muted-foreground font-normal">/{c.max}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {c.justification && (
                          <p className="text-xs text-muted-foreground leading-relaxed bg-slate-50 rounded-md px-3 py-2">
                            {c.justification}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Response Timing Heatmap */}
          {transcript.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-4 w-4 text-primary" /> Response Timing
                    </CardTitle>
                    <CardDescription className="mt-1">
                      How long the candidate took to respond to each question.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 mt-1">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> fast</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> moderate</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> slow</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponseHeatmap transcript={transcript} />
              </CardContent>
            </Card>
          )}

          {/* Interview Transcript */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setTranscriptOpen(!transcriptOpen)}
            >
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Interview Transcript
                </CardTitle>
                {transcriptOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {transcriptOpen && (
              <CardContent className="border-t pt-6 bg-slate-50/60 space-y-4">
                {transcript.length > 0 ? (
                  transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-white border text-foreground rounded-bl-sm"
                      }`}>
                        {msg.role === "assistant" && (
                          <div className="text-xs font-semibold text-primary mb-1">AI Interviewer</div>
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        {msg.timestamp && (
                          <div className={`text-xs mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {format(new Date(msg.timestamp), "h:mm:ss a")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-8">No transcript available.</p>
                )}
              </CardContent>
            )}
          </Card>
        </>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-muted-foreground">
              Evaluation not yet available. The candidate hasn't completed the interview or it is still processing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
