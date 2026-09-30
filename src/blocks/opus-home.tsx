import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';

import { useSession } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { m } from '@/paraglide/messages.js';
import { Pricing } from '@/blocks/pricing';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';
import { SiteUserMenu } from '@/components/site-user-menu';

import '@/styles/opus-home.css';

const assets = {
  hero: '/imgs/generated/opus-hero-eclipse.jpg',
  train: '/imgs/generated/opus-showcase-train.jpg',
  dancer: '/imgs/generated/opus-showcase-dancer.jpg',
};

function Header() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <>
      <header className="opus-header">
        <Link href="/" className="opus-brand" aria-label={envConfigs.app_name}>
          <img src={envConfigs.app_logo} alt="" width={34} height={34} />
          <span>{envConfigs.app_name}</span>
        </Link>
        <nav
          className={open ? 'opus-nav opus-nav-open' : 'opus-nav'}
          aria-label="Main navigation"
        >
          <a href="#explore" onClick={() => setOpen(false)}>
            {m['opus.nav.explore']()}
          </a>
          <a href="#tools" onClick={() => setOpen(false)}>
            {m['opus.nav.features']()}
          </a>
          <a href="#workflow" onClick={() => setOpen(false)}>
            {m['opus.nav.workflow']()}
          </a>
          <a href="#pricing" onClick={() => setOpen(false)}>
            {m['opus.nav.pricing']()}
          </a>
        </nav>
        <div className="opus-header-actions">
          {user ? (
            <SiteUserMenu
              name={user.name || 'User'}
              email={user.email}
              image={user.image}
            />
          ) : (
            <Link href="/sign-in" className="opus-login">
              {m['opus.nav.signin']()}
            </Link>
          )}
          <Link href="/create" className="opus-header-cta">
            {m['opus.nav.start']()} <ArrowUpRight size={16} />
          </Link>
          <button
            type="button"
            className="opus-menu"
            aria-label={m['opus.nav.menu']()}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
    </>
  );
}

function Hero() {
  const [prompt, setPrompt] = useState('');
  const router = useRouter();

  return (
    <section id="explore" className="opus-hero">
      <div className="opus-hero-image">
        <img
          src={assets.hero}
          alt="Astronaut on a volcanic coast beneath an eclipse, an AI generated concept frame"
          width={1672}
          height={941}
          fetchPriority="high"
        />
      </div>
      <div className="opus-hero-shade" />
      <div className="opus-hero-content">
        <p className="opus-eyebrow">{m['opus.hero.kicker']()}</p>
        <h1>{m['opus.hero.title']()}</h1>
        <p className="opus-hero-description">{m['opus.hero.description']()}</p>
        <form
          className="opus-hero-prompt"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(`/create?prompt=${encodeURIComponent(prompt.trim())}`);
          }}
        >
          <label
            htmlFor="opus-hero-prompt-input"
            className="opus-hero-prompt-label"
          >
            {m['opus.hero.prompt_label']()}
          </label>
          <input
            id="opus-hero-prompt-input"
            type="text"
            maxLength={2500}
            autoComplete="off"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={m['opus.hero.prompt_placeholder']()}
          />
          <button type="submit" className="opus-button opus-button-primary">
            {m['opus.hero.prompt_cta']()} <ArrowUpRight size={20} />
          </button>
        </form>
        <p className="opus-hero-hint">{m['opus.hero.prompt_hint']()}</p>
      </div>
    </section>
  );
}

function Tools() {
  const tools = [
    {
      title: m['opus.tools.text.title'](),
      description: m['opus.tools.text.description'](),
    },
    {
      title: m['opus.tools.image.title'](),
      description: m['opus.tools.image.description'](),
    },
    {
      title: m['opus.tools.motion.title'](),
      description: m['opus.tools.motion.description'](),
    },
    {
      title: m['opus.tools.look.title'](),
      description: m['opus.tools.look.description'](),
    },
  ];
  return (
    <section id="tools" className="opus-section opus-tools">
      <div className="opus-section-heading">
        <div>
          <p className="opus-eyebrow">{m['opus.tools.kicker']()}</p>
          <h2>{m['opus.tools.title']()}</h2>
        </div>
        <p>{m['opus.tools.description']()}</p>
      </div>
      <div className="opus-tools-grid">
        {tools.map((tool) => (
          <Link href="/create" key={tool.title} className="opus-tool">
            <div className="opus-tool-info">
              <div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
              </div>
              <span className="opus-tool-arrow" aria-hidden="true">
                <ArrowUpRight size={22} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Showcase() {
  const frames = [
    {
      src: assets.train,
      title: m['opus.showcase.one'](),
      className: 'opus-scene-train',
      width: 1448,
      height: 1086,
    },
    {
      src: assets.dancer,
      title: m['opus.showcase.two'](),
      className: 'opus-scene-dancer',
      width: 886,
      height: 665,
    },
    {
      src: assets.hero,
      title: m['opus.showcase.three'](),
      className: 'opus-scene-eclipse',
      width: 1672,
      height: 941,
    },
  ];
  return (
    <section className="opus-section opus-showcase">
      <div className="opus-section-heading">
        <div>
          <h2>{m['opus.showcase.title']()}</h2>
        </div>
        <p>{m['opus.showcase.description']()}</p>
      </div>
      <div className="opus-scenes">
        {frames.map((frame) => (
          <div key={frame.title} className={`opus-scene ${frame.className}`}>
            <img
              src={frame.src}
              alt={frame.title}
              width={frame.width}
              height={frame.height}
              loading="lazy"
            />
            <div className="opus-scene-overlay">
              <h3>{frame.title}</h3>
            </div>
          </div>
        ))}
      </div>
      <p className="opus-concept-note">{m['opus.showcase.note']()}</p>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      title: m['opus.workflow.one.title'](),
      description: m['opus.workflow.one.description'](),
    },
    {
      title: m['opus.workflow.two.title'](),
      description: m['opus.workflow.two.description'](),
    },
    {
      title: m['opus.workflow.three.title'](),
      description: m['opus.workflow.three.description'](),
    },
  ];
  return (
    <section id="workflow" className="opus-section opus-workflow">
      <h2>{m['opus.workflow.title']()}</h2>
      <ol className="opus-steps">
        {steps.map((step, index) => (
          <li className="opus-step" key={step.title}>
            <span className="opus-step-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Story() {
  const uses = [
    {
      title: m['opus.story.use.one.title'](),
      description: m['opus.story.use.one.description'](),
    },
    {
      title: m['opus.story.use.two.title'](),
      description: m['opus.story.use.two.description'](),
    },
    {
      title: m['opus.story.use.three.title'](),
      description: m['opus.story.use.three.description'](),
    },
  ];
  const questions = [
    {
      question: m['opus.story.faq.one.question'](),
      answer: m['opus.story.faq.one.answer'](),
    },
    {
      question: m['opus.story.faq.two.question'](),
      answer: m['opus.story.faq.two.answer'](),
    },
    {
      question: m['opus.story.faq.three.question'](),
      answer: m['opus.story.faq.three.answer'](),
    },
    {
      question: m['opus.story.faq.four.question'](),
      answer: m['opus.story.faq.four.answer'](),
    },
    {
      question: m['opus.story.faq.five.question'](),
      answer: m['opus.story.faq.five.answer'](),
    },
  ];

  return (
    <section
      className="opus-section opus-story"
      aria-labelledby="opus-story-title"
    >
      <div className="opus-story-intro">
        <h2 id="opus-story-title">{m['opus.story.title']()}</h2>
        <div className="opus-story-copy">
          <p className="opus-story-lead">{m['opus.story.intro.one']()}</p>
          <div className="opus-story-copy-grid">
            <p>{m['opus.story.intro.two']()}</p>
            <p>{m['opus.story.intro.three']()}</p>
          </div>
          <p className="opus-story-note">{m['opus.story.intro.four']()}</p>
        </div>
      </div>

      <div className="opus-story-block">
        <h3>{m['opus.story.use.title']()}</h3>
        <div className="opus-story-rows">
          {uses.map((use) => (
            <article className="opus-story-row" key={use.title}>
              <h4>{use.title}</h4>
              <p>{use.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="opus-story-block opus-story-guide">
        <h3>{m['opus.story.guide.title']()}</h3>
        <dl className="opus-prompt-sheet">
          <div className="opus-sheet-row">
            <dt>{m['opus.story.guide.scene']()}</dt>
            <dd>{m['opus.story.guide.one']()}</dd>
          </div>
          <div className="opus-sheet-row">
            <dt>{m['opus.story.guide.camera']()}</dt>
            <dd>{m['opus.story.guide.two']()}</dd>
          </div>
          <div className="opus-sheet-row">
            <dt>{m['opus.story.guide.frame']()}</dt>
            <dd>{m['opus.story.guide.three']()}</dd>
          </div>
        </dl>
      </div>

      <div className="opus-story-block opus-story-faq">
        <h3>{m['opus.story.faq.title']()}</h3>
        <div className="opus-faq-list">
          {questions.map((item) => (
            <article className="opus-faq-item" key={item.question}>
              <h4>{item.question}</h4>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="opus-final-cta">
      <div>
        <p className="opus-eyebrow">OPUS / 55</p>
        <h2>{m['opus.cta.title']()}</h2>
        <p>{m['opus.cta.description']()}</p>
      </div>
      <Link href="/create" className="opus-button opus-button-dark">
        {m['opus.cta.button']()} <ArrowUpRight size={20} />
      </Link>
    </section>
  );
}

function Footer() {
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
        { label: m['opus.nav.explore'](), href: '/#explore' },
        { label: m['opus.nav.workflow'](), href: '/#workflow' },
        { label: m['opus.nav.pricing'](), href: '/pricing' },
      ],
    },
    {
      title: m['opus.footer.legal'](),
      links: [
        { label: m['opus.footer.privacy'](), href: '/privacy-policy' },
        { label: m['opus.footer.terms'](), href: '/terms-of-service' },
        {
          label: m['opus.footer.contact'](),
          href: 'mailto:support@opus55video.net',
        },
      ],
    },
  ];
  return (
    <div className="opus-footer">
      <SiteFooter tagline={m['opus.footer.tagline']()} columns={columns} />
    </div>
  );
}

export function OpusHome() {
  return (
    <div className="opus-home">
      <Header />
      <main>
        <Hero />
        <Tools />
        <Showcase />
        <Workflow />
        <Story />
        <div className="opus-pricing dark">
          <Pricing />
        </div>
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
