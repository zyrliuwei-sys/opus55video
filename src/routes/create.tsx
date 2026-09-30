import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpRight,
  Clapperboard,
  LoaderCircle,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { apiGet, apiPost } from '@/lib/api-client';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { BuiltWithShipAny } from '@/components/built-with-shipany';
import { LocaleSelector } from '@/components/locale-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import '@/styles/opus-studio.css';

type VideoTask = {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  videoUrl: string | null;
  error: string | null;
};
type StudioData = { configured: boolean; tasks: VideoTask[] };

const schema = z.object({
  prompt: z.string().trim().min(10).max(2500),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']),
  duration: z.enum(['5', '10']),
});

function VideoStudioPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['public-video-studio'],
    queryFn: () => apiGet<StudioData>('/api/public-video'),
    refetchInterval: (query) =>
      query.state.data?.tasks.some(
        (task) => task.status === 'pending' || task.status === 'processing'
      )
        ? 10_000
        : false,
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      apiPost('/api/public-video', values),
    onSuccess: () => {
      toast.success(m['studio.submitted']());
      queryClient.invalidateQueries({ queryKey: ['public-video-studio'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const form = useForm({
    defaultValues: {
      prompt: '',
      aspectRatio: '16:9',
      duration: '5',
    } as z.infer<typeof schema>,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => create.mutateAsync(value),
  });
  const configured = query.data?.configured ?? false;
  const tasks = query.data?.tasks ?? [];

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
        <div className="opus-studio-intro space-y-2">
          <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
            {m['studio.eyebrow']()}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {m['studio.title']()}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
            {m['studio.description']()}
          </p>
        </div>

        <div className="opus-studio-grid grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <Card className="opus-studio-form-card border-border/70 bg-card/80 overflow-hidden">
            <CardContent className="space-y-7 p-5 md:p-8">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-sm">
                  <Clapperboard className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    {m['studio.create_title']()}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {m['studio.model']()}
                  </p>
                </div>
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
                      <Label htmlFor="video-prompt">
                        {m['studio.prompt_label']()}
                      </Label>
                      <Textarea
                        id="video-prompt"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={field.handleBlur}
                        rows={8}
                        maxLength={2500}
                        className="opus-studio-prompt min-h-48 resize-y text-base leading-relaxed"
                        placeholder={m['studio.prompt_placeholder']()}
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>{m['studio.prompt_hint']()}</span>
                        <span>{field.state.value.length}/2500</span>
                      </div>
                    </div>
                  )}
                </form.Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <form.Field name="aspectRatio">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="video-ratio">
                          {m['studio.ratio_label']()}
                        </Label>
                        <select
                          id="video-ratio"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.value as '16:9' | '9:16' | '1:1'
                            )
                          }
                          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                        >
                          <option value="16:9">
                            16:9 · {m['studio.landscape']()}
                          </option>
                          <option value="9:16">
                            9:16 · {m['studio.portrait']()}
                          </option>
                          <option value="1:1">
                            1:1 · {m['studio.square']()}
                          </option>
                        </select>
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="duration">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor="video-duration">
                          {m['studio.duration_label']()}
                        </Label>
                        <select
                          id="video-duration"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value as '5' | '10')
                          }
                          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                        >
                          <option value="5">5 {m['studio.seconds']()}</option>
                          <option value="10">10 {m['studio.seconds']()}</option>
                        </select>
                      </div>
                    )}
                  </form.Field>
                </div>

                {!query.isLoading && !configured && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                    {m['studio.public_not_configured']()}
                  </p>
                )}
                {query.isError && (
                  <p className="text-destructive text-sm">
                    {m['studio.load_error']()}
                  </p>
                )}
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      size="lg"
                      className="opus-studio-submit w-full gap-2"
                      disabled={
                        !configured ||
                        !canSubmit ||
                        isSubmitting ||
                        create.isPending
                      }
                    >
                      {isSubmitting || create.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Clapperboard className="size-4" />
                      )}
                      {isSubmitting || create.isPending
                        ? m['studio.submitting']()
                        : m['studio.generate']()}
                    </Button>
                  )}
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
                    {m['studio.how_description']()}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground border-t pt-4 text-xs">
                {m['studio.public_cost_note']()}
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="opus-studio-history space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {m['studio.history_title']()}
              </h2>
              <p className="text-muted-foreground text-sm">
                {m['studio.history_description']()}
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
              {query.isLoading ? m['studio.loading']() : m['studio.empty']()}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="opus-studio-task overflow-hidden p-0"
                >
                  {task.videoUrl ? (
                    <video
                      src={task.videoUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full bg-black"
                    />
                  ) : (
                    <div className="bg-muted grid aspect-video place-items-center">
                      <Play className="text-muted-foreground/50 size-8" />
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
                      <time className="text-muted-foreground text-xs">
                        {new Date(task.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="line-clamp-2 text-sm">{task.prompt}</p>
                    {task.error && (
                      <p className="text-destructive text-xs">{task.error}</p>
                    )}
                    {task.videoUrl && (
                      <a
                        href={task.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        {m['studio.open_video']()}{' '}
                        <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="opus-public-footer">
        <span>
          © {new Date().getFullYear()} {envConfigs.app_name}
        </span>
        <div>
          <Link href="/privacy-policy">{m['opus.footer.privacy']()}</Link>
          <Link href="/terms-of-service">{m['opus.footer.terms']()}</Link>
          <BuiltWithShipAny />
        </div>
      </footer>
    </div>
  );
}

export const Route = createFileRoute('/create')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const title = `${m['studio.title']({}, { locale })} | ${envConfigs.app_name}`;
    const description = m['studio.description']({}, { locale });
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/create`, { locale: loc as any }).href;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
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
  component: VideoStudioPage,
});
