import { useState } from "react";
import { useGetManagerView } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Users, ChevronDown, ChevronUp, ThumbsUp, AlertTriangle, CheckCircle2, Award } from "lucide-react";

function getRecommendationColor(rec?: string | null) {
  if (!rec) return "bg-gray-100 text-gray-700 border-gray-200";
  const r = rec.toLowerCase();
  if (r.includes("advance") || r.includes("hire")) return "bg-green-100 text-green-800 border-green-200";
  if (r.includes("no hire") || r.includes("reject") || r.includes("not")) return "bg-red-50 text-red-700 border-red-200";
  return "bg-yellow-50 text-yellow-700 border-yellow-200";
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

type ManagerCandidate = {
  id: string;
  name: string;
  status: string;
  overallScore?: number | null;
  recommendation?: string | null;
  summary?: string | null;
  highlights?: string[] | null;
  redFlags?: string[] | null;
  criteriaScores?: Array<{ name: string; score: number; max: number; weight: number; justification: string }> | null;
  createdAt: string;
};

function CandidateRow({ candidate }: { candidate: ManagerCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = candidate.status === "completed" && candidate.overallScore != null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className={`flex items-center gap-4 p-4 ${isCompleted ? "cursor-pointer hover:bg-muted/30" : ""} transition-colors`}
        onClick={() => isCompleted && setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{candidate.name}</div>
          <div className="text-sm text-muted-foreground">{format(new Date(candidate.createdAt), "MMM d, yyyy")}</div>
        </div>

        <Badge variant="outline" className={`capitalize ${
          candidate.status === "completed" ? "bg-green-50 text-green-700 border-green-200" :
          candidate.status === "started" ? "bg-blue-50 text-blue-700 border-blue-200" :
          candidate.status === "invited" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
          "bg-gray-100 text-gray-600"
        }`}>
          {candidate.status}
        </Badge>

        {isCompleted ? (
          <>
            <div className={`text-2xl font-bold min-w-[48px] text-right ${getScoreColor(candidate.overallScore!)}`}>
              {candidate.overallScore}
            </div>
            <div className={`hidden sm:flex text-xs px-2 py-1 rounded border font-medium ${getRecommendationColor(candidate.recommendation)}`}>
              {candidate.recommendation}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Pending</div>
        )}
      </div>

      {expanded && isCompleted && (
        <div className="border-t bg-slate-50/50 p-5 space-y-5">
          {candidate.recommendation && (
            <div className={`inline-flex px-3 py-1 rounded border text-sm font-medium ${getRecommendationColor(candidate.recommendation)}`}>
              {candidate.recommendation}
            </div>
          )}

          {candidate.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{candidate.summary}</p>
          )}

          {candidate.criteriaScores && candidate.criteriaScores.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> Criteria Breakdown
              </h4>
              <div className="space-y-3">
                {candidate.criteriaScores.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.score}/{c.max}</span>
                    </div>
                    <Progress value={(c.score / c.max) * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {candidate.highlights && candidate.highlights.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" /> Highlights
                </h4>
                <ul className="space-y-1">
                  {candidate.highlights.map((h, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {candidate.redFlags && candidate.redFlags.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Red Flags
                </h4>
                <ul className="space-y-1">
                  {candidate.redFlags.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagerView() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useGetManagerView(token);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-muted/20 p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Link Not Found</h2>
          <p className="text-muted-foreground text-sm">This manager view link is invalid or has expired. Please request a new link from the HR team.</p>
        </Card>
      </div>
    );
  }

  const completedCandidates = data.candidates.filter((c) => c.status === "completed" && c.overallScore != null);
  const avgScore = completedCandidates.length > 0
    ? Math.round(completedCandidates.reduce((sum, c) => sum + (c.overallScore ?? 0), 0) / completedCandidates.length)
    : null;

  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          {data.companyLogoUrl && (
            <img src={data.companyLogoUrl} alt={data.companyName} className="h-8 object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{data.processTitle}</h1>
            <p className="text-sm text-muted-foreground">{data.companyName} · {data.area} · {data.seniority}</p>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs text-muted-foreground">Manager View (read-only)</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <div className="text-3xl font-bold text-foreground">{data.candidates.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Candidates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <div className="text-3xl font-bold text-green-600">{completedCandidates.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Evaluated</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <div className={`text-3xl font-bold ${avgScore != null ? getScoreColor(avgScore) : "text-muted-foreground"}`}>
                {avgScore ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Avg. Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <div className="text-3xl font-bold text-primary">
                {completedCandidates.filter((c) => {
                  const r = (c.recommendation ?? "").toLowerCase();
                  return r.includes("avançar") || r.includes("advance") || r.includes("hire");
                }).length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Recommended</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Candidates
            </CardTitle>
            <CardDescription>Click on a completed candidate to expand their evaluation details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.candidates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No candidates yet.</p>
            ) : (
              data.candidates.map((c) => (
                <CandidateRow key={c.id} candidate={c as ManagerCandidate} />
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-6">
          This is a read-only view shared by the HR team. Powered by HireForward.
        </p>
      </main>
    </div>
  );
}
