import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { OpusHome } from '@/blocks/opus-home';

// Same questions as the FAQ section in OpusHome, for FAQPage rich results.
const FAQ = [
  [m['opus.story.faq.one.question'], m['opus.story.faq.one.answer']],
  [m['opus.story.faq.two.question'], m['opus.story.faq.two.answer']],
  [m['opus.story.faq.three.question'], m['opus.story.faq.three.answer']],
  [m['opus.story.faq.four.question'], m['opus.story.faq.four.answer']],
  [m['opus.story.faq.five.question'], m['opus.story.faq.five.answer']],
] as const;

export const Route = createFileRoute('/')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const title = m['common.metadata.title']({}, { locale: locale as any });
    const description = m['common.metadata.description'](
      {},
      { locale: locale as any }
    );
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: urlFor(locale) },
        { property: 'og:site_name', content: envConfigs.app_name },
        {
          property: 'og:image',
          content: `${envConfigs.app_url}/imgs/generated/opus-hero-eclipse.jpg`,
        },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': `${envConfigs.app_url}/#organization`,
                name: envConfigs.app_name,
                url: `${envConfigs.app_url}/`,
                logo: `${envConfigs.app_url}${envConfigs.app_logo}`,
              },
              {
                '@type': 'WebSite',
                '@id': `${envConfigs.app_url}/#website`,
                name: envConfigs.app_name,
                url: `${envConfigs.app_url}/`,
                publisher: { '@id': `${envConfigs.app_url}/#organization` },
                inLanguage: locale,
              },
              {
                '@type': 'WebPage',
                name: title,
                description,
                url: urlFor(locale),
                inLanguage: locale,
                isPartOf: { '@id': `${envConfigs.app_url}/#website` },
                primaryImageOfPage: `${envConfigs.app_url}/imgs/generated/opus-hero-eclipse.jpg`,
              },
              {
                '@type': 'FAQPage',
                mainEntity: FAQ.map(([question, answer]) => ({
                  '@type': 'Question',
                  name: question({}, { locale: locale as any }),
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: answer({}, { locale: locale as any }),
                  },
                })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: OpusHome,
});
