import { getUncachableStripeClient } from './stripeClient.js';

const PLANS = [
  {
    name: 'Starter',
    description: 'Perfect for small teams starting to scale hiring.',
    monthlyPrice: 9900,
    metadata: {
      plan_key: 'starter',
      candidate_limit_monthly: '20',
      highlight: 'Up to 20 interviews/month',
    },
  },
  {
    name: 'Growth',
    description: 'For high-volume hiring teams moving fast.',
    monthlyPrice: 29900,
    metadata: {
      plan_key: 'growth',
      candidate_limit_monthly: '100',
      highlight: 'Up to 100 interviews/month',
    },
  },
  {
    name: 'Enterprise',
    description: 'Unlimited interviews, SSO, dedicated support.',
    monthlyPrice: null,
    metadata: {
      plan_key: 'enterprise',
      candidate_limit_monthly: '999999',
      highlight: 'Unlimited interviews',
    },
  },
];

async function seedProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Seeding HireForward plans in Stripe...\n');

    for (const plan of PLANS) {
      const existing = await stripe.products.search({
        query: `name:'${plan.name}' AND active:'true'`,
      });

      if (existing.data.length > 0) {
        console.log(`✓ ${plan.name} already exists (${existing.data[0].id})`);
        const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
        if (prices.data.length > 0) {
          console.log(`  Price: $${(prices.data[0].unit_amount ?? 0) / 100}/mo (${prices.data[0].id})`);
        }
        continue;
      }

      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      console.log(`Created product: ${product.name} (${product.id})`);

      if (plan.monthlyPrice !== null) {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.monthlyPrice,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { plan_key: plan.metadata.plan_key },
        });
        console.log(`  Price: $${plan.monthlyPrice / 100}/mo (${price.id})`);
      } else {
        console.log(`  No price created (Enterprise — custom pricing)`);
      }
    }

    console.log('\n✓ Done! Webhooks will sync products to your database.');
    console.log('Run the API server to sync via syncBackfill().');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error seeding products:', message);
    process.exit(1);
  }
}

seedProducts();
