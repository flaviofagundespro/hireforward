import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const systemConfigTable = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SystemConfig = typeof systemConfigTable.$inferSelect;
