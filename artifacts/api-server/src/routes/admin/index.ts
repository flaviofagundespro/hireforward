import { Router } from "express";
import { requireAdminToken, generateAdminToken, generateImpersonationToken, verifyImpersonationToken, verifyAdminToken } from "../../lib/auth";
import { db } from "@workspace/db";
import {
  companiesTable, jobProcessesTable, candidatesTable, tokenUsageTable,
  systemConfigTable, usersTable, activityLogsTable,
} from "@workspace/db";
import { eq, sum, count, gte, and, sql, inArray, desc, lt } from "drizzle-orm";
import { AI_PROVIDERS, getAIConfig } from "../../lib/ai-provider";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@hireforward.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "hireforward2026";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logActivity(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ip?: string,
) {
  try {
    await db.insert(activityLogsTable).values({
      actorType: "admin",
      actorId: "owner",
      action,
      entityType,
      entityId,
      details,
      ip,
    });
  } catch {
    // non-critical
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return void res.status(401).json({ error: "Invalid credentials" });
    }
    const token = generateAdminToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Companies List ───────────────────────────────────────────────────────────

router.get("/admin/companies", requireAdminToken, async (req, res) => {
  try {
    const companies = await db.select().from(companiesTable);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const withStats = await Promise.all(
      companies.map(async (company) => {
        const [processCount] = await db
          .select({ count: count() })
          .from(jobProcessesTable)
          .where(eq(jobProcessesTable.companyId, company.id));

        const [candidateCount] = await db
          .select({ count: count() })
          .from(candidatesTable)
          .innerJoin(jobProcessesTable, eq(candidatesTable.jobProcessId, jobProcessesTable.id))
          .where(eq(jobProcessesTable.companyId, company.id));

        const [monthUsage] = await db
          .select({
            tokensInput: sum(tokenUsageTable.tokensInput),
            tokensOutput: sum(tokenUsageTable.tokensOutput),
            cost: sum(tokenUsageTable.costUsd),
          })
          .from(tokenUsageTable)
          .where(and(eq(tokenUsageTable.companyId, company.id), gte(tokenUsageTable.createdAt, monthStart)));

        return {
          id: company.id,
          name: company.name,
          plan: company.plan,
          status: company.status,
          hrContactEmail: company.hrContactEmail,
          processesCreated: processCount?.count ?? 0,
          candidatesEvaluated: candidateCount?.count ?? 0,
          tokensUsedMonth: Number(monthUsage?.tokensInput ?? 0) + Number(monthUsage?.tokensOutput ?? 0),
          costMonth: Number(monthUsage?.cost ?? 0),
          createdAt: company.createdAt.toISOString(),
        };
      })
    );

    res.json(withStats);
  } catch (err) {
    req.log.error({ err }, "Failed to list companies");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Company Detail ───────────────────────────────────────────────────────────

router.get("/admin/companies/:id", requireAdminToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    if (!company) return void res.status(404).json({ error: "Company not found" });

    const users = await db.select().from(usersTable).where(eq(usersTable.companyId, id));

    res.json({
      ...company,
      createdAt: company.createdAt.toISOString(),
      users: users.map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get company detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/companies/:id", requireAdminToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const allowed = ["name", "plan", "status", "website", "industry", "companySize", "timezone", "interviewLanguage", "hrContactName", "hrContactEmail", "hrContactPhone"] as const;
    type AllowedKey = typeof allowed[number];
    const updates: Partial<Record<AllowedKey, string>> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key] as string;
    }
    if (Object.keys(updates).length === 0) return void res.status(400).json({ error: "No valid fields" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.update(companiesTable).set(updates as any).where(eq(companiesTable.id, id));

    await logActivity("company_updated", "company", id, updates, req.ip);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update company");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Company Usage ────────────────────────────────────────────────────────────

router.get("/admin/companies/:id/usage", requireAdminToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthData] = await db
      .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(and(eq(tokenUsageTable.companyId, id), gte(tokenUsageTable.createdAt, monthStart)));

    const [yearData] = await db
      .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(and(eq(tokenUsageTable.companyId, id), gte(tokenUsageTable.createdAt, yearStart)));

    const [processCount] = await db.select({ count: count() }).from(jobProcessesTable).where(eq(jobProcessesTable.companyId, id));

    const [candidatesTotal] = await db
      .select({ count: count() })
      .from(candidatesTable)
      .innerJoin(jobProcessesTable, eq(candidatesTable.jobProcessId, jobProcessesTable.id))
      .where(eq(jobProcessesTable.companyId, id));

    const [candidatesEvaluated] = await db
      .select({ count: count() })
      .from(candidatesTable)
      .innerJoin(jobProcessesTable, eq(candidatesTable.jobProcessId, jobProcessesTable.id))
      .where(and(eq(jobProcessesTable.companyId, id), eq(candidatesTable.status, "completed")));

    // Monthly chart: last 12 months
    const monthly = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [mData] = await db
        .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
        .from(tokenUsageTable)
        .where(and(eq(tokenUsageTable.companyId, id), gte(tokenUsageTable.createdAt, mStart), lt(tokenUsageTable.createdAt, mEnd)));
      monthly.push({
        month: mStart.toISOString().slice(0, 7),
        tokensInput: Number(mData?.tokensInput ?? 0),
        tokensOutput: Number(mData?.tokensOutput ?? 0),
        costUsd: Number(mData?.cost ?? 0),
      });
    }

    // Recent token usage logs
    const logs = await db
      .select()
      .from(tokenUsageTable)
      .where(eq(tokenUsageTable.companyId, id))
      .orderBy(desc(tokenUsageTable.createdAt))
      .limit(30);

    // Enrich with process/candidate names
    const processIds = [...new Set(logs.map(l => l.jobProcessId).filter(Boolean) as string[])];
    const candidateIds = [...new Set(logs.map(l => l.candidateId).filter(Boolean) as string[])];

    const processes = processIds.length > 0
      ? await db.select({ id: jobProcessesTable.id, title: jobProcessesTable.title }).from(jobProcessesTable).where(inArray(jobProcessesTable.id, processIds))
      : [];
    const candidates = candidateIds.length > 0
      ? await db.select({ id: candidatesTable.id, name: candidatesTable.name }).from(candidatesTable).where(inArray(candidatesTable.id, candidateIds))
      : [];

    const processMap = new Map(processes.map(p => [p.id, p.title]));
    const candidateMap = new Map(candidates.map(c => [c.id, c.name]));

    res.json({
      tokensMonth: Number(monthData?.tokensInput ?? 0) + Number(monthData?.tokensOutput ?? 0),
      tokensYear: Number(yearData?.tokensInput ?? 0) + Number(yearData?.tokensOutput ?? 0),
      costMonth: Number(monthData?.cost ?? 0),
      costYear: Number(yearData?.cost ?? 0),
      processesTotal: processCount?.count ?? 0,
      candidatesTotal: candidatesTotal?.count ?? 0,
      candidatesEvaluated: candidatesEvaluated?.count ?? 0,
      monthly,
      recentLogs: logs.map(l => ({
        id: l.id,
        processTitle: l.jobProcessId ? (processMap.get(l.jobProcessId) ?? "Unknown") : null,
        candidateName: l.candidateId ? (candidateMap.get(l.candidateId) ?? null) : null,
        tokensInput: l.tokensInput,
        tokensOutput: l.tokensOutput,
        costUsd: l.costUsd,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get company usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Company Invoice ──────────────────────────────────────────────────────────

router.get("/admin/companies/:id/invoice", async (req, res) => {
  // Accept token from query string so this URL can be opened directly in a browser tab
  const qToken = String(req.query.token ?? "");
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const rawToken = qToken || bearerToken;
  if (!rawToken || !verifyAdminToken(rawToken)) {
    return void res.status(401).send("Unauthorized");
  }

  try {
    const id = String(req.params.id);
    const monthParam = String(req.query.month ?? "");
    const now = new Date();
    // Default to previous month
    const targetDate = monthParam
      ? new Date(monthParam + "-02T00:00:00Z")
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
    const billingPeriod = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
    const dueDate = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 1, 0);
    const dueDateStr = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const invoiceNum = `INV-${id.slice(0, 6).toUpperCase()}-${monthStart.getFullYear()}${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    if (!company) return void res.status(404).send("Company not found");

    const [usageData] = await db
      .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), costUsd: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(and(eq(tokenUsageTable.companyId, id), gte(tokenUsageTable.createdAt, monthStart), lt(tokenUsageTable.createdAt, monthEnd)));

    const tokensIn = Number(usageData?.tokensInput ?? 0);
    const tokensOut = Number(usageData?.tokensOutput ?? 0);
    const inputCost = tokensIn * 3 / 1_000_000;
    const outputCost = tokensOut * 15 / 1_000_000;
    const totalCost = Number(usageData?.costUsd ?? 0) || (inputCost + outputCost);
    const fmt = (n: number) => n.toLocaleString("en-US");
    const money = (n: number) => `$${n.toFixed(2)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invoiceNum}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #1e293b; }
  .page { max-width: 780px; margin: 32px auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.08); overflow: hidden; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 40px 48px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { color: #fff; }
  .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .brand-tag { font-size: 11px; color: #94a3b8; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .invoice-badge { text-align: right; }
  .invoice-badge h1 { font-size: 32px; font-weight: 800; color: #fff; letter-spacing: 2px; }
  .invoice-badge .inv-num { font-size: 13px; color: #64748b; margin-top: 6px; font-family: monospace; }
  .body { padding: 40px 48px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 36px; }
  .meta-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
  .meta-block p { font-size: 14px; color: #1e293b; line-height: 1.6; }
  .meta-block .company-name { font-size: 16px; font-weight: 700; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0 0 28px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f8fafc; }
  th { padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td .sub { font-size: 12px; color: #94a3b8; margin-top: 3px; }
  .totals { margin-top: 12px; }
  .totals table { width: 320px; margin-left: auto; }
  .totals td { padding: 8px 16px; font-size: 14px; border-bottom: none; }
  .totals td:first-child { color: #64748b; }
  .total-row td { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 14px; }
  .status-badge { display: inline-block; background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { padding: 28px 48px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .footer p { font-size: 12px; color: #94a3b8; }
  .print-btn { background: #2563eb; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s; }
  .print-btn:hover { background: #1d4ed8; }
  @media print {
    body { background: #fff; }
    .page { max-width: 100%; margin: 0; box-shadow: none; border-radius: 0; }
    .no-print { display: none !important; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .zero-note { text-align: center; padding: 40px 0; color: #94a3b8; font-size: 14px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="brand-name">HireForward</div>
      <div class="brand-tag">AI Recruitment Platform</div>
    </div>
    <div class="invoice-badge">
      <h1>INVOICE</h1>
      <div class="inv-num">${invoiceNum}</div>
    </div>
  </div>

  <div class="body">
    <div class="meta-row">
      <div class="meta-block">
        <h3>From</h3>
        <p><strong>HireForward Inc.</strong></p>
        <p>AI Recruitment Platform</p>
        <p>billing@hireforward.ai</p>
      </div>
      <div class="meta-block">
        <h3>Bill To</h3>
        <p class="company-name">${company.name}</p>
        ${company.hrContactName ? `<p>${company.hrContactName}</p>` : ""}
        ${company.hrContactEmail ? `<p>${company.hrContactEmail}</p>` : ""}
        ${company.website ? `<p>${company.website}</p>` : ""}
      </div>
      <div class="meta-block">
        <h3>Invoice Details</h3>
        <p><strong>Billing Period</strong><br>${billingPeriod}</p>
        <p style="margin-top:8px"><strong>Due Date</strong><br>${dueDateStr}</p>
        <p style="margin-top:8px"><strong>Plan</strong><br>${company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}</p>
      </div>
    </div>

    <hr class="divider">

    ${totalCost === 0 ? `<div class="zero-note">No API usage recorded for ${billingPeriod}.</div>` : `
    <table>
      <thead>
        <tr>
          <th style="width:50%">Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            AI Interview API — Input Tokens
            <div class="sub">Language model context/prompt processing</div>
          </td>
          <td>${fmt(tokensIn)} tokens</td>
          <td>$3.00 / 1M</td>
          <td>${money(inputCost)}</td>
        </tr>
        <tr>
          <td>
            AI Interview API — Output Tokens
            <div class="sub">Language model generated responses</div>
          </td>
          <td>${fmt(tokensOut)} tokens</td>
          <td>$15.00 / 1M</td>
          <td>${money(outputCost)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td>${money(totalCost)}</td></tr>
        <tr><td>Tax (0%)</td><td>$0.00</td></tr>
        <tr class="total-row"><td>Total Due</td><td>${money(totalCost)}</td></tr>
      </table>
    </div>
    `}
  </div>

  <div class="footer">
    <p>Payment due within 30 days of invoice date. Thank you for using HireForward.</p>
    <button class="print-btn no-print" onclick="window.print()">Save as PDF</button>
  </div>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "Failed to generate invoice");
    res.status(500).send("Internal server error");
  }
});

// ─── Company Processes ────────────────────────────────────────────────────────

router.get("/admin/companies/:id/processes", requireAdminToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.companyId, id))
      .orderBy(desc(jobProcessesTable.createdAt));

    res.json(processes.map(p => ({
      id: p.id,
      title: p.title,
      area: p.area,
      seniority: p.seniority,
      status: p.status,
      interviewType: p.interviewType,
      candidatesTotal: p.candidatesTotal,
      candidatesEvaluated: p.candidatesEvaluated,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get company processes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Company Impersonate ──────────────────────────────────────────────────────

router.post("/admin/companies/:id/impersonate", requireAdminToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    if (!company) return void res.status(404).json({ error: "Company not found" });

    const token = generateImpersonationToken(id);
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    await logActivity("impersonation_started", "company", id, { companyName: company.name }, req.ip);

    res.json({ token, expiresAt, companyName: company.name });
  } catch (err) {
    req.log.error({ err }, "Failed to generate impersonation token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Validate impersonation token (public — used by the /impersonate page)
router.get("/admin/impersonate/validate", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return void res.status(400).json({ error: "Token required" });

    const payload = verifyImpersonationToken(token);
    if (!payload) return void res.status(401).json({ error: "Invalid or expired token" });

    const [company] = await db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, payload.companyId));
    if (!company) return void res.status(404).json({ error: "Company not found" });

    res.json({ companyId: company.id, companyName: company.name });
  } catch (err) {
    req.log.error({ err }, "Failed to validate impersonation token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Token Usage (global) ─────────────────────────────────────────────────────

router.get("/admin/token-usage", requireAdminToken, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthData] = await db
      .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(gte(tokenUsageTable.createdAt, monthStart));

    const [yearData] = await db
      .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(gte(tokenUsageTable.createdAt, yearStart));

    const topCompanies = await db
      .select({ companyId: tokenUsageTable.companyId, tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
      .from(tokenUsageTable)
      .where(gte(tokenUsageTable.createdAt, monthStart))
      .groupBy(tokenUsageTable.companyId)
      .limit(10);

    const companiesData = await db.select().from(companiesTable);
    const companyMap = new Map(companiesData.map(c => [c.id, c.name]));

    const recentLogs = await db
      .select()
      .from(tokenUsageTable)
      .innerJoin(companiesTable, eq(tokenUsageTable.companyId, companiesTable.id))
      .orderBy(desc(tokenUsageTable.createdAt))
      .limit(50);

    const processesData = await db.select({ id: jobProcessesTable.id, title: jobProcessesTable.title }).from(jobProcessesTable);
    const processMap = new Map(processesData.map(p => [p.id, p.title]));

    const candidatesData = await db.select({ id: candidatesTable.id, name: candidatesTable.name }).from(candidatesTable);
    const candidateMap = new Map(candidatesData.map(c => [c.id, c.name]));

    res.json({
      tokensUsedMonth: Number(monthData?.tokensInput ?? 0) + Number(monthData?.tokensOutput ?? 0),
      tokensUsedYear: Number(yearData?.tokensInput ?? 0) + Number(yearData?.tokensOutput ?? 0),
      costMonthUsd: Number(monthData?.cost ?? 0),
      costYearUsd: Number(yearData?.cost ?? 0),
      topCompanies: topCompanies.map(c => ({
        companyName: companyMap.get(c.companyId) ?? c.companyId,
        tokensUsed: Number(c.tokensInput ?? 0) + Number(c.tokensOutput ?? 0),
        costUsd: Number(c.cost ?? 0),
      })),
      recentLogs: recentLogs.map(row => ({
        id: row.token_usage.id,
        companyName: row.companies.name,
        processTitle: row.token_usage.jobProcessId ? (processMap.get(row.token_usage.jobProcessId) ?? "Unknown") : "N/A",
        candidateName: row.token_usage.candidateId ? (candidateMap.get(row.token_usage.candidateId) ?? null) : null,
        tokensInput: row.token_usage.tokensInput,
        tokensOutput: row.token_usage.tokensOutput,
        costUsd: row.token_usage.costUsd,
        createdAt: row.token_usage.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get token usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/token-usage/monthly", requireAdminToken, async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [data] = await db
        .select({ tokensInput: sum(tokenUsageTable.tokensInput), tokensOutput: sum(tokenUsageTable.tokensOutput), cost: sum(tokenUsageTable.costUsd) })
        .from(tokenUsageTable)
        .where(and(gte(tokenUsageTable.createdAt, monthStart), lt(tokenUsageTable.createdAt, monthEnd)));
      months.push({ month: monthStart.toISOString().slice(0, 7), tokensInput: Number(data?.tokensInput ?? 0), tokensOutput: Number(data?.tokensOutput ?? 0), costUsd: Number(data?.cost ?? 0) });
    }
    res.json(months);
  } catch (err) {
    req.log.error({ err }, "Failed to get monthly usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── AI Config ────────────────────────────────────────────────────────────────

const AI_CONFIG_KEYS = ["ai_provider", "ai_api_key", "ai_model", "ai_base_url", "ai_api_version"];

router.get("/admin/ai-config", requireAdminToken, async (req, res) => {
  try {
    const rows = await db.select().from(systemConfigTable).where(inArray(systemConfigTable.key, AI_CONFIG_KEYS));
    const cfg: Record<string, string | null> = {};
    for (const key of AI_CONFIG_KEYS) cfg[key] = rows.find(r => r.key === key)?.value ?? null;
    res.json({ ...cfg, providers: AI_PROVIDERS });
  } catch (err) {
    req.log.error({ err }, "Failed to get AI config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/ai-config", requireAdminToken, async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const key of Object.keys(updates)) {
      if (!AI_CONFIG_KEYS.includes(key)) continue;
      await db.insert(systemConfigTable).values({ key, value: updates[key], updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemConfigTable.key, set: { value: updates[key], updatedAt: new Date() } });
    }
    await logActivity("ai_config_updated", "system_config", undefined, { keys: Object.keys(updates) }, req.ip);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save AI config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/ai-config/active", requireAdminToken, async (req, res) => {
  try {
    const cfg = await getAIConfig();
    res.json({ provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl, hasApiKey: !!cfg.apiKey });
  } catch (err) {
    req.log.error({ err }, "Failed to get active AI config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Email Config ─────────────────────────────────────────────────────────────

const EMAIL_CONFIG_KEYS = ["email_enabled", "email_provider", "email_api_key", "email_sender_name", "email_sender_address", "email_reply_to"];

router.get("/admin/email-config", requireAdminToken, async (req, res) => {
  try {
    const rows = await db.select().from(systemConfigTable).where(inArray(systemConfigTable.key, EMAIL_CONFIG_KEYS));
    const config: Record<string, string | null> = {};
    for (const key of EMAIL_CONFIG_KEYS) config[key] = rows.find(r => r.key === key)?.value ?? null;
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get email config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/email-config", requireAdminToken, async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const key of Object.keys(updates)) {
      if (!EMAIL_CONFIG_KEYS.includes(key)) continue;
      await db.insert(systemConfigTable).values({ key, value: updates[key], updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemConfigTable.key, set: { value: updates[key], updatedAt: new Date() } });
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save email config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/email-config/test", requireAdminToken, async (req, res) => {
  try {
    const rows = await db.select().from(systemConfigTable).where(inArray(systemConfigTable.key, EMAIL_CONFIG_KEYS));
    const cfg: Record<string, string | null> = {};
    for (const r of rows) cfg[r.key] = r.value;

    if (cfg.email_enabled !== "true") return void res.status(400).json({ error: "Email is not enabled." });
    if (!cfg.email_api_key) return void res.status(400).json({ error: "API key is not configured." });
    if (!cfg.email_sender_address) return void res.status(400).json({ error: "Sender address is not configured." });

    const testTo = req.body?.to as string | undefined;
    if (!testTo) return void res.status(400).json({ error: "Provide a 'to' email address for the test." });

    const payload = {
      from: cfg.email_sender_name ? `${cfg.email_sender_name} <${cfg.email_sender_address}>` : cfg.email_sender_address,
      to: [testTo],
      reply_to: cfg.email_reply_to ?? undefined,
      subject: "HireForward — Email test",
      html: "<p>This is a test email from <strong>HireForward</strong>. Your email configuration is working correctly.</p>",
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.email_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return void res.status(502).json({ error: `Resend returned ${response.status}: ${errorBody}` });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send test email");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG_KEYS = [
  "platform_name",
  "platform_maintenance_mode",
  "platform_maintenance_message",
  "invite_expiry_days",
  "ai_price_input_per_1m",
  "ai_price_output_per_1m",
  "ai_max_tokens_per_session",
  "ai_timeout_seconds",
];

const PLATFORM_CONFIG_DEFAULTS: Record<string, string> = {
  platform_name: "HireForward",
  platform_maintenance_mode: "false",
  platform_maintenance_message: "We are performing scheduled maintenance. We'll be back shortly.",
  invite_expiry_days: "7",
  ai_price_input_per_1m: "3.00",
  ai_price_output_per_1m: "15.00",
  ai_max_tokens_per_session: "50000",
  ai_timeout_seconds: "30",
};

router.get("/admin/platform-config", requireAdminToken, async (req, res) => {
  try {
    const rows = await db.select().from(systemConfigTable).where(inArray(systemConfigTable.key, PLATFORM_CONFIG_KEYS));
    const config: Record<string, string> = { ...PLATFORM_CONFIG_DEFAULTS };
    for (const r of rows) config[r.key] = r.value ?? PLATFORM_CONFIG_DEFAULTS[r.key];
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get platform config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/platform-config", requireAdminToken, async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const key of Object.keys(updates)) {
      if (!PLATFORM_CONFIG_KEYS.includes(key)) continue;
      await db.insert(systemConfigTable).values({ key, value: updates[key], updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemConfigTable.key, set: { value: updates[key], updatedAt: new Date() } });
    }
    await logActivity("platform_config_updated", "system_config", undefined, { keys: Object.keys(updates) }, req.ip);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save platform config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Activity Logs ────────────────────────────────────────────────────────────

router.get("/admin/activity-logs", requireAdminToken, async (req, res) => {
  try {
    const { companyId, limit: limitParam = "50" } = req.query as Record<string, string>;
    const limitNum = Math.min(Number(limitParam) || 50, 200);

    const logs = await db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limitNum);

    res.json(logs.map(l => ({
      id: l.id,
      actorType: l.actorType,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      ip: l.ip,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get activity logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
