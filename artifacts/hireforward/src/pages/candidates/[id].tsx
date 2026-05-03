import { useLocation, useParams } from "wouter";
import { useGetCandidate, useGetEvaluation } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Mail, Award, ThumbsUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Timer, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";

interface TranscriptMsg {
  role: string;
  content: string;
  timestamp?: string;
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

function ResponseHeatmap({ transcript }: { transcript: TranscriptMsg[] }) {
  const pairs = useMemo(() => computeResponsePairs(transcript), [transcript]);

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-6">
        No timing data available — messages may not have timestamps.
      </p>
    );
  }

  const times = pairs.map(p => p.responseTimeSecs);
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
      {/* Summary row */}
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

      {/* Heatmap rows */}
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
              {/* Bar */}
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0" />
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(pair.responseTimeSecs)}`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
              </div>
              {/* Response snippet — visible on hover */}
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
  
  const { data: candidate, isLoading: isLoadingCandidate } = useGetCandidate(candidateId);
  const { data: evaluation, isLoading: isLoadingEval } = useGetEvaluation(candidateId);

  const getRecommendationColor = (rec?: string) => {
    if (!rec) return "bg-gray-100 text-gray-800 border-gray-200";
    const r = rec.toLowerCase();
    if (r.includes('strong hire')) return "bg-green-100 text-green-800 border-green-200";
    if (r.includes('hire')) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (r.includes('no') || r.includes('reject')) return "bg-red-50 text-red-700 border-red-200";
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoadingCandidate || (candidate?.status === 'completed' && isLoadingEval)) {
    return <div className="p-6 md:p-8"><Skeleton className="h-8 w-64 mb-8" /></div>;
  }

  if (!candidate) return <div className="p-8 text-center">Candidate not found.</div>;

  const transcript = (candidate.transcript ?? []) as TranscriptMsg[];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/processes/${candidate.jobProcessId}/candidates`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{candidate.name}</h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {candidate.email}</span>
            <span>•</span>
            <span>Added {format(new Date(candidate.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        {candidate.status !== 'completed' && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Interview Incomplete</Badge>
        )}
      </div>

      {candidate.status === 'completed' && evaluation ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="col-span-1 border-primary/20 bg-gradient-to-b from-white to-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overall Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className={`text-7xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                  {evaluation.overallScore}
                </div>
                <div className="text-sm text-muted-foreground mt-2">out of 100</div>
                
                <div className={`mt-8 px-4 py-2 rounded-md border text-center font-medium w-full ${getRecommendationColor(evaluation.recommendation)}`}>
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-1">AI Recommendation</div>
                  <div className="text-lg">{evaluation.recommendation}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {evaluation.summary}
                </p>

                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold text-green-700 mb-3">
                      <ThumbsUp className="h-4 w-4" /> Highlights
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold text-red-700 mb-3">
                      <AlertTriangle className="h-4 w-4" /> Red Flags / Weaknesses
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.redFlags.length > 0 ? evaluation.redFlags.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <span>{r}</span>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Criteria Breakdown</CardTitle>
              <CardDescription>Detailed scoring against the configured rubric.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {evaluation.criteriaScores.map((c, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="font-semibold">{c.score}/{c.max}</span>
                  </div>
                  <Progress value={(c.score / c.max) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1 bg-slate-50 p-2 rounded">
                    {c.justification}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Response Timing Heatmap */}
          {transcript.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Timer className="h-5 w-5 text-primary" /> Response Timing
                    </CardTitle>
                    <CardDescription className="mt-1">
                      How long the candidate took to respond to each question. Long pauses may indicate difficulty — or tool usage.
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
          
          <Card>
            <CardHeader className="cursor-pointer hover:bg-muted/30" onClick={() => setTranscriptOpen(!transcriptOpen)}>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" /> Interview Transcript
                </CardTitle>
                {transcriptOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>
            {transcriptOpen && (
              <CardContent className="border-t pt-6 bg-slate-50 space-y-4">
                {transcript.length > 0 ? (
                  transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-white border text-foreground rounded-bl-sm'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="text-xs font-semibold text-primary mb-1">AI Interviewer</div>
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        {msg.timestamp && (
                          <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.timestamp), "h:mm:ss a")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground italic text-center py-8">
                    No transcript available.
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Evaluation is not available yet. The candidate has not completed the interview or it is still processing.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const MessageSquare = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
