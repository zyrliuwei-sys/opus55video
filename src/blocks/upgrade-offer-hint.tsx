import { ArrowUpRight, Gift } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { pricingCatalog, TRIAL_PRODUCT_ID } from '@/config/pricing';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { useUpgradeOffer } from '@/hooks/use-upgrade-offer';

const trialAmount = `$${(pricingCatalog[TRIAL_PRODUCT_ID].priceInCents / 100).toFixed(2)}`;

/**
 * Reminds trial buyers that their trial counts toward a bigger pack.
 * Renders nothing unless the signed-in user can still use the upgrade.
 */
export function UpgradeOfferHint({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { data } = useUpgradeOffer();
  if (!data?.upgradeAvailable) return null;

  if (compact) {
    return (
      <Link
        href="/pricing"
        className={cn(
          'text-primary inline-flex items-center gap-1 text-xs hover:underline',
          className
        )}
      >
        <Gift className="size-3.5" />
        {m['studio.upgrade.chip']()}
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      className={cn(
        'border-primary/40 bg-primary/5 hover:bg-primary/10 flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors',
        className
      )}
    >
      <Gift className="text-primary mt-0.5 size-4 shrink-0" />
      <span className="flex-1">
        <span className="font-medium">
          {m['landing.pricing.upgrade_banner_title']({ amount: trialAmount })}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {m['studio.upgrade.description']()}
        </span>
      </span>
      <ArrowUpRight className="text-primary mt-0.5 size-4 shrink-0" />
    </Link>
  );
}
