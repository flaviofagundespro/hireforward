import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { jobProcessesTable, companiesTable, candidatesTable, evaluationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/processes/:id/manager-link", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processId = String(req.params.id);
    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, processId), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Not found" });

    let token = processes[0].managerViewToken;
    if (!token) {
      token = crypto.randomUUID();
      await db
        .update(jobProcessesTable)
        .set({ managerViewToken: token })
        .where(eq(jobProcessesTable.id, processId));
    }

    const host = req.headers.host ?? "localhost";
    const protocol = (req.headers["x-forwarded-proto"] as string) ?? "http";
    const link = `${protocol}://${host}/manager/${token}`;

    res.json({ managerViewToken: token, link });
  } catch (err) {
    req.log.error({ err }, "Failed to generate manager link");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/manager/:token", async (req, res) => {
  try {
    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.managerViewToken, String(req.params.token)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Not found" });
    const process = processes[0];

    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, process.companyId))
      .limit(1);

    const company = companies[0];

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.jobProcessId, process.id));

    const candidatesWithScores = await Promise.all(
      candidates.map(async (c) => {
        const evals = await db
          .select()
          .from(evaluationsTable)
          .where(eq(evaluationsTable.candidateId, c.id))
          .limit(1);

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          overallScore: evals[0]?.overallScore ?? null,
          recommendation: evals[0]?.recommendation ?? null,
          createdAt: c.createdAt.toISOString(),
          summary: evals[0]?.summary ?? null,
          criteriaScores: evals[0]?.criteriaScores ?? null,
          highlights: evals[0]?.highlights ?? null,
          redFlags: evals[0]?.redFlags ?? null,
        };
      })
    );

    res.json({
      processId: process.id,
      processTitle: process.title,
      companyName: company?.name ?? "Unknown Company",
      companyLogoUrl: company?.logoUrl ?? null,
      area: process.area,
      seniority: process.seniority,
      candidates: candidatesWithScores,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get manager view");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
