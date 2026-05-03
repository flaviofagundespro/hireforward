import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { jobProcessesTable, evaluationsTable, candidatesTable, tokenUsageTable, systemConfigTable } from "@workspace/db";
import { eq, and, gte, count, sql, sum } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.companyId, companyId));

    const activeProcesses = processes.filter(p => p.status === "active").length;
    const closedProcesses = processes.filter(p => p.status === "closed").length;
    const totalCandidatesEvaluated = processes.reduce((sum, p) => sum + p.candidatesEvaluated, 0);

    const candidatesInCompany = await db
      .select({ id: candidatesTable.id })
      .from(candidatesTable)
      .innerJoin(jobProcessesTable, eq(candidatesTable.jobProcessId, jobProcessesTable.id))
      .where(eq(jobProcessesTable.companyId, companyId));

    const candidateIds = candidatesInCompany.map(c => c.id);

    let averageApprovalRate = 0;
    if (candidateIds.length > 0) {
      const evals = await db
        .select({ recommendation: evaluationsTable.recommendation })
        .from(evaluationsTable)
        .where(sql`${evaluationsTable.candidateId} = ANY(ARRAY[${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)}]::text[])`);

      const advanced = evals.filter(e =>
        e.recommendation?.toLowerCase().includes("advance") ||
        e.recommendation?.toLowerCase().includes("strong hire") ||
        e.recommendation?.toLowerCase().includes("hire")
      ).length;
      averageApprovalRate = evals.length > 0 ? Math.round((advanced / evals.length) * 100) : 0;
    }

    res.json({ totalCandidatesEvaluated, activeProcesses, closedProcesses, averageApprovalRate });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/weekly-activity", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const weeks = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const result = await db
        .select({ count: count() })
        .from(evaluationsTable)
        .innerJoin(candidatesTable, eq(evaluationsTable.candidateId, candidatesTable.id))
        .innerJoin(jobProcessesTable, eq(candidatesTable.jobProcessId, jobProcessesTable.id))
        .where(
          and(
            eq(jobProcessesTable.companyId, companyId),
            gte(evaluationsTable.createdAt, weekStart),
            sql`${evaluationsTable.createdAt} < ${weekEnd}`
          )
        );

      weeks.push({
        week: weekStart.toISOString().split("T")[0],
        candidatesEvaluated: result[0]?.count ?? 0,
      });
    }

    res.json(weeks);
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/usage", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthUsage] = await db
      .select({
        tokensInput: sum(tokenUsageTable.tokensInput),
        tokensOutput: sum(tokenUsageTable.tokensOutput),
        costUsd: sum(tokenUsageTable.costUsd),
      })
      .from(tokenUsageTable)
      .where(and(eq(tokenUsageTable.companyId, companyId), gte(tokenUsageTable.createdAt, monthStart)));

    const [yearUsage] = await db
      .select({
        tokensInput: sum(tokenUsageTable.tokensInput),
        tokensOutput: sum(tokenUsageTable.tokensOutput),
        costUsd: sum(tokenUsageTable.costUsd),
      })
      .from(tokenUsageTable)
      .where(and(eq(tokenUsageTable.companyId, companyId), gte(tokenUsageTable.createdAt, yearStart)));

    // Monthly breakdown: last 6 months
    const months: { month: string; tokensInput: number; tokensOutput: number; costUsd: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [row] = await db
        .select({
          tokensInput: sum(tokenUsageTable.tokensInput),
          tokensOutput: sum(tokenUsageTable.tokensOutput),
          costUsd: sum(tokenUsageTable.costUsd),
        })
        .from(tokenUsageTable)
        .where(
          and(
            eq(tokenUsageTable.companyId, companyId),
            gte(tokenUsageTable.createdAt, mStart),
            sql`${tokenUsageTable.createdAt} < ${mEnd}`
          )
        );
      months.push({
        month: mStart.toLocaleString("default", { month: "short", year: "2-digit" }),
        tokensInput: Number(row?.tokensInput ?? 0),
        tokensOutput: Number(row?.tokensOutput ?? 0),
        costUsd: Number(row?.costUsd ?? 0),
      });
    }

    // Get pricing config
    const configs = await db.select().from(systemConfigTable);
    const cfgMap: Record<string, string> = {};
    for (const c of configs) cfgMap[c.key] = c.value ?? "";
    const priceInput = parseFloat(cfgMap.ai_price_input_per_1m ?? "3.00");
    const priceOutput = parseFloat(cfgMap.ai_price_output_per_1m ?? "15.00");
    const maxTokensPerSession = parseInt(cfgMap.ai_max_tokens_per_session ?? "50000");

    res.json({
      month: {
        tokensInput: Number(monthUsage?.tokensInput ?? 0),
        tokensOutput: Number(monthUsage?.tokensOutput ?? 0),
        tokensTotal: Number(monthUsage?.tokensInput ?? 0) + Number(monthUsage?.tokensOutput ?? 0),
        costUsd: Number(monthUsage?.costUsd ?? 0),
      },
      year: {
        tokensInput: Number(yearUsage?.tokensInput ?? 0),
        tokensOutput: Number(yearUsage?.tokensOutput ?? 0),
        tokensTotal: Number(yearUsage?.tokensInput ?? 0) + Number(yearUsage?.tokensOutput ?? 0),
        costUsd: Number(yearUsage?.costUsd ?? 0),
      },
      months,
      pricing: { priceInput, priceOutput, maxTokensPerSession },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
