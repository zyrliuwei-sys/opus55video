import { DEFAULT_FOOTER_BADGES } from '@/features/footer-badges/defaults';
import { parseStoredFooterBadges } from '@/features/footer-badges/validation';

import { cn } from '@/lib/utils';
import { usePublicConfig } from '@/hooks/use-public-config';

export function FooterBadgeList({ className }: { className?: string }) {
  const { data } = usePublicConfig();
  const badges =
    data?.footer_badges === undefined
      ? DEFAULT_FOOTER_BADGES
      : parseStoredFooterBadges(data.footer_badges);

  if (badges.length === 0) return null;

  // Render the list twice so the -50% translate loops seamlessly.
  const loop = [...badges, ...badges];

  return (
    <div className={cn('footer-badge-marquee overflow-hidden', className)}>
      <div className="footer-badge-marquee-track flex w-max items-center">
        {loop.map((badge, i) => (
          <a
            key={`${i}:${badge.href}:${badge.src}`}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-hidden={i >= badges.length || undefined}
            tabIndex={i >= badges.length ? -1 : undefined}
            className="inline-flex shrink-0 pr-3 opacity-70 transition-opacity hover:opacity-100"
          >
            <img
              src={badge.src}
              alt={badge.alt}
              width={badge.width ?? 250}
              height={badge.height}
              loading="lazy"
              className="h-7 w-auto max-w-[160px] overflow-hidden object-contain text-[10px]"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
