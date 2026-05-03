import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "#F8F9FB" }}>
      {/* Nav */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-16 flex items-center justify-between px-6 md:px-16">
          <Link href="/">
            <div className="flex items-center gap-2.5 font-bold text-xl tracking-tight cursor-pointer" style={{ color: "#0F172A" }}>
              <img src={`${basePath}/logo.svg`} alt="HireForward" className="h-7 w-7" />
              HireForward
            </div>
          </Link>
          <Link href="/sign-up">
            <button className="text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ background: "#1E2D5E" }}>
              Get Started
            </button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-medium mb-3" style={{ color: "#6366F1" }}>Legal</p>
          <h1 className="font-extrabold tracking-tight mb-2" style={{ fontSize: "clamp(32px, 5vw, 48px)", color: "#0F172A" }}>
            Privacy Policy
          </h1>
          <p className="mb-12" style={{ color: "#64748B" }}>
            Last updated: May 3, 2026 &nbsp;·&nbsp; Effective immediately
          </p>

          <div className="prose max-w-none space-y-10 text-base leading-relaxed" style={{ color: "#334155" }}>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>1. Who We Are</h2>
              <p>
                HireForward ("we", "us", or "our") is a recruitment technology platform that provides AI-conducted interviews and candidate evaluation services to companies ("Clients"). Our platform is operated by HireForward and can be contacted at{" "}
                <a href="mailto:hello@hireforward.ai" className="underline" style={{ color: "#6366F1" }}>hello@hireforward.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>2. Data We Collect</h2>
              <p className="mb-4">We collect different categories of data depending on your role:</p>

              <h3 className="font-semibold text-base mb-2" style={{ color: "#0F172A" }}>2.1 Client Companies (HR Teams)</h3>
              <ul className="list-disc pl-6 space-y-1.5 mb-4">
                <li>Account and contact information (name, work email, company name)</li>
                <li>Billing and subscription information (processed by Stripe; we do not store card numbers)</li>
                <li>Platform usage data (interview processes created, candidates invited, usage metrics)</li>
                <li>Authentication data (managed by Clerk; we store only a reference to your Clerk user ID)</li>
              </ul>

              <h3 className="font-semibold text-base mb-2" style={{ color: "#0F172A" }}>2.2 Candidates</h3>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Name and email address (provided by the hiring company when inviting a candidate)</li>
                <li>Interview responses: the full text transcript of the AI-conducted interview</li>
                <li>Evaluation data: AI-generated scores, notes, strengths, red flags, and recommendations</li>
                <li>Metadata: timestamps, browser type, interview duration</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>3. How We Process Interview Transcripts and AI Evaluations</h2>
              <p className="mb-4">
                HireForward uses large language models (LLMs) to conduct interviews and evaluate candidate responses. When a candidate submits a response:
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>The response is sent to our AI provider (Anthropic Claude) via a secure API call for processing.</li>
                <li>The AI generates a follow-up question or, at the end of the interview, an evaluation report.</li>
                <li>Transcripts and evaluations are stored in our database, encrypted at rest, and are accessible only to the hiring company that invited the candidate.</li>
                <li>We do not use candidate responses to train our own models or share them with other clients.</li>
                <li>AI evaluations are intended to assist — not replace — human judgment. Hiring decisions remain the sole responsibility of the Client.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>4. Tenant Isolation</h2>
              <p>
                Each client company operates in a fully isolated data context. Candidate data, interview transcripts, evaluation reports, and configuration are scoped to a single company and are never accessible to other companies on the platform. Our database schema enforces company-level row-level filtering on all data queries.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>5. Legal Bases for Processing</h2>
              <p className="mb-3">
                We process personal data under the following legal bases:
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li><strong>Contract performance</strong> — to provide the agreed platform services to Client companies.</li>
                <li><strong>Legitimate interests</strong> — to improve platform reliability, detect fraud, and ensure security.</li>
                <li><strong>Consent</strong> — candidates are informed via the interview invitation that their responses will be evaluated by an AI system.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>6. GDPR — Rights of EU/EEA Data Subjects</h2>
              <p className="mb-3">
                If you are located in the European Union or European Economic Area, you have the following rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li><strong>Right to access</strong> — request a copy of your personal data we hold.</li>
                <li><strong>Right to rectification</strong> — request correction of inaccurate data.</li>
                <li><strong>Right to erasure</strong> — request deletion of your data where there is no overriding legal basis to retain it.</li>
                <li><strong>Right to restriction</strong> — request that we limit how we use your data while a dispute is resolved.</li>
                <li><strong>Right to portability</strong> — receive your data in a structured, machine-readable format.</li>
                <li><strong>Right to object</strong> — object to processing based on legitimate interests.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:hello@hireforward.ai" className="underline" style={{ color: "#6366F1" }}>hello@hireforward.ai</a>. We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>7. LGPD — Direitos dos Titulares de Dados no Brasil</h2>
              <p className="mb-3">
                Se você está localizado no Brasil, a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018) garante os seguintes direitos:
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Confirmação da existência de tratamento de dados pessoais.</li>
                <li>Acesso aos seus dados pessoais.</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
                <li>Portabilidade dos dados a outro fornecedor de serviço ou produto.</li>
                <li>Revogação do consentimento, a qualquer momento.</li>
              </ul>
              <p className="mt-3">
                Para exercer seus direitos, entre em contato pelo e-mail{" "}
                <a href="mailto:hello@hireforward.ai" className="underline" style={{ color: "#6366F1" }}>hello@hireforward.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>8. Data Retention</h2>
              <ul className="list-disc pl-6 space-y-1.5">
                <li><strong>Active accounts:</strong> Data is retained for the duration of the client's subscription plus 90 days after cancellation.</li>
                <li><strong>Candidate data:</strong> Retained for 24 months from the date of the interview, unless the Client requests earlier deletion.</li>
                <li><strong>Billing records:</strong> Retained for 7 years as required by applicable accounting laws.</li>
                <li><strong>Deleted accounts:</strong> Personal data is permanently deleted within 30 days of an account deletion request.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>9. Data Security</h2>
              <p>
                We implement industry-standard technical and organizational security measures including TLS encryption in transit, AES-256 encryption at rest, role-based access controls, and regular security reviews. Our infrastructure is hosted on Replit's managed cloud environment.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>10. Third-Party Processors</h2>
              <p className="mb-3">We use the following sub-processors:</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li><strong>Clerk</strong> — identity and authentication management</li>
                <li><strong>Stripe</strong> — payment processing and subscription management</li>
                <li><strong>Anthropic</strong> — AI interview and evaluation processing</li>
                <li><strong>Resend</strong> — transactional email delivery</li>
                <li><strong>Replit</strong> — cloud infrastructure and database hosting</li>
              </ul>
              <p className="mt-3">All processors are bound by data processing agreements and comply with applicable privacy regulations.</p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>11. Cookies</h2>
              <p>
                HireForward uses only strictly necessary cookies for authentication session management. We do not use advertising or tracking cookies. No third-party analytics scripts are loaded on the platform.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. If we make material changes, we will notify Client administrators via email at least 14 days before the changes take effect. Continued use of the platform after that date constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>13. Contact</h2>
              <p>
                For any privacy-related questions, data subject requests, or complaints, contact us at:<br />
                <a href="mailto:hello@hireforward.ai" className="underline font-medium" style={{ color: "#6366F1" }}>hello@hireforward.ai</a>
              </p>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 md:px-16 py-8" style={{ background: "#F8F9FB" }}>
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm" style={{ color: "#94a3b8" }}>© {new Date().getFullYear()} HireForward. All rights reserved.</span>
          <div className="flex items-center gap-6 text-sm" style={{ color: "#94a3b8" }}>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
            <a href="mailto:hello@hireforward.ai" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
