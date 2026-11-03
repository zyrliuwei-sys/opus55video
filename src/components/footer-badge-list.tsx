import { getRouteApi } from '@tanstack/react-router';
import { DEFAULT_FOOTER_BADGES } from '@/features/footer-badges/defaults';
import { parseStoredFooterBadges } from '@/features/footer-badges/validation';

import { cn } from '@/lib/utils';
import { usePublicConfig } from '@/hooks/use-public-config';
import { FooterBadgeLink } from '@/components/footer-badge-link';

const rootRoute = getRouteApi('__root__');

export function FooterBadgeList({ className }: { className?: string }) {
  const { data } = usePublicConfig();
  const ssrStored = rootRoute.useLoaderData({ select: (d) => d.footerBadges });
  const stored = data ? data.footer_badges : (ssrStored ?? undefined);
  const badges =
    stored === undefined
      ? DEFAULT_FOOTER_BADGES
      : parseStoredFooterBadges(stored);

  if (badges.length === 0) return null;

  // Render the list twice so the -50% translate loops seamlessly.
  const loop = [...badges, ...badges];

  return (
    <div className={cn('footer-badge-marquee overflow-hidden', className)}>
      <div className="footer-badge-marquee-track flex w-max items-center">
        {loop.map((badge, i) => (
          <FooterBadgeLink
            key={`${i}:${badge.href}:${badge.src}`}
            badge={badge}
            hidden={i >= badges.length}
            className="inline-flex shrink-0 pr-3 opacity-70 transition-opacity hover:opacity-100"
            imageClassName="h-7 w-auto max-w-[160px] overflow-hidden object-contain text-[10px]"
          />
        ))}
      </div>
    </div>
  );
}
