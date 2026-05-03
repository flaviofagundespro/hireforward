import { Router } from "express";
import { requireAuth, getCompanyId, generateInviteToken } from "../../lib/auth";
import { db } from "@workspace/db";
import { candidatesTable, jobProcessesTable, evaluationsTable, interviewSessionsTable, companiesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { CreateCandidateBody } from "@workspace/api-zod";
import { sendEmail, buildInviteEmail, buildPipelineStageEmail } from "../../lib/email";

const router = Router();

router.get("/processes/:id/candidates", requireAuth, async (req, res) => {
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

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.jobProcessId, processId));

    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const recommendation = req.query.recommendation as string | undefined;

    const evaluationPromises = candidates.map(async (c) => {
      const evals = await db
        .select()
        .from(evaluationsTable)
        .where(eq(evaluationsTable.candidateId, c.id))
        .limit(1);
      return { ...c, evaluation: evals[0] ?? null };
    });

    const withEvals = await Promise.all(evaluationPromises);

    const filtered = withEvals.filter(c => {
      if (minScore !== undefined && (c.evaluation?.overallScore ?? 0) < minScore) return false;
      if (recommendation && c.evaluation?.recommendation !== recommendation) return false;
      return true;
    });

    const result = filtered.map(c => ({
      ...c,
      overallScore: c.evaluation?.overallScore ?? null,
      recommendation: c.evaluation?.recommendation ?? null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list candidates");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/processes/:id/candidates", requireAuth, async (req, res) => {
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

    const parsed = CreateCandidateBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

    const expiresHours = parsed.data.tokenExpiresHours ?? 72;

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        jobProcessId: processId,
        name: parsed.data.name,
        email: parsed.data.email,
        inviteToken: "pending",
      })
      .returning();

    const inviteToken = generateInviteToken(candidate.id, expiresHours);
    const tokenExpiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    await db
      .update(candidatesTable)
      .set({ inviteToken, tokenExpiresAt })
      .where(eq(candidatesTable.id, candidate.id));

    await db
      .update(jobProcessesTable)
      .set({ candidatesTotal: sql`${jobProcessesTable.candidatesTotal} + 1` })
      .where(eq(jobProcessesTable.id, processId));

    const host = req.headers.host ?? "localhost";
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    const inviteLink = `${protocol}://${host}/i/${inviteToken}`;

    const process = processes[0];
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, process.companyId)).limit(1);
    const company = companies[0];

    sendEmail({
      to: candidate.email,
      subject: `Interview invitation — ${process.title} at ${company?.name ?? "the company"}`,
      html: buildInviteEmail({
        candidateName: candidate.name,
        companyName: company?.name ?? "the company",
        processTitle: process.title,
        inviteLink,
        estimatedMinutes: 30,
      }),
    }).catch(() => {});

    res.status(201).json({ ...candidate, inviteToken, tokenExpiresAt, inviteLink });
  } catch (err) {
    req.log.error({ err }, "Failed to create candidate");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/processes/:id/candidates/:candidateId/resend-invite", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });
    const processId = String(req.params.id);
    const candidateId = String(req.params.candidateId);

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, processId), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Process not found" });

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(and(eq(candidatesTable.id, candidateId), eq(candidatesTable.jobProcessId, processId)))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Candidate not found" });
    const candidate = candidates[0];

    if (candidate.status === "completed") {
      return void res.status(400).json({ error: "Cannot resend invite to a completed candidate" });
    }

    const expiresHours = 72;
    const newToken = generateInviteToken(candidateId, expiresHours);
    const newExpiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    const [updated] = await db
      .update(candidatesTable)
      .set({ inviteToken: newToken, tokenExpiresAt: newExpiresAt, status: "invited" })
      .where(eq(candidatesTable.id, candidateId))
      .returning();

    const host = req.headers.host ?? "localhost";
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    const inviteLink = `${protocol}://${host}/i/${newToken}`;

    const process = processes[0];
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, process.companyId)).limit(1);
    const company = companies[0];

    sendEmail({
      to: candidate.email,
      subject: `Interview reminder — ${process.title} at ${company?.name ?? "the company"}`,
      html: buildInviteEmail({
        candidateName: candidate.name,
        companyName: company?.name ?? "the company",
        processTitle: process.title,
        inviteLink,
        estimatedMinutes: 30,
      }),
    }).catch(() => {});

    res.json({ ...updated, inviteLink });
  } catch (err) {
    req.log.error({ err }, "Failed to resend invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/candidates/:candidateId/stage", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });
    const candidateId = String(req.params.candidateId);

    const validStages = ["new", "reviewing", "shortlisted", "approved", "rejected"] as const;
    const { stage } = req.body as { stage: string };
    if (!stage || !validStages.includes(stage as typeof validStages[number])) {
      return void res.status(400).json({ error: "Invalid stage. Must be one of: " + validStages.join(", ") });
    }

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, candidateId))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Candidate not found" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, candidates[0].jobProcessId), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(403).json({ error: "Forbidden" });

    const [updated] = await db
      .update(candidatesTable)
      .set({ pipelineStage: stage as typeof validStages[number] })
      .where(eq(candidatesTable.id, candidateId))
      .returning();

    res.json(updated);

    if (stage === "approved" || stage === "rejected") {
      try {
        const process = processes[0];
        const [company] = await db
          .select()
          .from(companiesTable)
          .where(eq(companiesTable.id, process.companyId))
          .limit(1);

        if (company?.hrContactEmail) {
          const evals = await db
            .select()
            .from(evaluationsTable)
            .where(eq(evaluationsTable.candidateId, candidateId))
            .limit(1);

          const evalData = evals[0] ?? null;

          const replitDomains = (globalThis.process.env["REPLIT_DOMAINS"] ?? "").split(",").map((d: string) => d.trim()).filter(Boolean);
          const host = replitDomains[0] ?? "localhost";
          const protocol = replitDomains[0] ? "https" : "http";
          const candidateReportUrl = `${protocol}://${host}/candidates/${candidateId}`;

          sendEmail({
            to: company.hrContactEmail,
            subject: `Candidate ${stage === "approved" ? "Approved ✅" : "Rejected ❌"}: ${candidates[0].name} — ${process.title}`,
            html: buildPipelineStageEmail({
              hrEmail: company.hrContactEmail,
              candidateName: candidates[0].name,
              processTitle: process.title,
              companyName: company.name,
              stage,
              overallScore: evalData?.overallScore ?? null,
              recommendation: evalData?.recommendation ?? null,
              candidateReportUrl,
            }),
          }).catch(() => {});
        }
      } catch {
        req.log.warn({ candidateId, stage }, "Failed to send pipeline stage notification email");
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update candidate pipeline stage");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/candidates/:candidateId", requireAuth, async (req, res) => {
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
      .where(eq(evaluationsTable.candidateId, candidate.id))
      .limit(1);

    const sessions = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.candidateId, candidate.id))
      .limit(1);

    const transcript = sessions[0]?.transcript ?? [];

    const evalData = evals[0] ? {
      id: evals[0].id,
      candidateId: evals[0].candidateId,
      overallScore: evals[0].overallScore,
      recommendation: evals[0].recommendation,
      criteriaScores: evals[0].criteriaScores ?? [],
      highlights: evals[0].highlights ?? [],
      redFlags: evals[0].redFlags ?? [],
      summary: evals[0].summary,
      createdAt: evals[0].createdAt.toISOString(),
    } : null;

    res.json({
      ...candidate,
      overallScore: evalData?.overallScore ?? null,
      recommendation: evalData?.recommendation ?? null,
      evaluation: evalData,
      transcript,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get candidate");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
