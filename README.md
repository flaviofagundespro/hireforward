# HireForward 🚀

HireForward solves a structural failure in modern hiring: companies still evaluate candidates using 2015 criteria (memorizing syntax, blocking tools) while the real skill in 2026 is solving complex problems effectively using AI.

## 🤖 The Multi-Agent Pipeline

The platform orchestrates three AI agents in sequence to handle the full hiring pipeline:

1. **Configurator Agent:** Interviews the HR team via a structured conversation to extract evaluation priorities and generates a weighted rubric (e.g., problem decomposition, AI tool usage, communication).
2. **Interviewer Agent:** Conducts the candidate session. Fully adaptive, conversational, with zero tool restrictions. Captures the full transcript with timestamps.
3. **Evaluator Agent:** Receives the complete transcript plus the rubric contract. Scores each criterion 1–5 with evidence-based justification pulled directly from the conversation. Returns structured JSON with highlights, red flags, and a final recommendation.

## 🏗️ Architecture & Token Optimization

- **Model Agnostic Routing:** Designed to route tasks to the most efficient model.
- **Cost Attribution:** Token usage is logged per session for cost attribution across company tenants.
- **Output Contracts:** Strict JSON schemas for evaluator outputs.
- **Deployment:** Deployed globally via Cloudflare Pages.

## 🚀 Key Features

- **AI-Native Interviewing**: Candidates interact with a conversational AI interviewer that follows specific job criteria.
- **HR Dashboard**: Comprehensive view of recruitment stats and weekly activity.
- **Automated Evaluations**: Detailed reports with scoring, highlights, and red flags generated immediately after interviews.
- **Multi-Tenant Architecture**: Securely supports multiple companies with isolated data and configurations.
- **Admin Panel**: Robust platform management including AI provider settings, usage tracking, and audit logs.
- **Real-time Streaming**: Seamless candidate experience with SSE (Server-Sent Events) for AI responses.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, TanStack Query, shadcn/ui, Framer Motion, Recharts.
- **Backend**: Express 5, Node.js, Pino (logging).
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Clerk (HR/Admin) and JWT-based secure tokens (Candidates).
- **AI Integration**: Anthropic Claude (Sonnet 3.5/4).
- **Package Manager**: pnpm (Workspaces).

## 📂 Project Structure

This project is a monorepo organized into workspaces:

- `artifacts/hireforward`: The React-based frontend application.
- `artifacts/api-server`: The Express backend server.
- `lib/db`: Shared database schema and Drizzle configuration.
- `lib/api-spec`: OpenAPI specification and code generation.
- `lib/integrations-*`: Dedicated packages for third-party integrations (Anthropic, etc.).

## ⚙️ Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/flaviofagundespro/hireforward.git
   cd hireforward
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root and in the respective workspace folders based on `.env.example`.

4. Run migrations:
   ```bash
   pnpm --filter @workspace/db run push
   ```

5. Start the development environment:
   ```bash
   pnpm dev
   ```

## 🔐 Configuration

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string.
- `CLERK_SECRET_KEY` & `CLERK_PUBLISHABLE_KEY`: Clerk authentication keys.
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`: Anthropic API key.
- `SESSION_SECRET`: Secret for JWT token generation.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the future of recruitment.
