import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { EvolinkClient, EvolinkError } from '@/core/ai/evolink';
import { getAuth } from '@/core/auth';
import {
  VIDEO_MAX_DURATION,
  VIDEO_MIN_DURATION,
  VIDEO_MODELS,
  VIDEO_MODES,
  VIDEO_PROMPT_MAX,
  VIDEO_QUALITIES,
  VIDEO_RATIOS,
  videoCreditCost,
} from '@/config/video-generation';
import {
  AITaskStatus,
  createTask,
  finishTask,
  getTasks,
  markTaskSubmitted,
} from '@/modules/ai-tasks/service';
import { getAllConfigs, type ConfigMap } from '@/modules/config/service';
import { getBalance } from '@/modules/credits/service';
import { getStorage } from '@/modules/storage/service';
import { respData, respErr } from '@/lib/resp';

const MEDIA_TYPE = 'video';
const PROVIDER = 'evolink';
/** Give up on (and refund) tasks EvoLink hasn't finished after this long. */
const STALE_AFTER_MS = 45 * 60 * 1000;
/** Upstream polls per GET, so one page load never fans out too far. */
const MAX_SYNC_PER_REQUEST = 4;

const httpsUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://')
  );

const createSchema = z
  .object({
    mode: z.enum(VIDEO_MODES),
    prompt: z.string().trim().min(3).max(VIDEO_PROMPT_MAX),
    duration: z.number().int().min(VIDEO_MIN_DURATION).max(VIDEO_MAX_DURATION),
    quality: z.enum(VIDEO_QUALITIES),
    aspectRatio: z.enum(VIDEO_RATIOS),
    generateAudio: z.boolean(),
    imageUrls: z.array(httpsUrl).max(2).default([]),
  })
  .refine((v) => v.mode === 'text' || v.imageUrls.length > 0, {
    message: 'IMAGE_REQUIRED',
  });

const noStore = { 'Cache-Control': 'no-store' };

function client(configs: ConfigMap) {
  const apiKey = configs.evolink_api_key?.trim();
  return apiKey
    ? new EvolinkClient(apiKey, configs.evolink_base_url?.trim())
    : null;
}

async function currentUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

function parseJson(value: unknown) {
  if (typeof value !== 'string' || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** EvoLink returns `results` as URL strings; tolerate `{ url }` objects too. */
function resultUrls(results: unknown): string[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((item) =>
      typeof item === 'string' ? item : ((item as any)?.url ?? null)
    )
    .filter((url): url is string => typeof url === 'string' && !!url);
}

/** EvoLink links expire — copy to R2 when storage is configured. */
async function persistVideo(url: string, key: string) {
  try {
    const storage = await getStorage();
    if (!storage) return url;
    const result = await storage.downloadAndUpload({
      url,
      key,
      contentType: 'video/mp4',
      disposition: 'inline',
    });
    return result.success && result.url ? result.url : url;
  } catch (error) {
    console.error('[ai-videos] Could not copy video to storage', error);
    return url;
  }
}

/** Pull the latest status for an in-flight task and settle it if final. */
async function syncTask(task: any, evolink: EvolinkClient) {
  const age = Date.now() - new Date(task.createdAt).getTime();
  if (!task.taskId) {
    if (age > STALE_AFTER_MS) {
      await finishTask({
        taskId: task.id,
        status: AITaskStatus.FAILED,
        taskResult: { error: 'The request was never submitted.' },
      });
    }
    return;
  }

  let upstream;
  try {
    upstream = await evolink.getTask(task.taskId);
  } catch (error) {
    console.error('[ai-videos] Task poll failed', error);
    return;
  }

  const urls = resultUrls(upstream.results);
  if (upstream.status === 'completed' && urls.length) {
    const videos = await Promise.all(
      urls.map((url, i) =>
        persistVideo(url, `ai-videos/${task.userId}/${task.id}-${i}.mp4`)
      )
    );
    await finishTask({
      taskId: task.id,
      status: AITaskStatus.SUCCESS,
      taskResult: { videos, usage: upstream.usage },
    });
  } else if (
    upstream.status === 'failed' ||
    upstream.status === 'completed' ||
    age > STALE_AFTER_MS
  ) {
    await finishTask({
      taskId: task.id,
      status: AITaskStatus.FAILED,
      taskResult: {
        error: upstream.error?.message || 'Generation failed.',
        code: upstream.error?.code,
      },
    });
  }
}

function toView(task: any) {
  const options = parseJson(task.options);
  const result = parseJson(task.taskResult);
  return {
    id: task.id,
    prompt: task.prompt,
    status: task.status as string,
    createdAt: task.createdAt,
    costCredits: task.costCredits as number,
    mode: options.mode ?? 'text',
    duration: options.duration ?? null,
    quality: options.quality ?? null,
    aspectRatio: options.aspectRatio ?? null,
    imageUrls: (options.imageUrls as string[] | undefined) ?? [],
    videos: (result.videos as string[] | undefined) ?? [],
    error: (result.error as string | undefined) ?? null,
  };
}

async function GET({ request }: { request: Request }) {
  const configs = await getAllConfigs();
  const evolink = client(configs);
  const user = await currentUser(request);
  if (!user) {
    return respData(
      { configured: Boolean(evolink), signedIn: false, balance: 0, tasks: [] },
      { headers: noStore }
    );
  }

  try {
    let tasks = await getTasks({
      userId: user.id,
      mediaType: MEDIA_TYPE,
      limit: 24,
    });

    const inFlight = tasks
      .filter(
        (t: any) =>
          t.status === AITaskStatus.PENDING ||
          t.status === AITaskStatus.PROCESSING
      )
      .slice(0, MAX_SYNC_PER_REQUEST);
    if (evolink && inFlight.length) {
      await Promise.all(inFlight.map((t: any) => syncTask(t, evolink)));
      tasks = await getTasks({
        userId: user.id,
        mediaType: MEDIA_TYPE,
        limit: 24,
      });
    }

    return respData(
      {
        configured: Boolean(evolink),
        signedIn: true,
        balance: await getBalance(user.id),
        tasks: tasks.map(toView),
      },
      { headers: noStore }
    );
  } catch (error) {
    console.error('[ai-videos] Could not load tasks', error);
    return respErr('Could not load your videos.', { status: 500 });
  }
}

async function POST({ request }: { request: Request }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return respErr('Invalid request origin.', { status: 403 });
  }
  const user = await currentUser(request);
  if (!user) return respErr('Please sign in first.', { status: 401 });

  const configs = await getAllConfigs();
  const evolink = client(configs);
  if (!evolink) {
    return respErr('Video generation is not configured yet.', { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respErr('Invalid JSON body.', { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const imageMissing = parsed.error.issues.some(
      (issue) => issue.message === 'IMAGE_REQUIRED'
    );
    return respErr(
      imageMissing
        ? 'IMAGE_REQUIRED'
        : 'Enter a prompt and valid video settings.',
      { status: 400 }
    );
  }
  const input = parsed.data;
  const imageUrls = input.mode === 'image' ? input.imageUrls : [];
  const model = VIDEO_MODELS[input.mode];
  const cost = videoCreditCost(input.quality, input.duration);

  // 1. Charge first, so a user can never generate without paying.
  let task;
  try {
    task = await createTask({
      userId: user.id,
      mediaType: MEDIA_TYPE,
      provider: PROVIDER,
      model,
      prompt: input.prompt,
      costCredits: cost,
      options: {
        mode: input.mode,
        duration: input.duration,
        quality: input.quality,
        aspectRatio: input.aspectRatio,
        generateAudio: input.generateAudio,
        imageUrls,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Insufficient credits') {
      return respErr('INSUFFICIENT_CREDITS', { status: 402 });
    }
    console.error('[ai-videos] Could not create task', error);
    return respErr('Could not start the generation.', { status: 500 });
  }

  // 2. Submit upstream; refund if EvoLink rejects it.
  try {
    const upstream = await evolink.createVideoTask({
      model,
      prompt: input.prompt,
      duration: input.duration,
      quality: input.quality,
      aspect_ratio: input.aspectRatio,
      generate_audio: input.generateAudio,
      ...(imageUrls.length ? { image_urls: imageUrls } : {}),
    });
    await markTaskSubmitted(task.id, upstream.id);
  } catch (error) {
    const message =
      error instanceof EvolinkError ? error.message : 'Generation failed.';
    console.error('[ai-videos] EvoLink rejected the request', error);
    await finishTask({
      taskId: task.id,
      status: AITaskStatus.FAILED,
      taskResult: { error: message },
    });
    return respErr(message, { status: 502 });
  }

  return respData({ id: task.id, cost }, { headers: noStore });
}

export const Route = createFileRoute('/api/ai/videos')({
  server: { handlers: { GET, POST } },
});
