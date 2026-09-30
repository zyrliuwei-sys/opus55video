import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  const navLinks = [
    { href: '/#explore', label: m['opus.nav.explore']() },
    { href: '/#tools', label: m['opus.nav.features']() },
    { href: '/create', label: m['opus.nav.create']() },
  ];

  return <SiteHeader navLinks={navLinks} logoAlt={envConfigs.app_name} />;
}
