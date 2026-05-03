import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { evaluationsTable, candidatesTable, jobProcessesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/evaluations/:candidateId", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const candidateId = String(req.params.candidateId);
    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, candidateId))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Not found" });
    const candidate = candidates[0];

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, candidate.jobProcessId), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(403).json({ error: "Forbidden" });

    const evals = await db
      .select()
      .from(evaluationsTable)
      .where(eq(evaluationsTable.candidateId, candidateId))
      .limit(1);

    if (evals.length === 0) return void res.status(404).json({ error: "Evaluation not found" });
    const evaluation = evals[0];

    res.json({
      id: evaluation.id,
      candidateId: evaluation.candidateId,
      overallScore: evaluation.overallScore,
      recommendation: evaluation.recommendation,
      criteriaScores: evaluation.criteriaScores ?? [],
      highlights: evaluation.highlights ?? [],
      redFlags: evaluation.redFlags ?? [],
      summary: evaluation.summary,
      createdAt: evaluation.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get evaluation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
