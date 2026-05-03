import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import {
  candidatesTable,
  jobProcessesTable,
  evaluationsTable,
  interviewSessionsTable,
  sharedReportsTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

router.post("/candidates/:candidateId/share-report", requireAuth, async (req, res) => {
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

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(
        and(
          eq(jobProcessesTable.id, candidates[0].jobProcessId),
          eq(jobProcessesTable.companyId, companyId),
        ),
      )
      .limit(1);

    if (processes.length === 0) return void res.status(403).json({ error: "Forbidden" });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(sharedReportsTable).values({ token, candidateId, expiresAt });

    const protocol = (req.headers["x-forwarded-proto"] as string) ?? "http";
    const host = req.headers.host ?? "localhost";
    const link = `${protocol}://${host}/report/${token}`;

    res.json({ token, link });
  } catch (err) {
    req.log.error({ err }, "Failed to generate share link");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/report/:token", async (req, res) => {
  try {
    const now = new Date();
    const reports = await db
      .select()
      .from(sharedReportsTable)
      .where(
        and(
          eq(sharedReportsTable.token, String(req.params.token)),
          gt(sharedReportsTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (reports.length === 0) return void res.status(404).json({ error: "Report not found or link expired" });

    const { candidateId } = reports[0];

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, candidateId))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Candidate not found" });
    const candidate = candidates[0];

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.id, candidate.jobProcessId))
      .limit(1);

    const process = processes[0] ?? null;

    const evals = await db
      .select()
      .from(evaluationsTable)
      .where(eq(evaluationsTable.candidateId, candidateId))
      .limit(1);

    const sessions = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.candidateId, candidateId))
      .limit(1);

    const evalData = evals[0]
      ? {
          overallScore: evals[0].overallScore,
          recommendation: evals[0].recommendation,
          criteriaScores: evals[0].criteriaScores ?? [],
          highlights: evals[0].highlights ?? [],
          redFlags: evals[0].redFlags ?? [],
          summary: evals[0].summary,
          createdAt: evals[0].createdAt.toISOString(),
        }
      : null;

    res.json({
      candidateName: candidate.name,
      processTitle: process?.title ?? null,
      processArea: process?.area ?? null,
      evaluation: evalData,
      transcript: sessions[0]?.transcript ?? [],
      expiresAt: reports[0].expiresAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get shared report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
