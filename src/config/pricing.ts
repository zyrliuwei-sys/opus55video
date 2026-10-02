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
 * Site credits use EvoLink's unit: 1 credit = ¥0.1 ≈ $0.0147, so $1 ≈ 68
 * credits at EvoLink's own rate.
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

/**
 * Price in USD cents and credits granted, per tier and billing cycle.
 *
 * Generations cost ~7× EvoLink list price (see image-/video-generation.ts);
 * bigger packs float that down as a volume discount. Effective multiples:
 * one-time 6.7× / 6.3× / 5.8×, monthly 5.1× / 4.8× / 4.5×,
 * yearly 4.3× / 4.0× / 3.8×. One-time packs are sized in whole 720p · 5s
 * clips (473 credits each): 3 / 8 / 22.
 */
const TIER_PRICES: Record<
  PricingTier,
  Record<PricingCycle, { priceInCents: number; credits: number }>
> = {
  // One-time: credits never expire.
  // Monthly: +30% credits over the one-time pack, so subscribing beats
  // buying the same pack every month. Yearly: monthly credits × 12, pay 10.
  starter: {
    onetime: { priceInCents: 1990, credits: 1420 },
    monthly: { priceInCents: 1990, credits: 1850 },
    yearly: { priceInCents: 19900, credits: 22200 },
  },
  pro: {
    onetime: { priceInCents: 4990, credits: 3800 },
    monthly: { priceInCents: 4990, credits: 4940 },
    yearly: { priceInCents: 49900, credits: 59280 },
  },
  studio: {
    onetime: { priceInCents: 12900, credits: 10500 },
    monthly: { priceInCents: 12900, credits: 13650 },
    yearly: { priceInCents: 129000, credits: 163800 },
  },
};

/**
 * Low-price entry pack, one per account (enforced at checkout). 480 credits
 * cover one 720p · 5s clip or two 480p · 5s clips; effective multiple 4.9×.
 */
export const TRIAL_PRODUCT_ID = 'trial_onetime';

const TRIAL_PRODUCT: PricingProduct = {
  productId: TRIAL_PRODUCT_ID,
  productName: 'Trial',
  planName: 'Trial Pack',
  description: 'Trial credit pack',
  type: PaymentType.ONE_TIME,
  priceInCents: 499,
  currency: 'usd',
  credits: 480,
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
export const pricingCatalog: Record<string, PricingProduct> = {
  [TRIAL_PRODUCT_ID]: TRIAL_PRODUCT,
  ...Object.fromEntries(
    PRICING_TIERS.flatMap((tier) =>
      PRICING_CYCLES.map((cycle) => [
        pricingProductId(tier, cycle),
        buildProduct(tier, cycle),
      ])
    )
  ),
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
