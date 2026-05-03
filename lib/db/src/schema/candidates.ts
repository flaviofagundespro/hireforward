import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidateStatusEnum = pgEnum("candidate_status", ["invited", "started", "completed", "expired"]);

export const candidatesTable = pgTable("candidates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobProcessId: text("job_process_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: candidateStatusEnum("status").notNull().default("invited"),
  inviteToken: text("invite_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({ id: true, createdAt: true });
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
