import { Router } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth, getOrCreateUser, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req);
    const email = auth.sessionClaims?.email as string ?? `${auth.userId}@unknown.com`;
    const user = await getOrCreateUser(auth.userId!, email);
    
    const companies = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, user.companyId))
      .limit(1);

    const company = companies[0];
    
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: company?.name ?? "Unknown Company",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
