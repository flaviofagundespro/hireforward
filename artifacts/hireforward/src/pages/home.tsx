import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, X, Menu, Bot, Target, ShieldCheck, Settings2, MessageSquare, LayoutList } from "lucide-react";

/* ─── Scroll-reveal hook ───────────────────────────────────────────────────── */
function useReveal(selector: string) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(selector);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.animationPlayState = "running";
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [selector]);
}

/* ─── Pricing data ─────────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: "Trial",
    planKey: "trial",
    price: "Free",
    period: "",
    badge: null,
    highlight: false,
    features: [
      { label: "1 active process", ok: true },
      { label: "3 candidates / mo", ok: true },
      { label: "500K tokens", ok: true },
      { label: "PDF Export", ok: false },
      { label: "Manager View", ok: false },
      { label: "Custom Branding", ok: false },
    ],
    cta: "Get Started",
    ctaHref: "/sign-up?plan=trial",
    ctaOutline: true,
  },
  {
    name: "Starter",
    planKey: "starter",
    price: "$99",
    period: "/mo",
    badge: null,
    highlight: false,
    features: [
      { label: "3 active processes", ok: true },
      { label: "20 candidates / mo", ok: true },
      { label: "3M tokens", ok: true },
      { label: "PDF Export", ok: true },
      { label: "Manager View", ok: true },
      { label: "Custom Branding", ok: false },
    ],
    cta: "Start Free Trial →",
    ctaHref: "/sign-up?plan=starter",
    ctaOutline: false,
  },
  {
    name: "Growth",
    planKey: "growth",
    price: "$299",
    period: "/mo",
    badge: "Most Popular",
    highlight: true,
    features: [
      { label: "10 active processes", ok: true },
      { label: "100 candidates / mo", ok: true },
      { label: "15M tokens", ok: true },
      { label: "PDF Export", ok: true },
      { label: "Manager View", ok: true },
      { label: "Custom Branding", ok: true },
    ],
    cta: "Start Free Trial →",
    ctaHref: "/sign-up?plan=growth",
    ctaOutline: false,
  },
  {
    name: "Enterprise",
    planKey: "enterprise",
    price: "Custom",
    period: "",
    badge: null,
    highlight: false,
    features: [
      { label: "Unlimited processes", ok: true },
      { label: "Unlimited candidates", ok: true },
      { label: "Unlimited tokens", ok: true },
      { label: "All above features", ok: true },
      { label: "Custom Branding", ok: true },
      { label: "Dedicated SLA & support", ok: true },
    ],
    cta: "Talk to us →",
    ctaHref: "mailto:sales@hireforward.ai",
    ctaOutline: true,
  },
];

/* ─── FAQ data ──────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Can candidates use ChatGPT or any AI tool during the interview?",
    a: "That's the point. HireForward is built for AI-enabled interviews. Candidates can use any tool they want — ChatGPT, Claude, search, their own notes. The evaluator scores how well they think, structure arguments, and leverage resources. That's exactly how they'll work on the job. Blocking tools doesn't make the interview rigorous — it makes it irrelevant.",
  },
  {
    q: "Does it work for non-technical roles like Sales, Marketing, or Finance?",
    a: "Yes. The AI interviewer adapts to any role. You define the criteria — communication clarity, strategic thinking, problem framing, financial reasoning, whatever matters for the position — and the interviewer probes specifically against them. We have active processes running for SDRs, marketing managers, analysts, and operations leads, not just engineers.",
  },
  {
    q: "How is the score calculated? Is it a black box?",
    a: "No. Every score maps to the rubric you define when setting up the process. The evaluator agent scores each criterion individually, writes a specific justification for every point, and flags highlights and red flags backed by direct evidence from the conversation. You can read the full transcript alongside the scores. Nothing is hidden.",
  },
  {
    q: "What happens right after the interview ends?",
    a: "The evaluator agent runs automatically — no manual trigger needed. Within seconds, the full report is ready: overall score, hiring recommendation, criterion-by-criterion breakdown with justifications, and the complete transcript. Your HR contact gets an email notification. The candidate is automatically moved to 'In Review' on the pipeline board.",
  },
  {
    q: "Is candidate and company data secure?",
    a: "Yes. Interview sessions use single-use JWT links — no account creation, no reuse. Company data is strictly tenant-isolated; no HR team can see another company's candidates or processes. We do not train AI models on your data. Transcripts and evaluations are only accessible to authenticated users within your organization.",
  },
  {
    q: "Can I see a sample evaluation report before signing up?",
    a: "The fastest way is to just try it. Sign up for the free Trial plan — no credit card needed. Set up a process, run one interview, and you'll see a real evaluation report in under 10 minutes. If it doesn't impress you, you've lost nothing.",
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6 md:px-16" style={{ background: "#F8F9FB" }}>
      <div style={{ maxWidth: 760 }} className="mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-extrabold tracking-tight mb-3" style={{ fontSize: "clamp(32px, 4vw, 48px)", color: "#0F172A" }}>
            Frequently asked questions
          </h2>
          <p style={{ fontSize: 17, color: "#64748B" }}>
            The things people ask us most before they try it.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between gap-6 px-7 py-5 text-left transition-colors hover:bg-slate-50/70"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-base leading-snug" style={{ color: "#0F172A" }}>
                    {faq.q}
                  </span>
                  <span
                    className="shrink-0 flex items-center justify-center rounded-full border border-slate-200 transition-transform duration-200"
                    style={{
                      width: 28,
                      height: 28,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      color: "#64748B",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>

                <div
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.28s cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  <p className="px-7 pb-6 pt-1 text-sm leading-relaxed" style={{ color: "#64748B", lineHeight: 1.75 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useReveal(".reveal-card");

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-animate { animation: fadeInUp 0.7s cubic-bezier(.22,1,.36,1) both; }
        .hero-d1 { animation-delay: 0.05s; }
        .hero-d2 { animation-delay: 0.18s; }
        .hero-d3 { animation-delay: 0.30s; }
        .hero-d4 { animation-delay: 0.44s; }

        @keyframes revealUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reveal-card {
          opacity: 0;
          animation: revealUp 0.6s cubic-bezier(.22,1,.36,1) both;
          animation-play-state: paused;
        }
        .reveal-card:nth-child(1) { animation-delay: 0.00s; }
        .reveal-card:nth-child(2) { animation-delay: 0.10s; }
        .reveal-card:nth-child(3) { animation-delay: 0.20s; }
        .reveal-card:nth-child(4) { animation-delay: 0.30s; }

        .nav-link { color: #64748B; transition: color 0.15s; }
        .nav-link:hover { color: #0F172A; }
      `}</style>

      <div className="min-h-[100dvh] flex flex-col" style={{ background: "#F8F9FB" }}>

        {/* ── Section 1: Nav ─────────────────────────────────────────────────── */}
        <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="h-16 flex items-center justify-between px-6 md:px-16">
            <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight" style={{ color: "#0F172A" }}>
              <img src={`${basePath}/logo.svg`} alt="HireForward" className="h-7 w-7" />
              HireForward
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="nav-link text-sm font-medium">How it Works</a>
              <a href="#pricing" className="nav-link text-sm font-medium">Pricing</a>
              <a href="#faq" className="nav-link text-sm font-medium">FAQ</a>
            </nav>
            <div className="flex items-center gap-3 md:gap-5">
              <Link href="/sign-in" className="nav-link text-sm font-medium hidden sm:block">Log in</Link>
              <Link href="/sign-up">
                <button className="text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ background: "#1E2D5E" }}>
                  Get Started
                </button>
              </Link>
              <button
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen
                  ? <X className="h-5 w-5" style={{ color: "#0F172A" }} />
                  : <Menu className="h-5 w-5" style={{ color: "#0F172A" }} />}
              </button>
            </div>
          </div>
          {/* Mobile nav drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-1">
              <a href="#how-it-works" className="nav-link text-sm font-medium py-2.5 border-b border-slate-50" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <a href="#pricing" className="nav-link text-sm font-medium py-2.5 border-b border-slate-50" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="nav-link text-sm font-medium py-2.5 border-b border-slate-50" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <Link href="/sign-in" className="nav-link text-sm font-medium py-2.5 sm:hidden" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            </div>
          )}
        </header>

        {/* ── Section 2: Hero ────────────────────────────────────────────────── */}
        <main className="flex flex-col items-center justify-center px-6 md:px-16 pt-24 pb-20 text-center bg-white">
          <div className="hero-animate hero-d1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium mb-10" style={{ color: "#64748B" }}>
            <span className="text-amber-500">✦</span>
            The hiring standard for 2026
          </div>

          <h1 className="hero-animate hero-d2 font-extrabold tracking-tight leading-[1.05] mb-7 max-w-4xl" style={{ fontSize: "clamp(42px, 7vw, 72px)", color: "#0F172A" }}>
            Stop hiring the professional<br className="hidden md:block" /> of 2015.
          </h1>

          <p className="hero-animate hero-d3 max-w-2xl mb-6 leading-relaxed" style={{ fontSize: "clamp(18px, 2.5vw, 22px)", fontWeight: 400, color: "#64748B", lineHeight: 1.6 }}>
            Most interviews still block AI and test memorization.<br className="hidden md:block" />
            But your best candidates use Claude, ChatGPT, and search every single day —<br className="hidden md:block" />
            and that's exactly why they're your best candidates.
          </p>

          <p className="hero-animate hero-d3 max-w-xl mb-10" style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7 }}>
            HireForward runs AI-conducted interviews where candidates can use any tool they want.
            An AI agent evaluates how they think, how they solve problems, and how they use resources —
            the skills that actually matter on the job.
          </p>

          <div className="hero-animate hero-d4 flex flex-col sm:flex-row items-center gap-3">
            <Link href="/sign-up">
              <button className="inline-flex items-center text-base font-semibold text-white px-8 h-12 rounded-xl hover:opacity-90 transition-opacity" style={{ background: "#1E2D5E" }}>
                Start Hiring <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </Link>
            <Link href="/demo" target="_blank" rel="noopener noreferrer">
              <button className="inline-flex items-center text-base font-semibold h-12 px-8 rounded-xl border-2 hover:opacity-90 transition-opacity" style={{ borderColor: "#6366F1", color: "#6366F1", background: "transparent" }}>
                Try a Live Demo →
              </button>
            </Link>
          </div>
        </main>

        {/* ── Section 3: Social Proof Bar ────────────────────────────────────── */}
        <div className="border-y border-slate-100 py-5 px-6 text-center" style={{ background: "#F8F9FB" }}>
          <p className="text-sm font-medium tracking-wide" style={{ color: "#94a3b8" }}>
            Built for teams hiring across{" "}
            {["Engineering", "Sales", "Marketing", "Finance"].map((t, i, a) => (
              <span key={t}><span style={{ color: "#64748B" }}>{t}</span>{i < a.length - 1 ? ", " : ""}</span>
            ))}{" "}and more.
          </p>
        </div>

        {/* ── Section 4: How It Works ────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-6 md:px-16 bg-white">
          <div style={{ maxWidth: 1100 }} className="mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-extrabold tracking-tight" style={{ fontSize: "clamp(32px, 4vw, 48px)", color: "#0F172A" }}>
                Three steps. Zero subjectivity.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { n: "01", Icon: Settings2, title: "Configure your interviewer in minutes", body: "Tell the AI what role you're hiring for. It builds the interview rubric, evaluation criteria, and interviewer personality automatically." },
                { n: "02", Icon: MessageSquare, title: "Candidates interview on their own time — tools allowed", body: "They get a private link. No account needed. They can use any AI, browser, or tool. The agent interviews them conversationally." },
                { n: "03", Icon: LayoutList, title: "AI evaluates every answer against your criteria", body: "You get a score breakdown, highlights, red flags, and a full transcript — ready in seconds after the interview ends." },
              ].map(({ n, Icon, title, body }) => (
                <div key={n} className="reveal-card flex flex-col gap-5 rounded-2xl border border-slate-100 p-8 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-black select-none" style={{ color: "#e2e8f0", lineHeight: 1 }}>{n}</span>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0F172A" }}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: "#0F172A" }}>{title}</h3>
                    <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Paradigm Shift ──────────────────────────────────────── */}
        <section className="py-24 px-6 md:px-16 text-center" style={{ background: "#0F172A" }}>
          <div className="mx-auto max-w-3xl">
            <blockquote className="font-extrabold text-white leading-tight tracking-tight mb-8" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
              "Blocking AI in interviews isn't rigorous.<br className="hidden md:block" />
              It's just irrelevant."
            </blockquote>
            <p style={{ color: "#94a3b8", fontSize: 18, lineHeight: 1.7 }}>
              The top candidates in 2026 will use AI every day on the job.<br className="hidden md:block" />
              HireForward evaluates them the way they'll actually work —<br className="hidden md:block" />
              and surfaces who truly solves problems at the highest level.
            </p>
          </div>
        </section>

        {/* ── Section 6: Feature Cards ───────────────────────────────────────── */}
        <section className="py-24 px-6 md:px-16" style={{ background: "#F8F9FB" }}>
          <div style={{ maxWidth: 1100 }} className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { Icon: Bot, title: "AI-Conducted Interviews", body: "Your AI interviewer adapts to every answer in real time. It asks follow-up questions, probes deeper, and never lets a vague answer slide. Like your best interviewer — available 24/7." },
              { Icon: Target, title: "Rubric-Based Scoring", body: "Every candidate is evaluated against the same criteria you define. No gut feelings. No interviewer bias. Just structured scores with specific evidence from the conversation." },
              { Icon: ShieldCheck, title: "Full Transparency", body: "See the complete transcript, score breakdown by criterion, positive highlights, and red flags for every candidate. Share a read-only report with the hiring manager in one click." },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="reveal-card flex flex-col gap-4 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-2" style={{ background: "#1E2D5E" }}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: "#0F172A" }}>{title}</h3>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 7: Pricing ─────────────────────────────────────────────── */}
        <section id="pricing" className="py-24 px-6 md:px-16 bg-white">
          <div style={{ maxWidth: 1100 }} className="mx-auto">
            <div className="text-center mb-4">
              <h2 className="font-extrabold tracking-tight" style={{ fontSize: "clamp(32px, 4vw, 48px)", color: "#0F172A" }}>
                Simple, transparent pricing
              </h2>
            </div>
            <p className="text-center mb-14" style={{ fontSize: 18, color: "#64748B" }}>
              Start free. Scale when you're ready.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="reveal-card relative flex flex-col rounded-2xl border p-7"
                  style={{
                    background: plan.highlight ? "#1E2D5E" : "#fff",
                    borderColor: plan.highlight ? "#1E2D5E" : "#e2e8f0",
                    boxShadow: plan.highlight ? "0 8px 32px rgba(30,45,94,.25)" : "0 1px 4px rgba(0,0,0,.04)",
                  }}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-xs font-bold text-white px-3 py-1 rounded-full" style={{ background: "#6366F1" }}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Plan name */}
                  <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: plan.highlight ? "#93c5fd" : "#94a3b8" }}>
                    {plan.name}
                  </p>

                  {/* Price */}
                  <div className="flex items-end gap-1 mb-6">
                    <span className="font-extrabold leading-none" style={{ fontSize: 40, color: plan.highlight ? "#fff" : "#0F172A" }}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="mb-1.5 text-sm" style={{ color: plan.highlight ? "#93c5fd" : "#94a3b8" }}>{plan.period}</span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center gap-2.5 text-sm" style={{ color: plan.highlight ? (f.ok ? "#e0f2fe" : "#475569") : (f.ok ? "#1e293b" : "#94a3b8") }}>
                        {f.ok
                          ? <Check className="h-4 w-4 flex-shrink-0" style={{ color: plan.highlight ? "#34d399" : "#10b981" }} />
                          : <X className="h-4 w-4 flex-shrink-0" style={{ color: plan.highlight ? "#475569" : "#cbd5e1" }} />
                        }
                        {f.label}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {plan.ctaHref.startsWith("mailto:") ? (
                    <a href={plan.ctaHref}>
                      <button
                        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                        style={
                          plan.highlight
                            ? { background: "#fff", color: "#1E2D5E" }
                            : plan.ctaOutline
                            ? { background: "transparent", color: "#1E2D5E", border: "1.5px solid #1E2D5E" }
                            : { background: "#1E2D5E", color: "#fff" }
                        }
                      >
                        {plan.cta}
                      </button>
                    </a>
                  ) : (
                    <Link href={plan.ctaHref}>
                      <button
                        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                        style={
                          plan.highlight
                            ? { background: "#fff", color: "#1E2D5E" }
                            : plan.ctaOutline
                            ? { background: "transparent", color: "#1E2D5E", border: "1.5px solid #1E2D5E" }
                            : { background: "#1E2D5E", color: "#fff" }
                        }
                      >
                        {plan.cta}
                      </button>
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <p className="text-center mt-8 text-sm" style={{ color: "#94a3b8" }}>
              All paid plans start with a 14-day free trial. No credit card required.
            </p>
          </div>
        </section>

        {/* ── Section 8: FAQ ─────────────────────────────────────────────────── */}
        <FaqSection />

        {/* ── Section 9: Final CTA ───────────────────────────────────────────── */}
        <section className="py-24 px-6 md:px-16 text-center" style={{ background: "#0F172A" }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="font-extrabold text-white mb-4 tracking-tight" style={{ fontSize: "clamp(30px, 4vw, 48px)" }}>
              Your next great hire is waiting.
            </h2>
            <p className="mb-10" style={{ fontSize: 18, color: "#94a3b8" }}>
              Set up your first AI interview in under 10 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <button className="inline-flex items-center text-base font-semibold text-white px-8 h-12 rounded-xl hover:opacity-90 transition-opacity" style={{ background: "#6366F1" }}>
                  Start for Free <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </Link>
              <a href="mailto:sales@hireforward.ai" className="text-sm font-medium underline underline-offset-4 hover:opacity-80 transition-opacity" style={{ color: "#64748B" }}>
                Book a demo instead
              </a>
            </div>
          </div>
        </section>

        {/* ── Section 9: Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-slate-100 px-6 md:px-16 py-8" style={{ background: "#F8F9FB" }}>
          <div style={{ maxWidth: 1100 }} className="mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left */}
            <div className="flex items-center gap-2.5 text-sm" style={{ color: "#64748B" }}>
              <img src={`${basePath}/logo.svg`} alt="HireForward" className="h-5 w-5 opacity-60" />
              <span className="font-semibold" style={{ color: "#0F172A" }}>HireForward</span>
              <span>·</span>
              <span>© {new Date().getFullYear()} HireForward. All rights reserved.</span>
            </div>

            {/* Center */}
            <div className="flex items-center gap-6 text-sm" style={{ color: "#94a3b8" }}>
              <a href="#pricing" className="hover:text-slate-600 transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-slate-600 transition-colors">FAQ</a>
              <a href="mailto:hello@hireforward.ai" className="hover:text-slate-600 transition-colors">Contact</a>
              <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
            </div>

            {/* Right */}
            <p className="text-sm hidden md:block" style={{ color: "#94a3b8" }}>
              Built for the hiring teams of 2026.
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}
