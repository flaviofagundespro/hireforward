import { Router } from "express";
import { requireAuth, getCompanyId } from "../../lib/auth";
import { db } from "@workspace/db";
import { companiesTable, tokenUsageTable, candidatesTable, jobProcessesTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";

const router = Router();

export const PLAN_LIMITS: Record<string, number> = {
  trial: 3,
  starter: 20,
  growth: 100,
  enterprise: 999999,
};

// GET /api/billing/status
router.get("/billing/status", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) return void res.status(404).json({ error: "Company not found" });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Count candidates invited this month for this company
    const candidateCountResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM ${candidatesTable} c
      JOIN ${jobProcessesTable} jp ON c.job_process_id = jp.id
      WHERE jp.company_id = ${companyId}
        AND c.created_at >= ${startOfMonth}
    `);
    const candidatesThisMonth = Number((candidateCountResult.rows[0] as { count: number })?.count ?? 0);

    // Token usage this month
    const tokenResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(tokens_input), 0)::bigint AS tokens_input,
        COALESCE(SUM(tokens_output), 0)::bigint AS tokens_output,
        COALESCE(SUM(cost_usd), 0)::float AS cost_usd
      FROM ${tokenUsageTable}
      WHERE company_id = ${companyId}
        AND created_at >= ${startOfMonth}
    `);
    const tokenRow = tokenResult.rows[0] as {
      tokens_input: string;
      tokens_output: string;
      cost_usd: number;
    };

    const plan = (company as { plan: string }).plan ?? "trial";
    const stripeCustomerId = (company as { stripe_customer_id?: string }).stripe_customer_id ?? null;
    const stripeSubscriptionId = (company as { stripe_subscription_id?: string }).stripe_subscription_id ?? null;

    let subscription: Record<string, unknown> | null = null;
    if (stripeSubscriptionId) {
      try {
        const stripeSubResult = await db.execute(sql`
          SELECT id, status, current_period_start, current_period_end, cancel_at_period_end
          FROM stripe.subscriptions
          WHERE id = ${stripeSubscriptionId}
          LIMIT 1
        `);
        if (stripeSubResult.rows.length > 0) {
          subscription = stripeSubResult.rows[0] as Record<string, unknown>;
        }
      } catch {
        // stripe schema may not exist yet
      }
    }

    res.json({
      plan,
      status: company.status,
      stripeCustomerId,
      stripeSubscriptionId,
      candidateLimit: PLAN_LIMITS[plan] ?? 3,
      usage: {
        candidatesThisMonth,
        tokensInputThisMonth: Number(tokenRow?.tokens_input ?? 0),
        tokensOutputThisMonth: Number(tokenRow?.tokens_output ?? 0),
        costUsdThisMonth: Number(tokenRow?.cost_usd ?? 0),
      },
      subscription,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get billing status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/billing/checkout — create Stripe checkout session
router.post("/billing/checkout", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const { priceId } = req.body as { priceId?: string };
    if (!priceId) return void res.status(400).json({ error: "priceId required" });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) return void res.status(404).json({ error: "Company not found" });

    const stripe = await getUncachableStripeClient();

    let stripeCustomerId = (company as { stripe_customer_id?: string }).stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: { companyId },
      });
      await db.execute(sql`
        UPDATE companies SET stripe_customer_id = ${customer.id} WHERE id = ${companyId}
      `);
      stripeCustomerId = customer.id;
    }

    const host = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${host}/settings/billing?success=1`,
      cancel_url: `${host}/settings/billing?canceled=1`,
      subscription_data: {
        metadata: { companyId },
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/billing/portal — create Stripe customer portal session
router.post("/billing/portal", requireAuth, async (req, res) => {
  try {
    const companyId = await getCompanyId(req);
    if (!companyId) return void res.status(401).json({ error: "Unauthorized" });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    const stripeCustomerId = (company as { stripe_customer_id?: string })?.stripe_customer_id;
    if (!stripeCustomerId) {
      return void res.status(400).json({ error: "No billing account found. Subscribe to a plan first." });
    }

    const stripe = await getUncachableStripeClient();
    const host = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${host}/settings/billing`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/billing/plans — list available Stripe plans with prices
router.get("/billing/plans", async (_req, res) => {
  try {
    const plansResult = await db.execute(sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.metadata AS product_metadata,
        pr.id AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC NULLS LAST
    `);

    const productsMap = new Map<string, Record<string, unknown>>();
    for (const row of plansResult.rows as Record<string, unknown>[]) {
      const productId = row.product_id as string;
      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          id: productId,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        (productsMap.get(productId)!.prices as unknown[]).push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }

    res.json({ plans: Array.from(productsMap.values()) });
  } catch {
    // Stripe schema may not be ready yet — return empty
    res.json({ plans: [] });
  }
});

export default router;
