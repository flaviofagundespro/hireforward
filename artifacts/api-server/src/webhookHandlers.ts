import Stripe from 'stripe';
import { getUncachableStripeClient, getStripeSync } from './stripeClient';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { sendEmail, buildPaymentFailedEmail } from './lib/email';
import { logger } from './lib/logger';

const VALID_PLAN_KEYS = new Set(['starter', 'growth', 'enterprise']);

interface CompanyRow {
  id: string;
  name: string;
  hr_contact_email: string | null;
  hr_contact_name: string | null;
  status: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getPlanKeyFromSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<string | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });
    const item = sub.items.data[0];
    if (!item) return null;
    const product = item.price.product as Stripe.Product;
    const key = product.metadata?.plan_key ?? null;
    return VALID_PLAN_KEYS.has(key ?? '') ? key : null;
  } catch (err) {
    logger.warn({ err, subscriptionId }, 'getPlanKeyFromSubscription failed');
    return null;
  }
}

async function getCompanyByCustomerId(customerId: string): Promise<CompanyRow | null> {
  const result = await db.execute(sql`
    SELECT id, name, hr_contact_email, hr_contact_name, status
    FROM companies WHERE stripe_customer_id = ${customerId} LIMIT 1
  `);
  return (result.rows[0] ?? null) as CompanyRow | null;
}

async function getCompanyBySubscriptionId(subscriptionId: string): Promise<CompanyRow | null> {
  const result = await db.execute(sql`
    SELECT id, name, hr_contact_email, hr_contact_name, status
    FROM companies WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1
  `);
  return (result.rows[0] ?? null) as CompanyRow | null;
}

// ─── main handler ─────────────────────────────────────────────────────────────

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).',
      );
    }

    // Step 1: Validate signature + sync Stripe data to stripe.* schema.
    // getStripeSync() fetches the webhook secret from the Replit connector;
    // processWebhook() re-validates the signature before syncing — any tampered
    // request is rejected here with a SignatureVerificationError.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Step 2: Parse event for business-logic dispatch.
    // We trust the payload at this point — signature was just verified above.
    let event: Stripe.Event;
    try {
      event = JSON.parse(payload.toString('utf8')) as Stripe.Event;
    } catch (err) {
      logger.warn({ err }, 'Failed to parse Stripe event JSON after sync');
      return;
    }

    // Step 3: Business-logic dispatch — failures are logged but not re-thrown
    // so we don't break webhook delivery (Stripe would retry endlessly otherwise).
    const stripe = await getUncachableStripeClient();
    await WebhookHandlers.dispatch(stripe, event);
  }

  // ─── dispatcher ─────────────────────────────────────────────────────────────

  private static async dispatch(stripe: Stripe, event: Stripe.Event): Promise<void> {
    logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await WebhookHandlers.onCheckoutCompleted(
            stripe,
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'customer.subscription.updated':
          await WebhookHandlers.onSubscriptionUpdated(
            stripe,
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await WebhookHandlers.onSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.payment_failed':
          await WebhookHandlers.onPaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        case 'invoice.payment_succeeded':
          await WebhookHandlers.onPaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        default:
          logger.info({ type: event.type }, 'Stripe event — no business-logic handler');
      }
    } catch (err) {
      // Log the error but return 200 to Stripe. We already synced the data;
      // failing here would cause Stripe to retry and re-sync unnecessarily.
      logger.error(
        { err, eventType: event.type, eventId: event.id },
        'Business-logic handler threw — event was synced, not retrying',
      );
    }
  }

  // ─── checkout.session.completed ─────────────────────────────────────────────
  // Fired when a customer completes Stripe Checkout. Activates the subscription
  // and writes the resolved plan to the company row.

  private static async onCheckoutCompleted(
    stripe: Stripe,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!customerId || !subscriptionId) {
      logger.warn({ sessionId: session.id }, 'checkout.session.completed: missing customer/subscription');
      return;
    }

    // Resolve company: check customer ID first, then fall back to metadata
    let company = await getCompanyByCustomerId(customerId);
    if (!company) {
      const companyId = session.metadata?.companyId;
      if (companyId) {
        const result = await db.execute(sql`
          SELECT id, name, hr_contact_email, hr_contact_name, status
          FROM companies WHERE id = ${companyId} LIMIT 1
        `);
        company = (result.rows[0] ?? null) as CompanyRow | null;
      }
    }

    if (!company) {
      logger.warn({ customerId, subscriptionId }, 'checkout.session.completed: company not found');
      return;
    }

    const planKey = await getPlanKeyFromSubscription(stripe, subscriptionId);

    await db.execute(sql`
      UPDATE companies
      SET
        stripe_customer_id    = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        plan   = ${planKey ?? 'starter'},
        status = 'active'
      WHERE id = ${company.id}
    `);

    logger.info(
      { companyId: company.id, plan: planKey, subscriptionId },
      'Subscription activated via checkout',
    );
  }

  // ─── customer.subscription.updated ──────────────────────────────────────────
  // Fired on plan changes, billing-cycle renewals, status changes, etc.
  // Keeps the company's plan and status in sync with Stripe.

  private static async onSubscriptionUpdated(
    stripe: Stripe,
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const company =
      (await getCompanyByCustomerId(customerId)) ??
      (await getCompanyBySubscriptionId(subscription.id));

    if (!company) {
      logger.warn(
        { customerId, subscriptionId: subscription.id },
        'subscription.updated: company not found',
      );
      return;
    }

    const planKey = await getPlanKeyFromSubscription(stripe, subscription.id);

    // Map Stripe subscription status → our company_status enum
    const newStatus: string =
      subscription.status === 'active'   ? 'active'    :
      subscription.status === 'past_due' ? 'past_due'  :
      subscription.status === 'canceled' ? 'cancelled' :
      subscription.status === 'unpaid'   ? 'suspended' : 'active';

    await db.execute(sql`
      UPDATE companies
      SET
        stripe_subscription_id = ${subscription.id},
        plan   = ${planKey ?? 'starter'},
        status = ${newStatus}
      WHERE id = ${company.id}
    `);

    logger.info(
      { companyId: company.id, plan: planKey, status: newStatus },
      'Subscription synced',
    );
  }

  // ─── customer.subscription.deleted ──────────────────────────────────────────
  // Fired when a subscription is fully cancelled (after all retries exhausted,
  // or immediate cancellation). Downgrades company to trial and enforces caps.

  private static async onSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const company =
      (await getCompanyByCustomerId(customerId)) ??
      (await getCompanyBySubscriptionId(subscription.id));

    if (!company) {
      logger.warn(
        { customerId, subscriptionId: subscription.id },
        'subscription.deleted: company not found',
      );
      return;
    }

    // Clear subscription, downgrade plan to trial, enforce caps immediately.
    // stripe_customer_id is kept so the portal still works.
    await db.execute(sql`
      UPDATE companies
      SET
        stripe_subscription_id = NULL,
        plan   = 'trial',
        status = 'trial'
      WHERE id = ${company.id}
    `);

    logger.info(
      { companyId: company.id },
      'Subscription cancelled — company downgraded to trial',
    );
  }

  // ─── invoice.payment_failed ──────────────────────────────────────────────────
  // Fired when a payment attempt fails. Flags the company past_due and sends
  // a warning email to the HR contact so they can update their card.

  private static async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const company = await getCompanyByCustomerId(customerId);
    if (!company) {
      logger.warn({ customerId }, 'invoice.payment_failed: company not found');
      return;
    }

    await db.execute(sql`
      UPDATE companies SET status = 'past_due' WHERE id = ${company.id}
    `);

    const recipient = company.hr_contact_email;
    if (recipient) {
      await sendEmail({
        to: recipient,
        subject: '⚠️ Payment failed — action required for your HireForward account',
        html: buildPaymentFailedEmail({
          companyName: company.name,
          hrContactName: company.hr_contact_name ?? undefined,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          invoiceUrl: invoice.hosted_invoice_url ?? null,
        }),
      });
      logger.info({ companyId: company.id, recipient }, 'Payment-failed email sent');
    }

    logger.info(
      { companyId: company.id },
      'invoice.payment_failed — company status set to past_due',
    );
  }

  // ─── invoice.payment_succeeded ───────────────────────────────────────────────
  // Fired on every successful charge (new subscriptions, renewals). Clears any
  // past_due flag so the account is fully active again.

  private static async onPaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const company = await getCompanyByCustomerId(customerId);
    if (!company) return;

    // Only restore to active if currently past_due — don't overwrite trial.
    if (company.status === 'past_due' || company.status === 'suspended') {
      await db.execute(sql`
        UPDATE companies SET status = 'active'
        WHERE id = ${company.id}
      `);
      logger.info(
        { companyId: company.id },
        'invoice.payment_succeeded — company restored to active',
      );
    }
  }
}
