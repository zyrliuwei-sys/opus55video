import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Clapperboard,
  Coins,
  Download,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Link } from '@/core/i18n/navigation';
import {
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_PROMPT_MAX,
  VIDEO_QUALITIES,
  VIDEO_RATIOS,
  videoCreditCost,
  type VideoMode,
  type VideoQuality,
  type VideoRatio,
} from '@/config/video-generation';
import { ApiError, apiGet, apiPost, apiUpload } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { UpgradeOfferHint } from '@/blocks/upgrade-offer-hint';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type VideoTask = {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  costCredits: number;
  mode: VideoMode;
  duration: number | null;
  quality: VideoQuality | null;
  aspectRatio: VideoRatio | null;
  imageUrls: string[];
  videos: string[];
  error: string | null;
};
type StudioData = {
  configured: boolean;
  signedIn: boolean;
  balance: number;
  tasks: VideoTask[];
};

const schema = z.object({
  mode: z.enum(VIDEO_MODES),
  prompt: z.string().trim().min(3).max(VIDEO_PROMPT_MAX),
  duration: z.number().int(),
  quality: z.enum(VIDEO_QUALITIES),
  aspectRatio: z.enum(VIDEO_RATIOS),
  generateAudio: z.boolean(),
  imageUrls: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

const RATIO_LABELS: Partial<Record<VideoRatio, () => string>> = {
  adaptive: () => m['studio.video.ratio_adaptive'](),
  '16:9': () => m['studio.landscape'](),
  '9:16': () => m['studio.portrait'](),
  '1:1': () => m['studio.square'](),
  '21:9': () => m['studio.video.ratio_cinema'](),
};

const ASPECT_CLASS: Record<VideoRatio, string> = {
  adaptive: 'aspect-video',
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
  '21:9': 'aspect-[21/9]',
};

const selectClass =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm';

function FrameUpload({
  label,
  url,
  disabled,
  onChange,
}: {
  label: string;
  url?: string;
  disabled: boolean;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('files', file);
      const data = await apiUpload<{ urls: string[] }>(
        '/api/storage/upload-image',
        body
      );
      // The no-storage dev fallback returns a site-relative path.
      onChange(new URL(data.urls[0], window.location.origin).href);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message !== 'Upload failed'
          ? error.message
          : m['studio.video.upload_failed']()
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {url ? (
        <div className="bg-muted relative overflow-hidden rounded-md border">
          <img src={url} alt="" className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="bg-background/90 absolute top-2 right-2 grid size-7 place-items-center rounded-full border"
            aria-label={m['studio.video.remove_image']()}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            'border-input text-muted-foreground hover:border-primary/60 flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-xs transition-colors',
            (disabled || uploading) && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          {uploading
            ? m['studio.video.uploading']()
            : m['studio.video.upload_hint']()}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function VideoStudio({
  initialPrompt,
  initialMode,
  signInHref,
}: {
  initialPrompt?: string;
  initialMode?: VideoMode;
  signInHref: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['video-studio'],
    queryFn: () => apiGet<StudioData>('/api/ai/videos'),
    refetchInterval: (query) =>
      query.state.data?.tasks.some(
        (task) => task.status === 'pending' || task.status === 'processing'
      )
        ? 8_000
        : false,
  });
  const create = useMutation({
    mutationFn: (values: Values) => apiPost('/api/ai/videos', values),
    onSuccess: () => {
      toast.success(m['studio.video.submitted']());
      queryClient.invalidateQueries({ queryKey: ['video-studio'] });
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.message : '';
      toast.error(
        code === 'INSUFFICIENT_CREDITS'
          ? m['studio.video.insufficient']()
          : code === 'IMAGE_REQUIRED'
            ? m['studio.video.image_required']()
            : error.message
      );
      queryClient.invalidateQueries({ queryKey: ['video-studio'] });
    },
  });
  const form = useForm({
    defaultValues: {
      mode: initialMode ?? 'text',
      prompt: initialPrompt ?? '',
      duration: 5,
      quality: '720p',
      aspectRatio: '16:9',
      generateAudio: true,
      imageUrls: [],
    } as Values,
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (value.mode === 'image' && !value.imageUrls[0]) {
        toast.error(m['studio.video.image_required']());
        return;
      }
      await create.mutateAsync({
        ...value,
        imageUrls:
          value.mode === 'image' ? value.imageUrls.filter(Boolean) : [],
      });
    },
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
                  <Clapperboard className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    {m['studio.video.create_title']()}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {m['studio.video.model']()}
                  </p>
                </div>
              </div>
              {signedIn && (
                <div className="flex flex-col items-end gap-1">
                  <Link
                    href="/pricing"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
                  >
                    <Coins className="size-3.5" />
                    {m['studio.image.balance']({ credits: balance })}
                  </Link>
                  <UpgradeOfferHint compact />
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
              }}
              className="opus-studio-form space-y-6"
            >
              <form.Field name="mode">
                {(field) => (
                  <div className="bg-muted/60 grid grid-cols-2 gap-1 rounded-md p-1">
                    {VIDEO_MODES.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => field.handleChange(mode)}
                        className={cn(
                          'inline-flex h-9 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors',
                          field.state.value === mode
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {mode === 'text' ? (
                          <Type className="size-4" />
                        ) : (
                          <ImagePlus className="size-4" />
                        )}
                        {mode === 'text'
                          ? m['studio.video.mode_text']()
                          : m['studio.video.mode_image']()}
                      </button>
                    ))}
                  </div>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.values.mode}>
                {(mode) =>
                  mode === 'image' && (
                    <form.Field name="imageUrls">
                      {(field) => {
                        const set = (index: number, url: string | null) => {
                          const next = [...field.state.value];
                          next[index] = url ?? '';
                          // A last frame without a first frame is invalid.
                          if (index === 0 && !url) next.length = 0;
                          field.handleChange(
                            next.filter((_, i) => i === 0 || next[i])
                          );
                        };
                        return (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FrameUpload
                              label={m['studio.video.first_frame']()}
                              url={field.state.value[0] || undefined}
                              disabled={!signedIn}
                              onChange={(url) => set(0, url)}
                            />
                            <FrameUpload
                              label={m['studio.video.last_frame']()}
                              url={field.state.value[1] || undefined}
                              disabled={!signedIn || !field.state.value[0]}
                              onChange={(url) => set(1, url)}
                            />
                          </div>
                        );
                      }}
                    </form.Field>
                  )
                }
              </form.Subscribe>

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
                      rows={6}
                      maxLength={VIDEO_PROMPT_MAX}
                      className="opus-studio-prompt min-h-40 resize-y text-base leading-relaxed"
                      placeholder={m['studio.prompt_placeholder']()}
                    />
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>{m['studio.video.prompt_hint']()}</span>
                      <span>
                        {field.state.value.length}/{VIDEO_PROMPT_MAX}
                      </span>
                    </div>
                  </div>
                )}
              </form.Field>

              <div className="grid gap-5 sm:grid-cols-3">
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
                          field.handleChange(event.target.value as VideoRatio)
                        }
                        className={selectClass}
                      >
                        {VIDEO_RATIOS.map((ratio) => (
                          <option key={ratio} value={ratio}>
                            {ratio === 'adaptive'
                              ? RATIO_LABELS.adaptive!()
                              : RATIO_LABELS[ratio]
                                ? `${ratio} · ${RATIO_LABELS[ratio]!()}`
                                : ratio}
                          </option>
                        ))}
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
                          field.handleChange(Number(event.target.value))
                        }
                        className={selectClass}
                      >
                        {VIDEO_DURATIONS.map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {seconds} {m['studio.seconds']()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
                <form.Field name="quality">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="video-quality">
                        {m['studio.image.resolution_label']()}
                      </Label>
                      <select
                        id="video-quality"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as VideoQuality)
                        }
                        className={selectClass}
                      >
                        {VIDEO_QUALITIES.map((quality) => (
                          <option key={quality} value={quality}>
                            {quality}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field name="generateAudio">
                {(field) => (
                  <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
                    <div>
                      <Label htmlFor="video-audio">
                        {m['studio.video.audio_label']()}
                      </Label>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {m['studio.video.audio_hint']()}
                      </p>
                    </div>
                    <Switch
                      id="video-audio"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                    />
                  </div>
                )}
              </form.Field>

              {query.isError && (
                <p className="text-destructive text-sm">
                  {m['studio.load_error']()}
                </p>
              )}
              {!query.isLoading && !configured && (
                <p className="text-muted-foreground text-sm">
                  {m['studio.video.not_configured']()}
                </p>
              )}

              <form.Subscribe
                selector={(state) =>
                  [
                    state.values.quality,
                    state.values.duration,
                    state.canSubmit,
                    state.isSubmitting,
                  ] as const
                }
              >
                {([quality, duration, canSubmit, isSubmitting]) => {
                  const cost = videoCreditCost(quality, duration);
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
                            {m['studio.video.insufficient']()}
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
                        <>
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
                          <UpgradeOfferHint />
                        </>
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
                            <Clapperboard className="size-4" />
                          )}
                          {busy
                            ? m['studio.submitting']()
                            : m['studio.generate']()}
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
                  {m['studio.video.how_description']()}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground border-t pt-4 text-xs">
              {m['studio.video.cost_note']()}
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
              {m['studio.history_description']()}
            </p>
          </div>
          {tasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
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
            {tasks.map((task) => {
              const video = task.videos[0];
              const inFlight =
                task.status === 'pending' || task.status === 'processing';
              return (
                <Card
                  key={task.id}
                  className="opus-studio-task overflow-hidden p-0"
                >
                  {video ? (
                    <video
                      src={video}
                      controls
                      playsInline
                      preload="metadata"
                      poster={task.imageUrls[0]}
                      className="bg-muted w-full"
                    />
                  ) : (
                    <div
                      className={cn(
                        'bg-muted grid place-items-center',
                        ASPECT_CLASS[task.aspectRatio ?? '16:9']
                      )}
                    >
                      {inFlight ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-2 text-xs">
                          <LoaderCircle className="size-8 animate-spin opacity-60" />
                          {m['studio.video.wait_hint']()}
                        </div>
                      ) : (
                        <Clapperboard className="text-muted-foreground/50 size-8" />
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
                        {[
                          task.duration && `${task.duration}s`,
                          task.quality,
                          `${task.costCredits} ${m['studio.image.credits_unit']()}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm">{task.prompt}</p>
                    {task.error && (
                      <p className="text-destructive text-xs">
                        {task.error} · {m['studio.video.refunded']()}
                      </p>
                    )}
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>{new Date(task.createdAt).toLocaleString()}</span>
                      {video && (
                        <a
                          href={video}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <Download className="size-3" />
                          {m['studio.open_video']()}
                        </a>
                      )}
                    </div>
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
