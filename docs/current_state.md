# 📊 Current State — HireForward (AS-IS)

This document provides a detailed checklist of what is currently implemented in the HireForward codebase and outlines the next logical steps for development.

## ✅ Implemented Features

### Foundation
- [x] **Monorepo Structure**: Workspace organization with `pnpm`.
- [x] **Database Schema**: Full schema in Drizzle covering companies, users, processes, candidates, and AI logs.
- [x] **Authentication**: Clerk integrated for frontend and validated in the backend.
- [x] **AI Core**: Custom integration library for Anthropic (Claude) with SSE streaming support.

### Panel: Admin
- [x] **Company Management**: Basic listing and creation.
- [x] **Token Usage**: Infrastructure to log and view input/output tokens.
- [x] **Logs**: Platform-wide activity logging infrastructure.

### Panel: Company (HR)
- [x] **Job Processes**: CRUD logic for creating and managing job openings.
- [x] **Configurator Agent**: Conversational setup for interview criteria and prompts.
- [x] **Candidate Invitations**: Link generation for candidate interviews.
- [x] **Kanban Pipeline View**: Drag-and-drop board with 5 columns — Invited, In Review, Shortlisted, Approved, Rejected. Powered by `@dnd-kit` with optimistic UI updates. Toggle between Kanban and Table views.
- [x] **Pipeline Badge Column**: Table view includes a colored badge showing each candidate's current pipeline stage.
- [x] **Candidate Report UI**: Full evaluation detail page (`/candidates/:id`) with score ring, radar chart, highlights/red flags, per-criterion breakdown with justifications, response timing heatmap, and collapsible interview transcript.
- [x] **Manager View Share Flow**: "Share Report" button on the candidate detail page generates a unique read-only link (`/report/[token]`) copied to clipboard with a toast. The public report page requires no login, shows the full evaluation (score ring, recommendation badge, radar chart, criteria breakdown, transcript), expires after 30 days, and includes a "Powered by HireForward" growth loop badge.
- [x] **Billing Integration**: Full Stripe billing system — Checkout, Customer Portal, and webhook-driven lifecycle management.
  - **Plans**: Starter ($99/mo, 20 interviews/mo), Growth ($299/mo, 100 interviews/mo), Enterprise (custom, unlimited).
  - **`/settings/billing` page**: Current plan badge, subscription period, usage progress bar (candidates + tokens + AI cost this month), plan selection cards, "Manage Subscription" portal button.
  - **Backend enforcement**: `POST /api/processes/:id/candidates` checks monthly candidate count against plan limit and returns HTTP 402 with `PLAN_LIMIT_REACHED` code if exceeded.
  - **Webhook handler** (`POST /api/stripe/webhook`, registered before `express.json()` for raw Buffer): validates Stripe signature via `stripe-replit-sync`, then dispatches business logic:
    - `checkout.session.completed` → activates subscription, writes `stripe_customer_id`, `stripe_subscription_id`, sets `plan` + `status = active`.
    - `customer.subscription.updated` → syncs plan tier and billing status (active / past_due / suspended / cancelled).
    - `customer.subscription.deleted` → clears subscription ID, downgrades company to `plan = trial`, `status = trial` — caps enforced immediately.
    - `invoice.payment_failed` → sets `status = past_due`, sends payment-failed warning email (via Resend) to HR contact with invoice link and retry instructions.
    - `invoice.payment_succeeded` → restores `status = active` if previously past_due or suspended.
  - **DB**: `companies` table has `stripe_customer_id` and `stripe_subscription_id` TEXT columns (added via SQL migration).
  - **Seeding**: `pnpm --filter @workspace/scripts run seed-products` creates the three Stripe products (idempotent).
  - **Stripe connection**: Code is fully wired. Connect via Integrations tab → Stripe to activate (currently skipped gracefully on startup).

### Panel: Candidate
- [x] **Secure Access**: JWT-based token verification for candidate entry.
- [x] **Interviewer Agent**: Functional streaming chat interface.
- [x] **Interview Lifecycle**: Start, message exchange, and session completion.

### Panel: Evaluation
- [x] **Evaluator Agent**: Post-interview analysis triggering.
- [x] **JSON Extraction**: Logic to convert AI output into structured DB records.
- [x] **Notifications (Evaluation Ready)**: Email via Resend to HR contact when evaluation is ready, including score and recommendation.
- [x] **Notifications (Pipeline Stage Change)**: Email via Resend to HR contact when a candidate is moved to Approved or Rejected, including candidate name, position, AI score, and report link.
- [x] **Automatic Stage Transition**: When a candidate completes the AI interview, their pipeline stage is automatically set to "In Review".

### Launch Readiness Pass (2026-05-03)
- [x] **Plan limits synced across landing page and backend**: Trial=3, Starter=20, Growth=100 candidates/mo — now consistent everywhere.
- [x] **Portuguese strings removed from dashboard**: "Tokens (ano)" → "Tokens (year)", "Custo (ano)" → "Cost (year)", "Acumulado YTD" → "Accumulated YTD".
- [x] **Dead footer links fixed**: Removed non-existent "Privacy Policy" and "Terms of Service" pages (were `href="#"`); replaced with working section anchor links (Pricing, FAQ, Contact).
- [x] **Mobile navigation added to landing page**: Hamburger menu reveals How it Works / Pricing / FAQ anchor links on mobile; collapses on link tap.
- [x] **Report page skeleton fixed**: Loading skeleton `grid-cols-3` was not responsive — fixed to `grid-cols-1 md:grid-cols-3`.
- [x] **CTA audit**: All buttons on landing page, interview page, and report page route correctly. `mailto:sales@hireforward.ai` and `mailto:hello@hireforward.ai` are intentional contact links. No dead routes.
- [x] **Payment issue banner**: Sticky red banner shown at the top of all authenticated Company Panel pages when `company.status` is `past_due` or `suspended`. Content: "Your subscription has a payment issue. Update your payment method to avoid losing access." with a "Fix Now →" button that opens the Stripe Customer Portal (`/api/billing/portal`). Dismissible per session (sessionStorage — reappears on next login). Not shown on `/settings/billing`. Uses the same `billing-status` React Query cache key as the billing page — no extra network requests on subsequent navigations.

---

## 🛠️ Missing Features & Known Gaps

### High Priority (Roadmap for Replit)
- [ ] **Landing Page Expansion**: Pricing table, detailed FAQ, and SEO meta tags (partially added in index.html, but needs content).

### Mid Priority
- [ ] **Multi-language Support**: Expanding beyond English/Portuguese for the AI Interviewer.

### Low Priority
- [ ] **Advanced Security**: Logic to detect and block prompt injection in the candidate chat.
- [ ] **Export Reports**: PDF generation for evaluations.

---

## 🚀 Roadmap (Logical Progression)

1. **Landing Page**: Add a full pricing table matching the 3 Stripe plans so visitors can self-serve.
2. **Token/Cost Dashboard**: Finalize Admin views that show cost-per-candidate for internal monitoring.
3. **Settings**: Allow companies to upload logos and customize the interview language.
4. **Export Reports**: PDF generation of candidate evaluations.

---

*Last Updated: 2026-05-03*
