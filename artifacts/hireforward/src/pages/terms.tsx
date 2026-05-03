import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Terms() {
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
            Terms of Service
          </h1>
          <p className="mb-12" style={{ color: "#64748B" }}>
            Last updated: May 3, 2026 &nbsp;·&nbsp; Effective immediately
          </p>

          <div className="prose max-w-none space-y-10 text-base leading-relaxed" style={{ color: "#334155" }}>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>1. Acceptance of Terms</h2>
              <p>
                By creating an account, accessing, or using HireForward (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of a company or other legal entity ("Company"), you represent that you have the authority to bind that entity to these Terms. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>2. Description of Service</h2>
              <p>
                HireForward provides an AI-powered recruitment platform that enables companies to configure and deploy AI-conducted interviews for job candidates, generate automated evaluation reports, and manage candidate pipelines. The Service is provided on a subscription basis with tiers as described on our pricing page.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>3. Accounts and Access</h2>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>You must provide accurate, current, and complete registration information.</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                <li>You are responsible for all activity that occurs under your account.</li>
                <li>You must notify us immediately of any unauthorized use at <a href="mailto:hello@hireforward.ai" className="underline" style={{ color: "#6366F1" }}>hello@hireforward.ai</a>.</li>
                <li>You must be at least 18 years old or the legal age of majority in your jurisdiction to create an account.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>4. Subscription Plans and Billing</h2>
              <p className="mb-3">
                HireForward offers the following plans: Trial (free), Starter, Growth, and Enterprise. Paid plans are billed on a monthly or annual basis as chosen at checkout.
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Subscriptions automatically renew unless cancelled before the renewal date.</li>
                <li>You may cancel your subscription at any time from the Billing settings page. Access continues until the end of the current billing period.</li>
                <li>We do not offer refunds for partial billing periods, except where required by law.</li>
                <li>We reserve the right to change pricing with 30 days' notice to active subscribers.</li>
                <li>Failed payments may result in service suspension. You will be notified and given a grace period to update your payment method.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>5. Acceptable Use</h2>
              <p className="mb-3">You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Discriminate against candidates on the basis of race, gender, age, religion, nationality, disability, sexual orientation, or any other protected characteristic.</li>
                <li>Use AI evaluation results as the sole, automated basis for rejection without any human review where required by law.</li>
                <li>Conduct interviews for roles that are not genuine job openings.</li>
                <li>Harvest or scrape candidate data for purposes other than the stated recruitment process.</li>
                <li>Reverse engineer, decompile, or attempt to access the source code of the Service.</li>
                <li>Use the Service in violation of any applicable employment, privacy, or data protection law.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>6. AI-Generated Content and Limitations</h2>
              <p className="mb-3">
                HireForward uses artificial intelligence to conduct interviews and generate evaluation reports. You acknowledge and agree that:
              </p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>AI-generated evaluations are provided as a decision-support tool, not as definitive assessments of candidate suitability.</li>
                <li>Final hiring decisions must always involve human judgment and remain the sole responsibility of the Client.</li>
                <li>HireForward does not guarantee the accuracy, completeness, or bias-free nature of AI evaluations.</li>
                <li>You are responsible for ensuring your use of AI evaluations complies with applicable employment and anti-discrimination laws in your jurisdiction, including any requirements for human oversight of automated decision-making (e.g., under the EU AI Act or similar regulations).</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>7. Candidate Data and Consent</h2>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>You are responsible for obtaining any necessary consent from candidates before inviting them to complete an AI interview on HireForward.</li>
                <li>You must inform candidates that the interview is conducted by an AI system and that their responses will be evaluated automatically.</li>
                <li>You must not invite candidates without their knowledge or consent.</li>
                <li>HireForward acts as a data processor for candidate data on your behalf. Our data processing practices are described in the Privacy Policy.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>8. Intellectual Property</h2>
              <p className="mb-3">
                All rights in the HireForward platform, including the software, design, branding, and documentation, are owned by HireForward and protected by applicable intellectual property laws.
              </p>
              <p>
                You retain ownership of any content you provide to the Service (job descriptions, evaluation criteria, etc.). You grant HireForward a limited license to use that content solely to operate the Service. We do not claim any rights over candidate interview transcripts or company-specific data.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>9. Confidentiality</h2>
              <p>
                Each party agrees to keep confidential any non-public information received from the other party in connection with the Service and to use it only for the purposes of these Terms. This obligation survives termination of your account.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>10. Service Availability and Modifications</h2>
              <p>
                We strive for high availability but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service or any feature at any time with reasonable notice. We are not liable for any downtime, data loss, or disruption unless caused by our gross negligence.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, HireForward's total liability to you for any claim arising from or related to the Service shall not exceed the amounts paid by you in the 12 months preceding the claim. HireForward shall not be liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, loss of data, or reputational harm.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless HireForward and its officers, employees, and agents from any claims, liabilities, damages, and expenses (including legal fees) arising out of your use of the Service, your violation of these Terms, or your violation of any applicable law or third-party rights.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>13. Termination</h2>
              <p>
                Either party may terminate these Terms at any time. We may suspend or terminate your account immediately if you violate these Terms, fail to pay applicable fees, or if we are required to do so by law. Upon termination, your right to access the Service ends and we will delete your data in accordance with our data retention policy as described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>14. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the jurisdiction in which HireForward operates. Any disputes arising under these Terms shall be resolved through good-faith negotiation first, and thereafter through binding arbitration or the courts of competent jurisdiction, as mutually agreed.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-xl mb-3" style={{ color: "#0F172A" }}>15. Contact</h2>
              <p>
                Questions about these Terms? Contact us at:{" "}
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
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-600 transition-colors underline">Terms of Service</Link>
            <a href="mailto:hello@hireforward.ai" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
