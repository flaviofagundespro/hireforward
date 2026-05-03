import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "hireforward-secret-key";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow impersonation tokens as Bearer auth
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const imp = verifyImpersonationToken(token);
    if (imp) {
      next();
      return;
    }
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function getOrCreateUser(
  clerkUserId: string,
  email: string,
  companyId?: string
) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clerkUserId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId) {
    const [company] = await db
      .insert(companiesTable)
      .values({ name: email.split("@")[1] ?? "My Company" })
      .returning();
    resolvedCompanyId = company.id;
  }

  const inserted = await db
    .insert(usersTable)
    .values({ id: clerkUserId, email, companyId: resolvedCompanyId, role: "admin" })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) return inserted[0];

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clerkUserId))
    .limit(1);

  return user;
}

export async function getCompanyId(req: Request): Promise<string | null> {
  // Check for impersonation token in Bearer header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const imp = verifyImpersonationToken(token);
    if (imp) return imp.companyId;
  }

  // Check for x-impersonation-token header (legacy)
  const impToken = req.headers["x-impersonation-token"] as string | undefined;
  if (impToken) {
    const imp = verifyImpersonationToken(impToken);
    if (imp) return imp.companyId;
  }

  const auth = getAuth(req);
  if (!auth.userId) return null;

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, auth.userId))
    .limit(1);

  if (users.length === 0) {
    const email = auth.sessionClaims?.email as string ?? `${auth.userId}@unknown.com`;
    const user = await getOrCreateUser(auth.userId, email);
    return user.companyId;
  }

  return users[0].companyId;
}

export function generateInviteToken(candidateId: string, expiresHours = 72): string {
  return jwt.sign(
    { candidateId, type: "interview_invite" },
    JWT_SECRET,
    { expiresIn: `${expiresHours}h` }
  );
}

export function verifyInviteToken(token: string): { candidateId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { candidateId: string; type: string };
    if (payload.type !== "interview_invite") return null;
    return { candidateId: payload.candidateId };
  } catch {
    return null;
  }
}

export function generateAdminToken(): string {
  return jwt.sign({ type: "admin", role: "owner" }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { type: string };
    return payload.type === "admin";
  } catch {
    return false;
  }
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}

export function generateImpersonationToken(companyId: string): string {
  return jwt.sign({ type: "impersonation", companyId }, JWT_SECRET, { expiresIn: "4h" });
}

export function verifyImpersonationToken(token: string): { companyId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { type: string; companyId: string };
    if (payload.type !== "impersonation") return null;
    return { companyId: payload.companyId };
  } catch {
    return null;
  }
}
