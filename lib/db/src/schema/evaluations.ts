import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evaluationsTable = pgTable("evaluations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  candidateId: text("candidate_id").notNull(),
  sessionId: text("session_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  recommendation: text("recommendation").notNull(),
  criteriaScores: jsonb("criteria_scores").$type<Array<{
    name: string;
    score: number;
    max: number;
    weight: number;
    justification: string;
  }>>().default([]),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  redFlags: jsonb("red_flags").$type<string[]>().default([]),
  summary: text("summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit({ id: true, createdAt: true });
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;
