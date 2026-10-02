import { m } from '@/paraglide/messages.js';
import { FooterBadgeList } from '@/components/footer-badge-list';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';

export function Footer() {
  const columns: FooterColumn[] = [
    {
      title: m['opus.footer.product'](),
      links: [
        { label: m['opus.nav.create'](), href: '/create' },
        { label: m['opus.nav.features'](), href: '/#tools' },
      ],
    },
    {
      title: m['opus.footer.company'](),
      links: [
        {
          label: 'support@opus55video.net',
          href: 'mailto:support@opus55video.net',
        },
      ],
    },
    {
      title: m['opus.footer.legal'](),
      links: [
        { label: m['opus.footer.privacy'](), href: '/privacy-policy' },
        { label: m['opus.footer.terms'](), href: '/terms-of-service' },
      ],
    },
  ];

  return (
    <SiteFooter
      tagline={m['opus.footer.tagline']()}
      columns={columns}
      badges={<FooterBadgeList className="mt-5" />}
    />
  );
}
