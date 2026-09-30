/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

/**
 * Site credits use EvoLink's unit: 1 credit = ¥0.1 ≈ $0.0147, so $1 ≈ 68.
 * One-time packs sell at exactly that rate; subscriptions add a bonus.
 */
export const CREDITS_PER_USD = 68;

export type PricingTier = 'starter' | 'pro' | 'studio';
export type PricingCycle = 'onetime' | 'monthly' | 'yearly';

export const PRICING_TIERS: PricingTier[] = ['starter', 'pro', 'studio'];
export const PRICING_CYCLES: PricingCycle[] = ['onetime', 'monthly', 'yearly'];

const TIER_NAMES: Record<PricingTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  studio: 'Studio',
};

/** Price in USD cents and credits granted, per tier and billing cycle. */
const TIER_PRICES: Record<
  PricingTier,
  Record<PricingCycle, { priceInCents: number; credits: number }>
> = {
  // One-time: exact EvoLink rate, credits never expire.
  // Monthly: ~10% bonus credits. Yearly: pay 10 months, get 12 months.
  starter: {
    onetime: { priceInCents: 1000, credits: 680 },
    monthly: { priceInCents: 1000, credits: 750 },
    yearly: { priceInCents: 10000, credits: 9000 },
  },
  pro: {
    onetime: { priceInCents: 3000, credits: 2040 },
    monthly: { priceInCents: 3000, credits: 2250 },
    yearly: { priceInCents: 30000, credits: 27000 },
  },
  studio: {
    onetime: { priceInCents: 10000, credits: 6800 },
    monthly: { priceInCents: 10000, credits: 7500 },
    yearly: { priceInCents: 100000, credits: 90000 },
  },
};

export function pricingProductId(tier: PricingTier, cycle: PricingCycle) {
  return `${tier}_${cycle}`;
}

function buildProduct(tier: PricingTier, cycle: PricingCycle): PricingProduct {
  const name = TIER_NAMES[tier];
  const { priceInCents, credits } = TIER_PRICES[tier][cycle];
  const productId = pricingProductId(tier, cycle);
  if (cycle === 'onetime') {
    return {
      productId,
      productName: name,
      planName: `${name} Pack`,
      description: `${name} credit pack`,
      type: PaymentType.ONE_TIME,
      priceInCents,
      currency: 'usd',
      credits,
    };
  }
  const yearly = cycle === 'yearly';
  return {
    productId,
    productName: name,
    planName: name,
    description: `${name} ${yearly ? 'Yearly' : 'Monthly'}`,
    type: PaymentType.SUBSCRIPTION,
    priceInCents,
    currency: 'usd',
    credits,
    // Subscription credits expire at the end of the billing period.
    creditsValidDays: yearly ? 365 : 30,
    plan: {
      name,
      interval: yearly ? PaymentInterval.YEAR : PaymentInterval.MONTH,
      intervalCount: 1,
    },
  };
}

/** Keys MUST match what the pricing UI sends as product_id. */
export const pricingCatalog: Record<string, PricingProduct> =
  Object.fromEntries(
    PRICING_TIERS.flatMap((tier) =>
      PRICING_CYCLES.map((cycle) => [
        pricingProductId(tier, cycle),
        buildProduct(tier, cycle),
      ])
    )
  );

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
