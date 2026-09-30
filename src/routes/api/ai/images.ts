import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { EvolinkClient, EvolinkError } from '@/core/ai/evolink';
import { getAuth } from '@/core/auth';
import {
  IMAGE_MODEL,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  IMAGE_SIZES,
  imageCreditCost,
} from '@/config/image-generation';
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

const MEDIA_TYPE = 'image';
const PROVIDER = 'evolink';
/** Give up on (and refund) tasks EvoLink hasn't finished after this long. */
const STALE_AFTER_MS = 20 * 60 * 1000;
/** Upstream polls per GET, so one page load never fans out too far. */
const MAX_SYNC_PER_REQUEST = 4;

const createSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  size: z.enum(IMAGE_SIZES),
  resolution: z.enum(IMAGE_RESOLUTIONS),
  quality: z.enum(IMAGE_QUALITIES),
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

/** EvoLink links expire after 24h — copy to R2 when storage is configured. */
async function persistImage(url: string, key: string) {
  try {
    const storage = await getStorage();
    if (!storage) return url;
    const result = await storage.downloadAndUpload({
      url,
      key,
      contentType: 'image/png',
      disposition: 'inline',
    });
    return result.success && result.url ? result.url : url;
  } catch (error) {
    console.error('[ai-images] Could not copy image to storage', error);
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
    console.error('[ai-images] Task poll failed', error);
    return;
  }

  if (upstream.status === 'completed' && upstream.results?.length) {
    const images = await Promise.all(
      upstream.results.map((url, i) =>
        persistImage(url, `ai-images/${task.userId}/${task.id}-${i}.png`)
      )
    );
    await finishTask({
      taskId: task.id,
      status: AITaskStatus.SUCCESS,
      taskResult: { images, usage: upstream.usage },
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
    size: options.size ?? null,
    resolution: options.resolution ?? null,
    quality: options.quality ?? null,
    images: (result.images as string[] | undefined) ?? [],
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
    console.error('[ai-images] Could not load tasks', error);
    return respErr('Could not load your images.', { status: 500 });
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
    return respErr('Image generation is not configured yet.', { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respErr('Invalid JSON body.', { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return respErr('Enter a prompt and valid image settings.', { status: 400 });
  }
  const input = parsed.data;
  const cost = imageCreditCost(input.quality, input.resolution);

  // 1. Charge first, so a user can never generate without paying.
  let task;
  try {
    task = await createTask({
      userId: user.id,
      mediaType: MEDIA_TYPE,
      provider: PROVIDER,
      model: IMAGE_MODEL,
      prompt: input.prompt,
      costCredits: cost,
      options: {
        size: input.size,
        resolution: input.resolution,
        quality: input.quality,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Insufficient credits') {
      return respErr('INSUFFICIENT_CREDITS', { status: 402 });
    }
    console.error('[ai-images] Could not create task', error);
    return respErr('Could not start the generation.', { status: 500 });
  }

  // 2. Submit upstream; refund if EvoLink rejects it.
  try {
    const upstream = await evolink.createImageTask({
      model: IMAGE_MODEL,
      prompt: input.prompt,
      size: input.size,
      resolution: input.resolution,
      quality: input.quality,
    });
    await markTaskSubmitted(task.id, upstream.id);
  } catch (error) {
    const message =
      error instanceof EvolinkError ? error.message : 'Generation failed.';
    console.error('[ai-images] EvoLink rejected the request', error);
    await finishTask({
      taskId: task.id,
      status: AITaskStatus.FAILED,
      taskResult: { error: message },
    });
    return respErr(message, { status: 502 });
  }

  return respData({ id: task.id, cost }, { headers: noStore });
}

export const Route = createFileRoute('/api/ai/images')({
  server: { handlers: { GET, POST } },
});
