import { pgTable, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const actorTypeEnum = pgEnum("actor_type", ["admin", "system", "user"]);

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorType: actorTypeEnum("actor_type").notNull().default("admin"),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
