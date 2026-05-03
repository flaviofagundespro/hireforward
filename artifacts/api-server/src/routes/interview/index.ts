import { Router } from "express";
import { verifyInviteToken } from "../../lib/auth";
import { db } from "@workspace/db";
import {
  candidatesTable,
  jobProcessesTable,
  companiesTable,
  evaluationCriteriaTable,
  interviewSessionsTable,
  evaluationsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logTokenUsage } from "../../lib/token-logger";
import { getAIConfig, streamChat, completeChat } from "../../lib/ai-provider";
import { sendEmail, buildEvaluationReadyEmail } from "../../lib/email";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/interview/:token", async (req, res) => {
  try {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return void res.status(404).json({ error: "Invalid or expired token" });

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, payload.candidateId))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Not found" });
    const candidate = candidates[0];

    if (candidate.status === "expired" || (candidate.tokenExpiresAt && candidate.tokenExpiresAt < new Date())) {
      return void res.status(404).json({ error: "Token expired" });
    }

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.id, candidate.jobProcessId))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Process not found" });
    const process = processes[0];

    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, process.companyId))
      .limit(1);

    const company = companies[0];

    res.json({
      candidateId: candidate.id,
      candidateName: candidate.name,
      processTitle: process.title,
      companyName: company?.name ?? "Unknown Company",
      companyLogoUrl: company?.logoUrl ?? null,
      interviewType: process.interviewType,
      toolsAllowed: process.toolsAllowed,
      responseTimeLimitSeconds: process.responseTimeLimitSeconds ?? null,
      estimatedMinutes: 30,
      status: candidate.status === "completed" ? "completed" : candidate.status === "started" ? "started" : "pending",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get interview info");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/interview/:token/start", async (req, res) => {
  try {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return void res.status(404).json({ error: "Invalid or expired token" });

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, payload.candidateId))
      .limit(1);

    if (candidates.length === 0) return void res.status(404).json({ error: "Not found" });
    const candidate = candidates[0];

    if (candidate.status === "completed") {
      return void res.status(400).json({ error: "Interview already completed" });
    }

    await db
      .update(candidatesTable)
      .set({ status: "started" })
      .where(eq(candidatesTable.id, candidate.id));

    const [session] = await db
      .insert(interviewSessionsTable)
      .values({ candidateId: candidate.id })
      .returning();

    res.json({ sessionId: session.id, startedAt: session.startedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to start interview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/interview/:token/message", async (req, res) => {
  try {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return void res.status(404).json({ error: "Invalid or expired token" });

    const { content, sessionId } = req.body;
    if (!content || !sessionId) return void res.status(400).json({ error: "content and sessionId required" });

    const sessions = await db
      .select()
      .from(interviewSessionsTable)
      .where(and(eq(interviewSessionsTable.id, sessionId), eq(interviewSessionsTable.candidateId, payload.candidateId)))
      .limit(1);

    if (sessions.length === 0) return void res.status(404).json({ error: "Session not found" });
    const session = sessions[0];

    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, payload.candidateId))
      .limit(1);

    const candidate = candidates[0];
    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.id, candidate.jobProcessId))
      .limit(1);

    const process = processes[0];

    const systemPrompt = process?.agentSystemPrompt ?? `You are a senior interviewer conducting an interview for the ${process?.title ?? "open position"} role in the ${process?.area ?? "technology"} area.
Conduct a conversational interview, asking adaptive questions based on the candidate's responses.
The candidate may use any tool during the interview.
Be professional, encouraging, and curious. Focus on understanding the candidate's reasoning process.
When the interview has run long enough (typically after 5–8 substantive exchanges), wrap up by thanking the candidate and explaining the next steps.`;

    const existingTranscript = (session.transcript ?? []) as Array<{ role: string; content: string; timestamp: string }>;
    const newTranscript = [
      ...existingTranscript,
      { role: "user", content, timestamp: new Date().toISOString() }
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const messages = newTranscript.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const aiCfg = await getAIConfig();
    const result = await streamChat(aiCfg, {
      systemPrompt,
      messages,
      onChunk: (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      },
    });

    await logTokenUsage({
      companyId: process.companyId,
      jobProcessId: process.id,
      candidateId: candidate.id,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
    });

    const updatedTranscript = [
      ...newTranscript,
      { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() }
    ];

    await db
      .update(interviewSessionsTable)
      .set({ transcript: updatedTranscript })
      .where(eq(interviewSessionsTable.id, session.id));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send interview message");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    else res.end();
  }
});

router.post("/interview/:token/end", async (req, res) => {
  try {
    const payload = verifyInviteToken(req.params.token);
    if (!payload) return void res.status(404).json({ error: "Invalid or expired token" });

    const { sessionId } = req.body;

    const sessions = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.candidateId, payload.candidateId))
      .limit(1);

    const session = sessions[0];
    if (!session) return void res.status(404).json({ error: "Session not found" });

    const endedAt = new Date();

    await db
      .update(interviewSessionsTable)
      .set({ endedAt })
      .where(eq(interviewSessionsTable.id, session.id));

    await db
      .update(candidatesTable)
      .set({ status: "completed", pipelineStage: "reviewing" })
      .where(eq(candidatesTable.id, payload.candidateId));

    triggerEvaluation(session.id, payload.candidateId).catch(err => {
      logger.error({ err }, "Evaluation failed");
    });

    res.json({
      sessionId: session.id,
      endedAt: endedAt.toISOString(),
      evaluationStatus: "processing",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to end interview");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function triggerEvaluation(sessionId: string, candidateId: string) {
  const sessions = await db
    .select()
    .from(interviewSessionsTable)
    .where(eq(interviewSessionsTable.id, sessionId))
    .limit(1);

  const session = sessions[0];
  if (!session) return;

  const candidates = await db
    .select()
    .from(candidatesTable)
    .where(eq(candidatesTable.id, candidateId))
    .limit(1);

  const candidate = candidates[0];
  if (!candidate) return;

  const processes = await db
    .select()
    .from(jobProcessesTable)
    .where(eq(jobProcessesTable.id, candidate.jobProcessId))
    .limit(1);

  const jobProcess = processes[0];
  if (!jobProcess) return;

  const criteria = await db
    .select()
    .from(evaluationCriteriaTable)
    .where(eq(evaluationCriteriaTable.jobProcessId, jobProcess.id));

  const transcript = (session.transcript ?? []) as Array<{ role: string; content: string }>;
  const transcriptText = transcript.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

  const criteriaText = criteria.length > 0
    ? criteria.map(c => `- ${c.name} (weight: ${c.weight}%)`).join("\n")
    : "- Analytical Reasoning (25%)\n- Communication (25%)\n- Technical Knowledge (25%)\n- Smart Use of Tools (25%)";

  const evaluatorSystemPrompt = `You are a senior recruitment evaluator. Assess the interview transcript against the provided criteria.
Score each criterion from 1 to 5 with specific justification grounded in evidence from the conversation.
Do not infer what was not said. Return only valid JSON in the specified format.`;

  const userPrompt = `Evaluate this interview for the ${jobProcess.title} role (${jobProcess.area}, ${jobProcess.seniority}).

EVALUATION CRITERIA:
${criteriaText}

TRANSCRIPT:
${transcriptText}

Return a JSON object in exactly this format:
{
  "overallScore": 0-100,
  "recommendation": "Strong Hire" or "Hire" or "No Hire" or "On the Fence",
  "criteriaScores": [
    {"name": "...", "score": 1-5, "max": 5, "weight": 25, "justification": "..."}
  ],
  "highlights": ["...", "..."],
  "redFlags": ["...", "..."],
  "summary": "..."
}`;

  const aiCfg = await getAIConfig();
  const evalResult = await completeChat(aiCfg, {
    systemPrompt: evaluatorSystemPrompt,
    userMessage: userPrompt,
  });

  await logTokenUsage({
    companyId: jobProcess.companyId,
    jobProcessId: jobProcess.id,
    candidateId: candidate.id,
    tokensInput: evalResult.tokensInput,
    tokensOutput: evalResult.tokensOutput,
  });

  const text = evalResult.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return;

  const evalData = JSON.parse(jsonMatch[0]);

  const criteriaWithWeights = evalData.criteriaScores.map((s: { name: string; score: number; max: number; weight?: number; justification: string }, i: number) => ({
    ...s,
    weight: criteria[i]?.weight ?? Math.round(100 / (evalData.criteriaScores.length || 4)),
    max: 5,
  }));

  await db.insert(evaluationsTable).values({
    candidateId: candidate.id,
    sessionId: session.id,
    overallScore: evalData.overallScore,
    recommendation: evalData.recommendation,
    criteriaScores: criteriaWithWeights,
    highlights: evalData.highlights ?? [],
    redFlags: evalData.redFlags ?? [],
    summary: evalData.summary ?? "",
  });

  await db
    .update(jobProcessesTable)
    .set({ candidatesEvaluated: sql`${jobProcessesTable.candidatesEvaluated} + 1` })
    .where(eq(jobProcessesTable.id, jobProcess.id));

  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, jobProcess.companyId))
    .limit(1);

  const company = companies[0];
  if (company?.hrContactEmail) {
    const replitDomains = (globalThis.process.env["REPLIT_DOMAINS"] ?? "").split(",").map((d: string) => d.trim()).filter(Boolean);
    const host = replitDomains[0] ?? "localhost";
    const protocol = replitDomains[0] ? "https" : "http";
    const candidateReportUrl = `${protocol}://${host}/candidates/${candidate.id}`;

    sendEmail({
      to: company.hrContactEmail,
      subject: `Evaluation ready: ${candidate.name} — ${jobProcess.title}`,
      html: buildEvaluationReadyEmail({
        hrEmail: company.hrContactEmail,
        candidateName: candidate.name,
        processTitle: jobProcess.title,
        overallScore: evalData.overallScore,
        recommendation: evalData.recommendation,
        candidateReportUrl,
        companyName: company.name,
      }),
    }).catch(() => {});
  }
}

export default router;
