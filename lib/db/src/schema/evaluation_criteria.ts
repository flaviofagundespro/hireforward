import { pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evaluationCriteriaTable = pgTable("evaluation_criteria", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobProcessId: text("job_process_id").notNull(),
  name: text("name").notNull(),
  weight: integer("weight").notNull().default(25),
  descriptors: jsonb("descriptors").$type<Record<string, string>>().default({}),
});

export const insertEvaluationCriterionSchema = createInsertSchema(evaluationCriteriaTable).omit({ id: true });
export type InsertEvaluationCriterion = z.infer<typeof insertEvaluationCriterionSchema>;
export type EvaluationCriterion = typeof evaluationCriteriaTable.$inferSelect;
