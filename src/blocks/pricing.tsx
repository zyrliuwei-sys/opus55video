'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  CalendarClock,
  CircleUser,
  Clapperboard,
  Coins,
  Film,
  Gift,
  Image,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { imageCreditCost } from '@/config/image-generation';
import {
  PRICING_TIERS,
  pricingCatalog,
  pricingProductId,
  TRIAL_PRODUCT_ID,
  upgradeProductId,
  type PricingCycle,
  type PricingTier,
} from '@/config/pricing';
import { videoCreditCost } from '@/config/video-generation';
import { apiPost } from '@/lib/api-client';
import { currentPathWithQuery } from '@/lib/redirect';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import { useUpgradeOffer } from '@/hooks/use-upgrade-offer';
import {
  PaymentProviderModal,
  type PaymentProvider,
} from '@/components/payment-provider-modal';
import {
  PricingTable,
  type PricingGroup,
  type PricingPlan,
} from '@/components/pricing-table';

const TIER_COPY: Record<
  PricingTier,
  { name: () => string; desc: () => string }
> = {
  starter: {
    name: () => m['landing.pricing.tier.starter'](),
    desc: () => m['landing.pricing.tier.starter_desc'](),
  },
  pro: {
    name: () => m['landing.pricing.tier.pro'](),
    desc: () => m['landing.pricing.tier.pro_desc'](),
  },
  studio: {
    name: () => m['landing.pricing.tier.studio'](),
    desc: () => m['landing.pricing.tier.studio_desc'](),
  },
};

const CYCLE_FEATURE: Record<PricingCycle, () => string> = {
  onetime: () => m['landing.pricing.f_never_expire'](),
  monthly: () => m['landing.pricing.f_monthly'](),
  yearly: () => m['landing.pricing.f_yearly'](),
};

function formatUsd(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', {
    maximumFractionDigits: cents % 100 ? 2 : 0,
  })}`;
}

/** Turn a catalog product into a card; prices and credits come from the catalog. */
function buildPlan(tier: PricingTier, cycle: PricingCycle): PricingPlan {
  return planFromProduct(
    pricingCatalog[pricingProductId(tier, cycle)],
    cycle,
    TIER_COPY[tier],
    tier === 'pro',
    pricingCatalog[pricingProductId(tier, 'monthly')]
  );
}

/** One-per-account entry pack, shown first in the one-time tab. */
function buildTrialPlan(): PricingPlan {
  const plan = planFromProduct(pricingCatalog[TRIAL_PRODUCT_ID], 'onetime', {
    name: () => m['landing.pricing.tier.trial'](),
    desc: () => m['landing.pricing.tier.trial_desc'](),
  });
  plan.highlight = {
    icon: Gift,
    title: m['landing.pricing.trial_highlight_title'](),
    text: m['landing.pricing.trial_highlight_text']({
      amount: formatUsd(pricingCatalog[TRIAL_PRODUCT_ID].priceInCents),
    }),
  };
  plan.features.push({
    icon: CircleUser,
    label: m['landing.pricing.f_once_per_account'](),
  });
  plan.buttonText = m['landing.pricing.buy_trial']();
  return plan;
}

/** Trial buyers: a one-time pack for the price difference, full credits. */
function buildUpgradePlan(tier: PricingTier): PricingPlan {
  const plan = planFromProduct(
    pricingCatalog[upgradeProductId(tier)],
    'onetime',
    TIER_COPY[tier],
    tier === 'pro'
  );
  plan.originalPrice = formatUsd(
    pricingCatalog[pricingProductId(tier, 'onetime')].priceInCents
  );
  plan.priceNote = m['landing.pricing.upgrade_note']({
    amount: formatUsd(pricingCatalog[TRIAL_PRODUCT_ID].priceInCents),
  });
  plan.buttonText = m['landing.pricing.upgrade_button']();
  return plan;
}

function planFromProduct(
  product: (typeof pricingCatalog)[string],
  cycle: PricingCycle,
  copy: { name: () => string; desc: () => string },
  featured = false,
  monthly = product
): PricingPlan {
  const format = (n: number) => n.toLocaleString(getLocale());
  return {
    id: product.productId,
    name: copy.name(),
    description: copy.desc(),
    // Yearly plans show the monthly equivalent, rounded to whole dollars.
    price:
      cycle === 'yearly'
        ? formatUsd(Math.round(product.priceInCents / 12 / 100) * 100)
        : formatUsd(product.priceInCents),
    originalPrice:
      cycle === 'yearly' ? formatUsd(monthly.priceInCents) : undefined,
    priceNote:
      cycle === 'yearly'
        ? m['landing.pricing.billed_yearly']({
            price: formatUsd(product.priceInCents),
          })
        : undefined,
    interval:
      cycle === 'onetime' ? undefined : m['landing.pricing.per_month'](),
    featured,
    badge: featured ? m['landing.pricing.popular']() : undefined,
    features: [
      {
        icon: Coins,
        label: m['landing.pricing.f_credits']({
          credits: format(product.credits),
        }),
      },
      {
        icon: Clapperboard,
        label: m['landing.pricing.f_videos_720']({
          count: format(
            Math.floor(product.credits / videoCreditCost('720p', 5))
          ),
        }),
      },
      {
        icon: Film,
        label: m['landing.pricing.f_videos_480']({
          count: format(
            Math.floor(product.credits / videoCreditCost('480p', 5))
          ),
        }),
      },
      {
        icon: Image,
        label: m['landing.pricing.f_standard_images']({
          count: format(
            Math.floor(product.credits / imageCreditCost('medium', '1K'))
          ),
        }),
      },
      { icon: CalendarClock, label: CYCLE_FEATURE[cycle]() },
      { icon: RotateCcw, label: m['landing.pricing.f_refund']() },
    ],
    buttonText:
      cycle === 'onetime'
        ? m['landing.pricing.buy_pack']()
        : m['landing.pricing.subscribe'](),
    productId: product.productId,
    productName: product.productName,
    priceInCents: product.priceInCents,
    currency: product.currency,
    credits: product.credits,
    creditsValidDays: product.creditsValidDays,
    plan: product.plan
      ? {
          name: product.plan.name,
          interval: product.plan.interval,
          intervalCount: product.plan.intervalCount,
        }
      : undefined,
  };
}

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'paypal',
  'alipay',
  'wechat',
];

export function Pricing({ title }: { title?: string } = {}) {
  const router = useRouter();
  const { data: session } = useSession();

  const { data: configsData } = usePublicConfig();
  const configs = configsData ?? {};
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);

  const enabledProviders = useMemo<PaymentProvider[]>(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );

  const upgradeQuery = useUpgradeOffer();
  const trialPurchased = upgradeQuery.data?.trialPurchased ?? false;
  const upgradeAvailable = upgradeQuery.data?.upgradeAvailable ?? false;

  // One-time tab: trial buyers see difference pricing (once), and nobody who
  // already bought the trial is offered it again.
  function onetimePlans() {
    if (upgradeAvailable) return PRICING_TIERS.map(buildUpgradePlan);
    const packs = PRICING_TIERS.map((tier) => buildPlan(tier, 'onetime'));
    return trialPurchased ? packs : [buildTrialPlan(), ...packs];
  }

  const groups: PricingGroup[] = [
    { key: 'onetime', label: m['landing.pricing.onetime']() },
    { key: 'monthly', label: m['landing.pricing.monthly']() },
    { key: 'yearly', label: m['landing.pricing.yearly']() },
  ].map(({ key, label }) => ({
    key,
    label,
    plans:
      key === 'onetime'
        ? onetimePlans()
        : PRICING_TIERS.map((tier) => buildPlan(tier, key as PricingCycle)),
  }));

  const checkoutMutation = useMutation({
    mutationFn: ({
      plan,
      provider,
    }: {
      plan: PricingPlan;
      provider: PaymentProvider;
    }) =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: plan.productId,
        product_name: plan.productName || plan.name,
        plan_name: plan.plan?.name || plan.name,
        price: plan.priceInCents,
        currency: plan.currency || 'usd',
        type: plan.plan ? 'subscription' : 'one-time',
        description: plan.name,
        plan: plan.plan,
        credits: plan.credits,
        credits_valid_days: plan.creditsValidDays,
        payment_provider: provider,
        // Come back to the page the user paid from.
        redirect: currentPathWithQuery('/settings/billing'),
      }),
    onSuccess: (data) => {
      if (!data?.checkout_url) {
        toast.error('Checkout failed');
        setLoadingProvider(null);
        return;
      }
      window.location.href = data.checkout_url;
    },
    onError: (err: any) => {
      toast.error(
        err?.message === 'TRIAL_ALREADY_PURCHASED'
          ? m['landing.pricing.trial_used']()
          : err?.message === 'UPGRADE_NOT_AVAILABLE'
            ? m['landing.pricing.upgrade_unavailable']()
            : err?.message || 'Checkout failed'
      );
      setLoadingProvider(null);
    },
  });

  function startCheckout(plan: PricingPlan, provider: PaymentProvider) {
    setLoadingProvider(provider);
    checkoutMutation.mutate({ plan, provider });
  }

  async function handleCheckout(plan: PricingPlan) {
    if (!session?.user) {
      const callbackUrl = encodeURIComponent(currentPathWithQuery('/pricing'));
      router.push(`/sign-in?callbackUrl=${callbackUrl}`);
      return;
    }

    const selectEnabled = configs.select_payment_enabled === 'true';
    const defaultProvider = (configs.default_payment_provider ||
      enabledProviders[0] ||
      'stripe') as PaymentProvider;

    if (selectEnabled && enabledProviders.length > 1) {
      setPendingPlan(plan);
      setModalOpen(true);
      return;
    }

    await startCheckout(plan, defaultProvider);
  }

  function handleProviderSelect(provider: PaymentProvider) {
    if (!pendingPlan) return;
    startCheckout(pendingPlan, provider);
  }

  return (
    <section
      id="pricing"
      className="border-border border-t px-4 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-20 text-center">
          <h2 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {title ?? m['landing.pricing.title']()}
          </h2>
          <p className="text-muted-foreground mt-5">
            {m['landing.pricing.description']()}
          </p>
        </div>
        {upgradeAvailable && (
          <div className="border-primary/40 bg-primary/5 mx-auto mb-10 flex max-w-3xl items-start gap-4 rounded-2xl border p-5 text-left">
            <span className="bg-primary/15 text-primary grid size-10 shrink-0 place-items-center rounded-full">
              <Gift className="size-5" />
            </span>
            <div>
              <p className="font-medium">
                {m['landing.pricing.upgrade_banner_title']({
                  amount: formatUsd(
                    pricingCatalog[TRIAL_PRODUCT_ID].priceInCents
                  ),
                })}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {m['landing.pricing.upgrade_banner_desc']()}
              </p>
            </div>
          </div>
        )}
        <PricingTable groups={groups} onCheckout={handleCheckout} />
      </div>

      <PaymentProviderModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setPendingPlan(null);
            setLoadingProvider(null);
          }
        }}
        providers={enabledProviders.length ? enabledProviders : ['stripe']}
        loadingProvider={loadingProvider}
        onSelect={handleProviderSelect}
        planName={pendingPlan?.name}
        price={
          pendingPlan?.priceInCents != null
            ? formatUsd(pendingPlan.priceInCents)
            : pendingPlan?.price
        }
      />
    </section>
  );
}
