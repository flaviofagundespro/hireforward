import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sharedReportsTable = pgTable("shared_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  candidateId: text("candidate_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type SharedReport = typeof sharedReportsTable.$inferSelect;
