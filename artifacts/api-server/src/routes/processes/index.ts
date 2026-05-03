import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { jobProcessesTable, evaluationCriteriaTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logTokenUsage } from "../../lib/token-logger";
import { CreateProcessBody, UpdateProcessBody, ConfigureProcessMessageBody } from "@workspace/api-zod";

const router = Router();

router.get("/processes", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(eq(jobProcessesTable.companyId, companyId));

    res.json(processes);
  } catch (err) {
    req.log.error({ err }, "Failed to list processes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/processes", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const parsed = CreateProcessBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

    const [process] = await db
      .insert(jobProcessesTable)
      .values({
        companyId,
        title: parsed.data.title,
        area: parsed.data.area,
        seniority: parsed.data.seniority,
        interviewType: parsed.data.interviewType ?? "hybrid",
        toolsAllowed: parsed.data.toolsAllowed ?? true,
        status: "draft",
      })
      .returning();

    res.status(201).json(process);
  } catch (err) {
    req.log.error({ err }, "Failed to create process");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/processes/:id", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Not found" });

    const criteria = await db
      .select()
      .from(evaluationCriteriaTable)
      .where(eq(evaluationCriteriaTable.jobProcessId, String(req.params.id)));

    res.json({ ...processes[0], criteria });
  } catch (err) {
    req.log.error({ err }, "Failed to get process");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/processes/:id", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const parsed = UpdateProcessBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

    const [updated] = await db
      .update(jobProcessesTable)
      .set(parsed.data)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update process");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/processes/:id", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    await db
      .delete(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete process");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/processes/:id/duplicate", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const originals = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (originals.length === 0) return void res.status(404).json({ error: "Not found" });
    const orig = originals[0];

    const [duplicate] = await db
      .insert(jobProcessesTable)
      .values({
        companyId,
        title: `${orig.title} (Copy)`,
        area: orig.area,
        seniority: orig.seniority,
        interviewType: orig.interviewType,
        toolsAllowed: orig.toolsAllowed,
        agentSystemPrompt: orig.agentSystemPrompt,
        configMessages: orig.configMessages ?? [],
        status: "draft",
      })
      .returning();

    const criteria = await db
      .select()
      .from(evaluationCriteriaTable)
      .where(eq(evaluationCriteriaTable.jobProcessId, String(req.params.id)));

    if (criteria.length > 0) {
      await db.insert(evaluationCriteriaTable).values(
        criteria.map(c => ({
          jobProcessId: duplicate.id,
          name: c.name,
          weight: c.weight,
          descriptors: c.descriptors ?? {},
        }))
      );
    }

    res.status(201).json(duplicate);
  } catch (err) {
    req.log.error({ err }, "Failed to duplicate process");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CONFIGURATOR_SYSTEM_PROMPT = `You are a specialist assistant for configuring AI-conducted recruitment processes.
Help the HR team set up the interview process by asking about:
1. The most important skills and competencies for the role
2. Whether the candidate may use AI tools and the internet (default: yes)
3. Preferred interview type (technical, behavioral, or hybrid)
4. Whether to simulate real company scenarios
5. Any specific evaluation criteria

Once you have enough information, automatically generate:
- A system prompt for the AI interviewer agent
- An evaluation rubric with criteria, weights, and descriptors from 1 to 5

When you have sufficient information to produce the final configuration, append the following JSON block at the end of your response — exactly in this format:
<CONFIG_JSON>
{
  "systemPrompt": "...",
  "criteria": [
    {"name": "...", "weight": 30, "descriptors": {"1": "...", "3": "...", "5": "..."}}
  ]
}
</CONFIG_JSON>`;

router.post("/processes/:id/configure", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Not found" });
    const process = processes[0];

    const parsed = ConfigureProcessMessageBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

    const existingMessages = (process.configMessages ?? []) as Array<{ role: string; content: string }>;
    const newMessages = [
      ...existingMessages,
      { role: "user", content: parsed.data.content }
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: CONFIGURATOR_SYSTEM_PROMPT + `\n\nProcess context:\nRole: ${process.title}\nArea: ${process.area}\nSeniority: ${process.seniority}\nType: ${process.interviewType}`,
      messages: newMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    const finalMsg = await stream.finalMessage();
    const usage = finalMsg.usage;

    await logTokenUsage({
      companyId,
      jobProcessId: process.id,
      tokensInput: usage.input_tokens,
      tokensOutput: usage.output_tokens,
    });

    const updatedMessages = [...newMessages, { role: "assistant", content: fullResponse }];
    await db
      .update(jobProcessesTable)
      .set({ configMessages: updatedMessages })
      .where(eq(jobProcessesTable.id, process.id));

    const configMatch = fullResponse.match(/<CONFIG_JSON>([\s\S]*?)<\/CONFIG_JSON>/);
    if (configMatch) {
      try {
        const config = JSON.parse(configMatch[1].trim());
        await db
          .update(jobProcessesTable)
          .set({ agentSystemPrompt: config.systemPrompt })
          .where(eq(jobProcessesTable.id, process.id));

        await db.delete(evaluationCriteriaTable).where(eq(evaluationCriteriaTable.jobProcessId, process.id));
        if (config.criteria?.length > 0) {
          await db.insert(evaluationCriteriaTable).values(
            config.criteria.map((c: { name: string; weight: number; descriptors: Record<string, string> }) => ({
              jobProcessId: process.id,
              name: c.name,
              weight: c.weight,
              descriptors: c.descriptors ?? {},
            }))
          );
        }
      } catch { /* ignore parse errors */ }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to configure process");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    else res.end();
  }
});

router.put("/processes/:id/criteria", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const processes = await db
      .select()
      .from(jobProcessesTable)
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .limit(1);

    if (processes.length === 0) return void res.status(404).json({ error: "Not found" });

    const { criteria } = req.body as {
      criteria: Array<{ name: string; weight: number; descriptors?: Record<string, string> }>;
    };

    if (!Array.isArray(criteria)) return void res.status(400).json({ error: "criteria must be an array" });

    await db.delete(evaluationCriteriaTable).where(eq(evaluationCriteriaTable.jobProcessId, String(req.params.id)));

    let inserted: typeof evaluationCriteriaTable.$inferSelect[] = [];
    if (criteria.length > 0) {
      inserted = await db.insert(evaluationCriteriaTable).values(
        criteria.map(c => ({
          jobProcessId: String(req.params.id),
          name: c.name,
          weight: c.weight ?? 25,
          descriptors: c.descriptors ?? {},
        }))
      ).returning();
    }

    res.json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to update criteria");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/processes/:id/finalize-config", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const [updated] = await db
      .update(jobProcessesTable)
      .set({ status: "active" })
      .where(and(eq(jobProcessesTable.id, String(req.params.id)), eq(jobProcessesTable.companyId, companyId)))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Not found" });

    const criteria = await db
      .select()
      .from(evaluationCriteriaTable)
      .where(eq(evaluationCriteriaTable.jobProcessId, String(req.params.id)));

    res.json({ ...updated, criteria, configMessages: updated.configMessages ?? [] });
  } catch (err) {
    req.log.error({ err }, "Failed to finalize process config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
