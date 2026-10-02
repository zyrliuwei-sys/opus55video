import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  Clapperboard,
  Coins,
  ImageIcon,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import {
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  IMAGE_SIZES,
  imageCreditCost,
  type ImageQuality,
  type ImageResolution,
  type ImageSize,
} from '@/config/image-generation';
import { type VideoMode } from '@/config/video-generation';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import { currentPathWithQuery } from '@/lib/redirect';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { LocaleSelector } from '@/components/locale-selector';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { VideoStudio } from './-video-studio';

import '@/styles/opus-studio.css';

type ImageTask = {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  costCredits: number;
  size: ImageSize | null;
  images: string[];
  error: string | null;
};
type StudioData = {
  configured: boolean;
  signedIn: boolean;
  balance: number;
  tasks: ImageTask[];
};

const schema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  size: z.enum(IMAGE_SIZES),
  resolution: z.enum(IMAGE_RESOLUTIONS),
  quality: z.enum(IMAGE_QUALITIES),
});

const SIZE_LABELS: Record<ImageSize, () => string> = {
  '1:1': () => m['studio.square'](),
  '16:9': () => m['studio.landscape'](),
  '9:16': () => m['studio.portrait'](),
  '4:3': () => m['studio.landscape'](),
  '3:4': () => m['studio.portrait'](),
};

const QUALITY_LABELS: Record<ImageQuality, () => string> = {
  low: () => m['studio.image.quality_low'](),
  medium: () => m['studio.image.quality_medium'](),
  high: () => m['studio.image.quality_high'](),
};

/** Tailwind aspect-ratio classes so pending cards match the final image. */
const ASPECT_CLASS: Record<ImageSize, string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
};

const selectClass =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm';

function ImageStudio({
  initialPrompt,
  signInHref,
}: {
  initialPrompt?: string;
  signInHref: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['image-studio'],
    queryFn: () => apiGet<StudioData>('/api/ai/images'),
    refetchInterval: (query) =>
      query.state.data?.tasks.some(
        (task) => task.status === 'pending' || task.status === 'processing'
      )
        ? 5_000
        : false,
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      apiPost('/api/ai/images', values),
    onSuccess: () => {
      toast.success(m['studio.image.submitted']());
      queryClient.invalidateQueries({ queryKey: ['image-studio'] });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError && error.message === 'INSUFFICIENT_CREDITS'
          ? m['studio.image.insufficient']()
          : error.message
      );
      queryClient.invalidateQueries({ queryKey: ['image-studio'] });
    },
  });
  const form = useForm({
    defaultValues: {
      prompt: initialPrompt ?? '',
      size: '16:9',
      resolution: '1K',
      quality: 'medium',
    } as z.infer<typeof schema>,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => create.mutateAsync(value),
  });

  const configured = query.data?.configured ?? false;
  const signedIn = query.data?.signedIn ?? false;
  const balance = query.data?.balance ?? 0;
  const tasks = query.data?.tasks ?? [];

  return (
    <>
      <div className="opus-studio-grid grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="opus-studio-form-card border-border/70 bg-card/80 overflow-hidden">
          <CardContent className="space-y-7 p-5 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-sm">
                  <ImageIcon className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    {m['studio.image.create_title']()}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {m['studio.image.model']()}
                  </p>
                </div>
              </div>
              {signedIn && (
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
                >
                  <Coins className="size-3.5" />
                  {m['studio.image.balance']({ credits: balance })}
                </Link>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
              }}
              className="opus-studio-form space-y-6"
            >
              <form.Field name="prompt">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="image-prompt">
                      {m['studio.image.prompt_label']()}
                    </Label>
                    <Textarea
                      id="image-prompt"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      rows={7}
                      maxLength={4000}
                      className="opus-studio-prompt min-h-44 resize-y text-base leading-relaxed"
                      placeholder={m['studio.image.prompt_placeholder']()}
                    />
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>{m['studio.image.prompt_hint']()}</span>
                      <span>{field.state.value.length}/4000</span>
                    </div>
                  </div>
                )}
              </form.Field>

              <div className="grid gap-5 sm:grid-cols-3">
                <form.Field name="size">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="image-size">
                        {m['studio.ratio_label']()}
                      </Label>
                      <select
                        id="image-size"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as ImageSize)
                        }
                        className={selectClass}
                      >
                        {IMAGE_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size} · {SIZE_LABELS[size]()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="resolution">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="image-resolution">
                        {m['studio.image.resolution_label']()}
                      </Label>
                      <select
                        id="image-resolution"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value as ImageResolution
                          )
                        }
                        className={selectClass}
                      >
                        {IMAGE_RESOLUTIONS.map((resolution) => (
                          <option key={resolution} value={resolution}>
                            {resolution}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="quality">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="image-quality">
                        {m['studio.image.quality_label']()}
                      </Label>
                      <select
                        id="image-quality"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as ImageQuality)
                        }
                        className={selectClass}
                      >
                        {IMAGE_QUALITIES.map((quality) => (
                          <option key={quality} value={quality}>
                            {QUALITY_LABELS[quality]()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
              </div>

              {query.isError && (
                <p className="text-destructive text-sm">
                  {m['studio.load_error']()}
                </p>
              )}

              <form.Subscribe
                selector={(state) =>
                  [
                    state.values.quality,
                    state.values.resolution,
                    state.canSubmit,
                    state.isSubmitting,
                  ] as const
                }
              >
                {([quality, resolution, canSubmit, isSubmitting]) => {
                  const cost = imageCreditCost(quality, resolution);
                  const busy = isSubmitting || create.isPending;
                  const short = signedIn && balance < cost;
                  return (
                    <div className="space-y-3">
                      <div className="text-muted-foreground flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="text-primary size-4" />
                          {m['studio.image.cost']({ credits: cost })}
                        </span>
                        {short && (
                          <span className="text-destructive text-xs">
                            {m['studio.image.insufficient']()}
                          </span>
                        )}
                      </div>
                      {!query.isLoading && !signedIn ? (
                        <Link
                          href={signInHref}
                          className={cn(
                            buttonVariants({ size: 'lg' }),
                            'opus-studio-submit w-full gap-2'
                          )}
                        >
                          {m['studio.image.sign_in']()}
                          <ArrowUpRight className="size-4" />
                        </Link>
                      ) : short ? (
                        <Link
                          href="/pricing"
                          className={cn(
                            buttonVariants({ size: 'lg' }),
                            'opus-studio-submit w-full gap-2'
                          )}
                        >
                          <Coins className="size-4" />
                          {m['studio.image.buy_credits']()}
                        </Link>
                      ) : (
                        <Button
                          type="submit"
                          size="lg"
                          className="opus-studio-submit w-full gap-2"
                          disabled={!configured || !canSubmit || busy}
                        >
                          {busy ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <ImageIcon className="size-4" />
                          )}
                          {busy
                            ? m['studio.submitting']()
                            : m['studio.image.generate']()}
                        </Button>
                      )}
                    </div>
                  );
                }}
              </form.Subscribe>
            </form>
          </CardContent>
        </Card>

        <Card className="opus-studio-note border-border/70 bg-card/60">
          <CardContent className="flex h-full min-h-80 flex-col justify-between gap-10 p-6 md:p-8">
            <div className="space-y-6">
              <img
                src="/imgs/generated/opus-showcase-dancer.jpg"
                alt="A cinematic dance concept frame created for opus55video"
                className="opus-studio-note-image"
                loading="lazy"
              />
              <div className="space-y-2">
                <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                  {m['studio.how_title']()}
                </p>
                <h3 className="text-xl font-semibold">
                  {m['studio.how_heading']()}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {m['studio.image.how_description']()}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground border-t pt-4 text-xs">
              {m['studio.image.cost_note']()}
            </p>
          </CardContent>
        </Card>
      </div>

      <section id="history" className="opus-studio-history space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {m['studio.history_title']()}
            </h2>
            <p className="text-muted-foreground text-sm">
              {m['studio.image.history_description']()}
            </p>
          </div>
          {tasks.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
              {m['studio.refresh']()}
            </Button>
          )}
        </div>
        {tasks.length === 0 ? (
          <div className="opus-studio-empty text-muted-foreground rounded-xl border border-dashed px-5 py-12 text-center text-sm">
            {query.isLoading
              ? m['studio.image.loading']()
              : m['studio.image.empty']()}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tasks.map((task) => {
              const image = task.images[0];
              const inFlight =
                task.status === 'pending' || task.status === 'processing';
              return (
                <Card
                  key={task.id}
                  className="opus-studio-task overflow-hidden p-0"
                >
                  {image ? (
                    <a href={image} target="_blank" rel="noopener noreferrer">
                      <img
                        src={image}
                        alt={task.prompt}
                        loading="lazy"
                        className="bg-muted w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div
                      className={cn(
                        'bg-muted grid place-items-center',
                        ASPECT_CLASS[task.size ?? '1:1']
                      )}
                    >
                      {inFlight ? (
                        <LoaderCircle className="text-muted-foreground/60 size-8 animate-spin" />
                      ) : (
                        <ImageIcon className="text-muted-foreground/50 size-8" />
                      )}
                    </div>
                  )}
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          task.status === 'success'
                            ? 'default'
                            : task.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {task.status === 'success'
                          ? m['studio.status_success']()
                          : task.status === 'failed'
                            ? m['studio.status_failed']()
                            : task.status === 'processing'
                              ? m['studio.status_processing']()
                              : m['studio.status_pending']()}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {task.costCredits} {m['studio.image.credits_unit']()} ·{' '}
                        {new Date(task.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm">{task.prompt}</p>
                    {task.error && (
                      <p className="text-destructive text-xs">{task.error}</p>
                    )}
                    {image && (
                      <a
                        href={image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        {m['studio.image.open_image']()}{' '}
                        <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

type StudioMode = 'video' | 'image';

function StudioPage() {
  const { prompt, mode = 'video', input } = Route.useSearch();
  const navigate = Route.useNavigate();
  const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(
    typeof window === 'undefined' ? '/create' : currentPathWithQuery('/create')
  )}`;
  const tabs: { mode: StudioMode; label: string; icon: typeof ImageIcon }[] = [
    { mode: 'video', label: m['studio.video.tab'](), icon: Clapperboard },
    { mode: 'image', label: m['studio.image.tab'](), icon: ImageIcon },
  ];

  return (
    <div className="opus-public-studio bg-background text-foreground min-h-screen">
      <header className="opus-public-header">
        <Link href="/" className="opus-public-brand">
          <img src={envConfigs.app_logo} alt="" width={32} height={32} />
          <span>{envConfigs.app_name}</span>
        </Link>
        <div className="opus-public-header-actions">
          <Link href="/" className="opus-public-back">
            <ArrowLeft size={16} /> {m['studio.back_home']()}
          </Link>
          <LocaleSelector />
        </div>
      </header>
      <main className="opus-studio mx-auto max-w-7xl space-y-8 p-4 pb-16 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="opus-studio-intro space-y-2">
            <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
              {mode === 'video'
                ? m['studio.eyebrow']()
                : m['studio.image.eyebrow']()}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {mode === 'video'
                ? m['studio.title']()
                : m['studio.image.title']()}
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
              {mode === 'video'
                ? m['studio.video.description']()
                : m['studio.image.description']()}
            </p>
          </div>
          <div className="bg-muted/60 inline-flex gap-1 rounded-md p-1">
            {tabs.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      mode: tab.mode === 'video' ? undefined : tab.mode,
                      input: undefined,
                    }),
                    replace: true,
                  })
                }
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-sm px-4 text-sm font-medium transition-colors',
                  mode === tab.mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'video' ? (
          <VideoStudio
            key="video"
            initialPrompt={prompt}
            initialMode={input}
            signInHref={signInHref}
          />
        ) : (
          <ImageStudio
            key="image"
            initialPrompt={prompt}
            signInHref={signInHref}
          />
        )}
      </main>
      <footer className="opus-public-footer">
        <span>
          © {new Date().getFullYear()} {envConfigs.app_name}
        </span>
        <div>
          <Link href="/privacy-policy">{m['opus.footer.privacy']()}</Link>
          <Link href="/terms-of-service">{m['opus.footer.terms']()}</Link>
        </div>
      </footer>
    </div>
  );
}

type StudioSearch = {
  prompt?: string;
  mode?: StudioMode;
  input?: VideoMode;
};

export const Route = createFileRoute('/create')({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    // Omit params entirely when absent/default so /create stays canonical
    // instead of 307-redirecting to /create?prompt=.
    ...(typeof search.prompt === 'string' && search.prompt !== ''
      ? { prompt: search.prompt.slice(0, 4000) }
      : {}),
    ...(search.mode === 'image' ? { mode: 'image' as const } : {}),
    ...(search.input === 'image' ? { input: 'image' as const } : {}),
  }),
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const title = m['studio.meta_title']({}, { locale });
    const description = m['studio.video.description']({}, { locale });
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/create`, { locale: loc as any }).href;
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
    };
  },
  component: StudioPage,
});
