import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  candidateId: text("candidate_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  transcript: jsonb("transcript").$type<Array<{ role: string; content: string; timestamp: string }>>().default([]),
});

export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true });
export type InsertInterviewSession = z.infer<typeof insertInterviewSessionSchema>;
export type InterviewSession = typeof interviewSessionsTable.$inferSelect;
