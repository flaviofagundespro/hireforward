# HireForward — Product State (2026-05-03)

> A new developer should be able to read this document and understand the full product in 5 minutes.

---

## What Is HireForward?

HireForward is a **B2B AI-native recruitment SaaS**. HR teams create job interview processes, invite candidates via a unique link, and an AI agent conducts the interview conversationally. After the interview ends, a second AI agent evaluates every response and produces a structured report with scores, strengths, red flags, and a hire/no-hire recommendation. HR teams manage candidates through a Kanban pipeline.

The core value prop: candidates can use any AI tool they want during the interview. HireForward evaluates *how they think and use resources*, not whether they memorized answers.

---

## Architecture

```
artifacts/
  hireforward/         React + Vite frontend (Wouter routing, TanStack Query, Clerk auth)
  api-server/          Express 5 backend (Drizzle ORM, PostgreSQL, Anthropic SSE streaming)
  mockup-sandbox/      Vite preview server for canvas component prototyping (dev only)
lib/
  db/                  Drizzle schema + migrations shared between backend packages
  api-spec/            OpenAPI contract + codegen (Orval → React Query hooks + Zod schemas)
  api-client-react/    Generated typed API client used by the frontend
  email/               Resend email builder (evaluation ready + pipeline stage + payment failed)
scripts/
  seed-products        Creates Stripe products/prices in Stripe (idempotent, run once)
docs/
  current_state.md     This file
```

**Routing proxy**: A global reverse proxy routes all traffic through port 80. `/api` → api-server, `/` → hireforward frontend. Services must handle their full base path.

**Database**: Replit-managed PostgreSQL. Drizzle ORM with schema defined in `lib/db`. The `stripe.*` schema (read-only mirror) is written by `stripe-replit-sync`.

---

## Authentication & Multi-tenancy

- **HR users**: Clerk (email + Google SSO). On first sign-in, a webhook creates a `companies` row and `users` row scoped to that company.
- **Candidates**: JWT tokens embedded in interview invite links (`/i/:token`). No account required.
- **Admin**: Separate route (`/admin`) with hardcoded credentials (`admin@hireforward.ai` / `hireforward2026`). Supports impersonation of any company account via session storage.
- **Tenant isolation**: Every DB query filters by `company_id`. No cross-tenant data leakage is possible at the query layer.

---

## URL Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Public | Landing page (redirects signed-in users to `/dashboard`) |
| `/demo` | Public | Live demo interview — no login, no backend, fully scripted |
| `/privacy` | Public | Privacy Policy (GDPR + LGPD compliant) |
| `/terms` | Public | Terms of Service |
| `/sign-in`, `/sign-up` | Public | Clerk auth pages |
| `/i/:token` | Candidate (JWT) | AI interview chat interface |
| `/report/:token` | Public | Shared read-only evaluation report (30-day expiry) |
| `/manager/:token` | Token-gated | Manager view of a candidate report |
| `/dashboard` | HR (Clerk) | Summary metrics, weekly activity, recent candidates |
| `/processes` | HR (Clerk) | List of active job processes |
| `/processes/new` | HR (Clerk) | Conversational process configurator (AI agent) |
| `/processes/:id` | HR (Clerk) | Process detail with Kanban/Table candidate pipeline |
| `/processes/:id/candidates` | HR (Clerk) | Full candidate list for a process |
| `/candidates/:id` | HR (Clerk) | Full candidate evaluation detail page |
| `/settings` | HR (Clerk) | Company settings (name, logo URL, HR email, tools allowed) |
| `/settings/billing` | HR (Clerk) | Subscription management, usage, plan upgrade |
| `/admin` | Admin | Platform overview, company list, platform config |
| `/admin/companies/:id` | Admin | Company detail, impersonate button |

---

## Key Backend Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/status` | Clerk | Returns plan, status, candidateLimit, usage this month |
| POST | `/api/billing/checkout` | Clerk | Creates Stripe Checkout session |
| POST | `/api/billing/portal` | Clerk | Creates Stripe Customer Portal session |
| POST | `/api/stripe/webhook` | Stripe sig | Handles all 5 Stripe lifecycle events |
| GET | `/api/interview/:token` | JWT | Returns interview metadata for candidate |
| POST | `/api/interview/:token/start` | JWT | Starts interview session |
| POST | `/api/interview/:token/message` | JWT | Streams AI response via SSE |
| POST | `/api/interview/:token/end` | JWT | Ends interview, triggers evaluation agent |
| GET | `/api/processes` | Clerk | List company processes |
| POST | `/api/processes` | Clerk | Create new process (after AI configurator) |
| POST | `/api/processes/:id/candidates` | Clerk | Invite candidate — enforces plan quota (HTTP 402 if exceeded) |
| GET | `/api/candidates/:id` | Clerk | Full candidate detail + evaluation |
| PATCH | `/api/candidates/:id/stage` | Clerk | Move candidate to pipeline stage, triggers email |
| GET | `/api/report/:token` | Public | Shared report (validates 30-day expiry) |
| GET | `/api/dashboard/summary` | Clerk | Top-level KPIs |
| GET | `/api/dashboard/usage` | Clerk | Token + cost usage charts |
| GET | `/api/settings` | Clerk | Company settings |
| PATCH | `/api/settings` | Clerk | Update company settings |

---

## Plan Limits & Billing

| Plan | Price | Candidates/mo | Processes | Tokens |
|------|-------|---------------|-----------|--------|
| Trial | Free | 3 | 1 | 500K |
| Starter | $99/mo | 20 | 3 | 3M |
| Growth | $299/mo | 100 | 10 | 15M |
| Enterprise | Custom | Unlimited | Unlimited | Custom |

**Enforcement**: `PLAN_LIMITS` constant in `artifacts/api-server/src/routes/billing/index.ts`. Candidate invite endpoint counts candidates created this calendar month and returns HTTP 402 (`PLAN_LIMIT_REACHED`) if the limit is hit.

**Stripe webhooks** (`POST /api/stripe/webhook`, registered before `express.json()` for raw buffer):
- `checkout.session.completed` → activates plan, writes `stripe_customer_id` + `stripe_subscription_id`
- `customer.subscription.updated` → syncs plan tier and status
- `customer.subscription.deleted` → downgrades to trial immediately
- `invoice.payment_failed` → sets `status = past_due`, sends payment-failed email via Resend
- `invoice.payment_succeeded` → restores `status = active`

**To activate Stripe**: Connect via Integrations tab → Stripe (OAuth), then run `pnpm --filter @workspace/scripts run seed-products` once to create the products.

---

## Email Notifications (via Resend)

| Trigger | Recipient | Content |
|---------|-----------|---------|
| Evaluation ready | HR contact email | Candidate name, score, recommendation, report link |
| Pipeline → Approved | HR contact email | Candidate name, position, score, report link |
| Pipeline → Rejected | HR contact email | Candidate name, position, score |
| `invoice.payment_failed` | HR contact email | Payment failure notice, invoice link, retry instructions |

Email builder lives in `lib/email/src/index.ts`.

---

## Frontend Components & UI Highlights

- **Kanban pipeline**: `@dnd-kit` drag-and-drop with 5 columns (Invited → In Review → Shortlisted → Approved → Rejected). Optimistic UI updates. Toggle between Kanban and Table views.
- **Candidate report**: Score ring (SVG), radar chart (Recharts), per-criterion breakdown with justifications, response timing heatmap, collapsible transcript.
- **Shared report** (`/report/:token`): Fully public, no login. Shows score, recommendation badge, radar chart, criteria, transcript. Expires 30 days after creation. "Powered by HireForward" growth loop badge.
- **Manager view** (`/manager/:token`): Token-gated read-only report for external stakeholders.
- **Live demo** (`/demo`): Fully self-contained scripted PM interview. No backend calls. Character-by-character typing effect. Ends with a sample evaluation report (78/100, Shortlist recommendation). Converts with "Create Free Account" CTA.

---

## In-App Banners (Company Panel)

Three stacked banners appear at the top of all authenticated Company Panel pages. Each is session-dismissible (sessionStorage, reappears on next login). Both billing banners share a single `GET /api/billing/status` React Query fetch (5-min cache).

| Banner | Color | Trigger | CTA |
|--------|-------|---------|-----|
| Admin impersonation | Orange | `sessionStorage.hf_imp` present | Exit impersonation |
| Payment issue | Red gradient | `status === past_due \| suspended` | Fix Now → (Stripe Portal) |
| Quota warning | Amber/yellow | usage ≥ 80% of limit AND plan ≠ enterprise | Upgrade Plan → `/settings/billing#pricing` |

Payment banner takes priority — quota banner is suppressed when a payment issue is active.

---

## SEO & Social

- `index.html`: canonical URL set to `https://hireforward.ai/`, `og:url`, `og:image` (absolute URL to `https://hireforward.ai/og-image.png`, 1200×630), `og:image:width/height`, `og:site_name`, `twitter:card: summary_large_image`, `twitter:site`.
- `og-image.png`: AI-generated dark navy social card (1200×630) with HireForward branding and tagline "Stop hiring the professional of 2015."
- `/privacy`: Privacy Policy — GDPR + LGPD compliant, covers AI transcript processing, tenant isolation, data retention, sub-processors.
- `/terms`: Terms of Service — subscription/billing policy, acceptable use (explicit AI limitation disclaimer, human oversight requirement), candidate consent obligations.

---

## Environment Variables & Secrets

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `SESSION_SECRET` | Replit Secrets | JWT signing for candidate tokens |
| `VITE_CLERK_PUBLISHABLE_KEY` | Replit Secrets | Clerk frontend key |
| `CLERK_SECRET_KEY` | Replit Secrets | Clerk backend verification |
| `VITE_CLERK_PROXY_URL` | Replit Secrets | Clerk proxy URL (optional) |
| `DATABASE_URL` | Replit managed | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Replit Secrets | Claude AI for interview + evaluation |
| `RESEND_API_KEY` | Replit Secrets | Transactional email |
| Stripe keys | Replit Integrations | Auto-injected when Stripe integration connected |

`JWT_SECRET` falls back to `"hireforward-secret-key"` if `SESSION_SECRET` is not set (dev only).

---

## Known Gaps / Roadmap

| Priority | Item |
|----------|------|
| High | Connect Stripe integration (Integrations tab → OAuth) + run seed-products |
| High | Connect real production domain `hireforward.ai` to point at the deployed Replit app |
| Mid | PDF export of evaluation reports |
| Mid | Multi-language interviewer (currently English only) |
| Low | Prompt injection detection in candidate chat |
| Low | Advanced admin analytics (cost-per-candidate, conversion funnels) |

---

*Last updated: 2026-05-03 — full launch readiness pass complete.*
