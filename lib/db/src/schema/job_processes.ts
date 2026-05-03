import { pgTable, text, timestamp, boolean, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const processStatusEnum = pgEnum("process_status", ["draft", "active", "paused", "closed"]);
export const interviewTypeEnum = pgEnum("interview_type", ["technical", "behavioral", "hybrid"]);

export const jobProcessesTable = pgTable("job_processes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  title: text("title").notNull(),
  area: text("area").notNull(),
  seniority: text("seniority").notNull(),
  status: processStatusEnum("status").notNull().default("draft"),
  interviewType: interviewTypeEnum("interview_type").notNull().default("hybrid"),
  toolsAllowed: boolean("tools_allowed").notNull().default(true),
  agentSystemPrompt: text("agent_system_prompt"),
  configMessages: jsonb("config_messages").$type<Array<{ role: string; content: string }>>().default([]),
  candidatesTotal: integer("candidates_total").notNull().default(0),
  candidatesEvaluated: integer("candidates_evaluated").notNull().default(0),
  managerViewToken: text("manager_view_token").unique(),
  responseTimeLimitSeconds: integer("response_time_limit_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobProcessSchema = createInsertSchema(jobProcessesTable).omit({ id: true, createdAt: true, candidatesTotal: true, candidatesEvaluated: true });
export type InsertJobProcess = z.infer<typeof insertJobProcessSchema>;
export type JobProcess = typeof jobProcessesTable.$inferSelect;
