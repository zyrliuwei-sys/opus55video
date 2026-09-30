import { and, desc, eq, gte } from 'drizzle-orm';

import { AIMediaType, FalProvider } from '@/core/ai';
import { db } from '@/core/db';
import { publicVideoTask, type PublicVideoTask } from '@/config/db/schema';
import { md5 } from '@/lib/hash';

const MODEL = 'fal-ai/kling-video/v3/standard/text-to-video';
const QUEUE_URL = 'https://queue.fal.run/fal-ai/kling-video';
const DAY_MS = 24 * 60 * 60 * 1000;

export class PublicVideoLimitError extends Error {}

export type PublicVideoInput = {
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  duration: '5' | '10';
};

async function assertQuota(visitorHash: string, ipHash: string) {
  const since = new Date(Date.now() - DAY_MS);
  const [visitorTasks, ipTasks, globalTasks] = await Promise.all([
    db()
      .select({ createdAt: publicVideoTask.createdAt })
      .from(publicVideoTask)
      .where(
        and(
          eq(publicVideoTask.visitorHash, visitorHash),
          gte(publicVideoTask.createdAt, since)
        )
      )
      .orderBy(desc(publicVideoTask.createdAt))
      .limit(3),
    db()
      .select({ createdAt: publicVideoTask.createdAt })
      .from(publicVideoTask)
      .where(
        and(
          eq(publicVideoTask.ipHash, ipHash),
          gte(publicVideoTask.createdAt, since)
        )
      )
      .orderBy(desc(publicVideoTask.createdAt))
      .limit(3),
    db()
      .select({ id: publicVideoTask.id })
      .from(publicVideoTask)
      .where(gte(publicVideoTask.createdAt, since))
      .limit(30),
  ]);

  if (visitorTasks.length >= 3 || ipTasks.length >= 3) {
    throw new PublicVideoLimitError(
      'The free daily limit has been reached. Please try again in 24 hours.'
    );
  }
  if (globalTasks.length >= 30) {
    throw new PublicVideoLimitError(
      'The daily studio capacity has been reached. Please try again later.'
    );
  }
  if (ipTasks[0] && Date.now() - ipTasks[0].createdAt.getTime() < 60_000) {
    throw new PublicVideoLimitError(
      'Please wait one minute before making another video.'
    );
  }
}

export async function createPublicVideo(params: {
  visitorHash: string;
  ipHash: string;
  apiKey: string;
  input: PublicVideoInput;
}) {
  const { visitorHash, ipHash, apiKey, input } = params;
  await assertQuota(visitorHash, ipHash);

  // Reserve by IP and minute before calling the chargeable provider. The
  // primary key prevents concurrent requests from spending twice per minute.
  const id = `public-${md5(`${ipHash}:${Math.floor(Date.now() / 60_000)}`)}`;
  try {
    await db().insert(publicVideoTask).values({
      id,
      visitorHash,
      ipHash,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      status: 'pending',
    });
  } catch (error) {
    const [reserved] = await db()
      .select({ id: publicVideoTask.id })
      .from(publicVideoTask)
      .where(eq(publicVideoTask.id, id))
      .limit(1);
    if (reserved) {
      throw new PublicVideoLimitError(
        'Please wait one minute before making another video.'
      );
    }
    throw error;
  }

  try {
    const provider = new FalProvider({ apiKey });
    const result = await provider.generate({
      params: {
        mediaType: AIMediaType.VIDEO,
        model: MODEL,
        prompt: input.prompt,
        options: {
          aspect_ratio: input.aspectRatio,
          duration: input.duration,
        },
      },
    });
    await db()
      .update(publicVideoTask)
      .set({ providerTaskId: result.taskId })
      .where(eq(publicVideoTask.id, id));
  } catch (error) {
    await db()
      .update(publicVideoTask)
      .set({ status: 'failed', error: 'Submission failed.' })
      .where(eq(publicVideoTask.id, id));
    throw error;
  }

  return { id };
}

async function falJson(url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Fal returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function refreshTask(task: PublicVideoTask, apiKey: string) {
  if (!task.providerTaskId || !/^[a-zA-Z0-9_-]+$/.test(task.providerTaskId))
    return;
  const requestUrl = `${QUEUE_URL}/requests/${encodeURIComponent(task.providerTaskId)}`;
  const status = await falJson(`${requestUrl}/status`, apiKey);
  let nextStatus: string;
  let videoUrl: string | null = null;
  let error: string | null = null;

  switch (status.status) {
    case 'IN_QUEUE':
      nextStatus = 'pending';
      break;
    case 'IN_PROGRESS':
      nextStatus = 'processing';
      break;
    case 'COMPLETED': {
      const output = await falJson(requestUrl, apiKey);
      const candidate = (output.video as { url?: unknown } | undefined)?.url;
      if (typeof candidate === 'string' && candidate.startsWith('https://')) {
        nextStatus = 'success';
        videoUrl = candidate;
      } else {
        nextStatus = 'failed';
        error = 'The provider returned no video.';
      }
      break;
    }
    case 'FAILED':
      nextStatus = 'failed';
      error = 'Generation failed.';
      break;
    default:
      return;
  }

  await db()
    .update(publicVideoTask)
    .set({ status: nextStatus, videoUrl, error })
    .where(eq(publicVideoTask.id, task.id));
}

export async function listPublicVideos(visitorHash: string, apiKey?: string) {
  const tasks: PublicVideoTask[] = await db()
    .select()
    .from(publicVideoTask)
    .where(eq(publicVideoTask.visitorHash, visitorHash))
    .orderBy(desc(publicVideoTask.createdAt))
    .limit(12);

  if (apiKey) {
    await Promise.allSettled(
      tasks
        .filter(
          (task) =>
            (task.status === 'pending' || task.status === 'processing') &&
            task.providerTaskId
        )
        .slice(0, 3)
        .map((task) => refreshTask(task, apiKey))
    );
  }

  const current: PublicVideoTask[] = await db()
    .select()
    .from(publicVideoTask)
    .where(eq(publicVideoTask.visitorHash, visitorHash))
    .orderBy(desc(publicVideoTask.createdAt))
    .limit(12);
  return current.map((task) => ({
    id: task.id,
    prompt: task.prompt,
    status: task.status,
    createdAt: task.createdAt,
    videoUrl: task.videoUrl,
    error: task.error,
  }));
}
