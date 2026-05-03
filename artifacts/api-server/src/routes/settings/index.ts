import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (companies.length === 0) return void res.status(404).json({ error: "Company not found" });

    const company = companies[0];
    res.json({
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      plan: company.plan,
      status: company.status,
      createdAt: company.createdAt.toISOString(),
      website: company.website ?? null,
      industry: company.industry ?? null,
      companySize: company.companySize ?? null,
      timezone: company.timezone ?? null,
      interviewLanguage: company.interviewLanguage ?? "en",
      hrContactName: company.hrContactName ?? null,
      hrContactEmail: company.hrContactEmail ?? null,
      hrContactPhone: company.hrContactPhone ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get company settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const {
      name,
      logoUrl,
      plan,
      website,
      industry,
      companySize,
      timezone,
      interviewLanguage,
      hrContactName,
      hrContactEmail,
      hrContactPhone,
    } = req.body;

    const VALID_PLANS = ["trial", "starter", "growth", "enterprise"];
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (plan !== undefined && VALID_PLANS.includes(plan)) updateData.plan = plan;
    if (website !== undefined) updateData.website = website;
    if (industry !== undefined) updateData.industry = industry;
    if (companySize !== undefined) updateData.companySize = companySize;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (interviewLanguage !== undefined) updateData.interviewLanguage = interviewLanguage;
    if (hrContactName !== undefined) updateData.hrContactName = hrContactName;
    if (hrContactEmail !== undefined) updateData.hrContactEmail = hrContactEmail;
    if (hrContactPhone !== undefined) updateData.hrContactPhone = hrContactPhone;

    const [updated] = await db
      .update(companiesTable)
      .set(updateData)
      .where(eq(companiesTable.id, companyId))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      logoUrl: updated.logoUrl ?? null,
      plan: updated.plan,
      status: updated.status,
      website: updated.website ?? null,
      industry: updated.industry ?? null,
      companySize: updated.companySize ?? null,
      timezone: updated.timezone ?? null,
      interviewLanguage: updated.interviewLanguage ?? "en",
      hrContactName: updated.hrContactName ?? null,
      hrContactEmail: updated.hrContactEmail ?? null,
      hrContactPhone: updated.hrContactPhone ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update company settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
