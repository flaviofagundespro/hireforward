import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Bot, Send, Loader2, ArrowRight, Star, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

/* ─── Demo script ────────────────────────────────────────────────────────── */

const DEMO_QUESTIONS = [
  `Hello! I'm your AI interviewer for HireForward. This is a demo of a **Product Manager — Problem Solving** interview.\n\nLet's start with a warm-up: Tell me about a product you use daily that you think could be significantly improved. What would you change, and why?`,
  `Good answer — I like how you framed the user need. Let's go deeper.\n\nImagine you're a PM at a major streaming service. Over the past quarter, user engagement has dropped 20%. Walk me through how you'd diagnose the problem and what you'd prioritize fixing first.`,
  `Nice framework. Now let's talk trade-offs.\n\nYou have two features competing for the same sprint:\n\n**(A)** A new onboarding flow that data suggests could reduce churn by 5%.\n**(B)** A power-user feature requested loudly by your top 10% most active users.\n\nWhich do you build, and what additional data would you want before deciding?`,
  `Last question: You ship the onboarding improvement. Two weeks later the data confirms it reduced churn — but power users are now complaining publicly that they feel ignored.\n\nWhat do you do, and how do you communicate this situation to your leadership team?`,
];

const TYPING_SPEED_MS = 14; // ms per character

/* ─── Sample evaluation ─────────────────────────────────────────────────── */

const SAMPLE_REPORT = {
  score: 78,
  recommendation: "Shortlist for next round",
  strengths: [
    "Structured, hypothesis-driven problem solving",
    "Consistently anchored decisions to user impact",
    "Showed clear awareness of stakeholder communication",
  ],
  improvements: [
    "Could be more specific about which metrics to track before shipping",
    "Trade-off answer leaned slightly toward intuition over data",
  ],
  redFlags: [] as string[],
  summary:
    "This candidate demonstrates a solid PM mindset: they think in frameworks, consider multiple stakeholders, and articulate decisions clearly. The responses are well-structured and show practical experience. A strong shortlist candidate who would benefit from a deeper technical discovery call.",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function useTypewriter(text: string, active: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, TYPING_SPEED_MS);
    return () => clearInterval(id);
  }, [text, active]);

  return { displayed, done };
}

/* ─── Stages ─────────────────────────────────────────────────────────────── */

type Stage =
  | { type: "landing" }
  | { type: "interview"; questionIndex: number; messages: Message[]; inputLocked: boolean }
  | { type: "generating" }
  | { type: "report" };

type Message = { role: "assistant" | "user"; content: string };

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function Demo() {
  const [stage, setStage] = useState<Stage>({ type: "landing" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stage]);

  /* ── Start demo ── */
  const startDemo = () => {
    setStage({
      type: "interview",
      questionIndex: 0,
      messages: [{ role: "assistant", content: DEMO_QUESTIONS[0] }],
      inputLocked: false,
    });
  };

  /* ── Submit answer ── */
  const submitAnswer = useCallback(() => {
    if (stage.type !== "interview") return;
    const answer = inputValue.trim();
    if (!answer || stage.inputLocked) return;

    const { questionIndex, messages } = stage;
    const nextIndex = questionIndex + 1;
    const updatedMessages: Message[] = [...messages, { role: "user", content: answer }];

    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (nextIndex >= DEMO_QUESTIONS.length) {
      // Last question answered → generate report
      setStage({ type: "interview", questionIndex, messages: updatedMessages, inputLocked: true });
      setTimeout(() => setStage({ type: "generating" }), 800);
      setTimeout(() => setStage({ type: "report" }), 3200);
    } else {
      // Next question — lock input while "typing"
      setStage({ type: "interview", questionIndex, messages: updatedMessages, inputLocked: true });
      // After a short delay, add the next question message (typing effect handled in render)
      setTimeout(() => {
        setStage({
          type: "interview",
          questionIndex: nextIndex,
          messages: [...updatedMessages, { role: "assistant", content: DEMO_QUESTIONS[nextIndex] }],
          inputLocked: false,
        });
      }, 1200);
    }
  }, [stage, inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  const adjustHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  /* ── Render stages ── */

  if (stage.type === "landing") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-50">
        <DemoBanner />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium mb-8" style={{ color: "#64748B" }}>
            <Bot className="h-4 w-4" style={{ color: "#6366F1" }} />
            Live interactive demo
          </div>

          <h1 className="font-extrabold tracking-tight mb-4 max-w-xl" style={{ fontSize: "clamp(30px, 5vw, 48px)", color: "#0F172A" }}>
            Product Manager<br />Problem Solving Interview
          </h1>

          <p className="max-w-md mb-10 leading-relaxed" style={{ fontSize: 17, color: "#64748B" }}>
            Experience a real HireForward interview from the candidate's perspective. The AI will ask you 4 questions, then generate a sample evaluation report.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={startDemo}
              className="inline-flex items-center text-base font-semibold text-white px-8 h-12 rounded-xl hover:opacity-90 transition-opacity"
              style={{ background: "#6366F1" }}
            >
              Start Demo Interview <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <Link href="/sign-up">
              <button className="inline-flex items-center text-base font-medium h-12 px-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors" style={{ color: "#64748B" }}>
                Create your own →
              </button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl w-full text-left">
            {[
              { label: "4 questions", sub: "No account required" },
              { label: "Real AI responses", sub: "Scripted for demo speed" },
              { label: "Sample report", sub: "At the end" },
            ].map(({ label, sub }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-xl px-5 py-4 shadow-sm">
                <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage.type === "generating") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-50">
        <DemoBanner />
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#6366F1" }} />
          <p className="font-semibold text-lg" style={{ color: "#0F172A" }}>Generating evaluation report…</p>
          <p className="text-sm" style={{ color: "#94a3b8" }}>Analyzing your responses against the PM rubric</p>
        </div>
      </div>
    );
  }

  if (stage.type === "report") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-50">
        <DemoBanner />
        <div className="flex-1 py-12 px-6">
          <div className="max-w-2xl mx-auto space-y-6">

            <div className="text-center mb-8">
              <p className="text-sm font-medium mb-2" style={{ color: "#6366F1" }}>Demo Evaluation Complete</p>
              <h2 className="font-extrabold text-3xl mb-2" style={{ color: "#0F172A" }}>Your Sample Report</h2>
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                In a real interview, this report is sent to the HR team automatically.
              </p>
            </div>

            {/* Score card */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="h-2" style={{ background: `linear-gradient(90deg, #6366F1 ${SAMPLE_REPORT.score}%, #e2e8f0 ${SAMPLE_REPORT.score}%)` }} />
              <CardContent className="p-6 flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "#64748B" }}>Overall Score</p>
                  <p className="font-extrabold text-5xl" style={{ color: "#0F172A" }}>{SAMPLE_REPORT.score}<span className="text-2xl text-slate-400">/100</span></p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium mb-1" style={{ color: "#64748B" }}>Recommendation</p>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {SAMPLE_REPORT.recommendation}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="font-semibold mb-2" style={{ color: "#0F172A" }}>Summary</p>
                <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{SAMPLE_REPORT.summary}</p>
              </CardContent>
            </Card>

            {/* Strengths */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="font-semibold mb-3" style={{ color: "#0F172A" }}>Strengths</p>
                <ul className="space-y-2">
                  {SAMPLE_REPORT.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-sm" style={{ color: "#334155" }}>
                      <Star className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Areas for improvement */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <p className="font-semibold mb-3" style={{ color: "#0F172A" }}>Areas for Improvement</p>
                <ul className="space-y-2">
                  {SAMPLE_REPORT.improvements.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-sm" style={{ color: "#334155" }}>
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-8 text-center shadow-sm">
              <p className="font-bold text-xl mb-2" style={{ color: "#0F172A" }}>Ready to run real interviews?</p>
              <p className="text-sm mb-6" style={{ color: "#64748B" }}>Set up your first AI interview in under 10 minutes. No credit card required on Trial.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/sign-up">
                  <button className="inline-flex items-center text-base font-semibold text-white px-8 h-11 rounded-xl hover:opacity-90 transition-opacity" style={{ background: "#6366F1" }}>
                    Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </Link>
                <button
                  onClick={() => setStage({ type: "landing" })}
                  className="inline-flex items-center text-base font-medium h-11 px-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  style={{ color: "#64748B" }}
                >
                  Try again
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  /* ── Active interview ── */
  const { messages, inputLocked } = stage;

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50">
      <DemoBanner />

      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="font-semibold text-foreground text-sm">
          HireForward Demo — Product Manager Interview
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#EEF2FF", color: "#6366F1" }}>
          Demo mode
        </span>
      </header>

      {/* Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 w-full max-w-3xl mx-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-white border text-foreground rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-2 font-medium mb-2 text-sm" style={{ color: "#6366F1" }}>
                  <Bot className="h-4 w-4" />
                  AI Interviewer
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                {msg.content.replace(/\*\*(.*?)\*\*/g, "$1")}
              </div>
            </div>
          </div>
        ))}

        {inputLocked && messages[messages.length - 1].role === "user" && (
          <div className="flex justify-start">
            <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Typing…</span>
            </div>
          </div>
        )}

        <div className="h-4" />
      </main>

      {/* Input */}
      <footer className="bg-white border-t shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="p-3 sm:p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); adjustHeight(e); }}
              onKeyDown={handleKeyDown}
              placeholder="Type your response… (Shift+Enter for new line)"
              className="min-h-[48px] max-h-[150px] resize-none bg-muted/20 border-border focus-visible:ring-primary rounded-xl py-3 px-4"
              disabled={inputLocked}
              rows={1}
            />
            <Button
              size="icon"
              className="h-12 w-12 rounded-xl shrink-0"
              style={{ background: "#6366F1" }}
              onClick={submitAnswer}
              disabled={!inputValue.trim() || inputLocked}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Demo Banner ────────────────────────────────────────────────────────── */

function DemoBanner() {
  return (
    <div
      className="shrink-0 px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
      style={{ background: "#FEF3C7", borderBottom: "1px solid #FDE68A" }}
    >
      <div className="flex items-center gap-2 font-medium" style={{ color: "#92400E" }}>
        <AlertTriangle className="h-4 w-4 shrink-0" />
        This is a demo interview. Responses are not saved or reviewed.
      </div>
      <Link href="/sign-up">
        <button className="text-xs font-semibold hover:underline whitespace-nowrap" style={{ color: "#6366F1" }}>
          Sign up to create your own →
        </button>
      </Link>
    </div>
  );
}
