import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyStatusEnum = pgEnum("company_status", ["active", "inactive", "trial", "past_due", "suspended", "cancelled"]);

export const companiesTable = pgTable("companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  plan: text("plan").notNull().default("trial"),
  status: companyStatusEnum("status").notNull().default("trial"),
  website: text("website"),
  industry: text("industry"),
  companySize: text("company_size"),
  timezone: text("timezone"),
  interviewLanguage: text("interview_language").default("en"),
  hrContactName: text("hr_contact_name"),
  hrContactEmail: text("hr_contact_email"),
  hrContactPhone: text("hr_contact_phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
