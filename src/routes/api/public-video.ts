import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { envConfigs } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import {
  createPublicVideo,
  listPublicVideos,
  PublicVideoLimitError,
} from '@/modules/public-video/service';
import { getCookieFromHeader } from '@/lib/cookie';
import { respData, respErr } from '@/lib/resp';

const COOKIE_NAME = 'opus55_guest';
const noStore = { 'Cache-Control': 'no-store' };
const createSchema = z.object({
  prompt: z.string().trim().min(10).max(2500),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']),
  duration: z.enum(['5', '10']),
});

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function sign(token: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(envConfigs.auth_secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(token)
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function visitorToken(request: Request) {
  const cookie = getCookieFromHeader(
    request.headers.get('cookie'),
    COOKIE_NAME
  );
  if (!cookie) return null;
  const [token, signature] = cookie.split('.');
  if (!token || !signature || !/^[0-9a-f-]{36}$/.test(token)) return null;
  if (signature !== (await sign(token))) return null;
  return token;
}

function clientIp(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function GET({ request }: { request: Request }) {
  if (!envConfigs.auth_secret) {
    return respErr('The studio is not configured.', { status: 503 });
  }
  let token = await visitorToken(request);
  const headers: Record<string, string> = { ...noStore };
  if (!token) {
    token = crypto.randomUUID();
    const signature = await sign(token);
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    headers['Set-Cookie'] =
      `${COOKIE_NAME}=${token}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`;
  }

  try {
    const configs = await getAllConfigs();
    const apiKey = configs.fal_api_key?.trim();
    const tasks = await listPublicVideos(await digest(token), apiKey);
    return respData({ configured: Boolean(apiKey), tasks }, { headers });
  } catch (error) {
    console.error('[public-video] Could not load tasks', error);
    return respErr('Could not load video tasks.', { status: 500, headers });
  }
}

async function POST({ request }: { request: Request }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return respErr('Invalid request origin.', { status: 403 });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return respErr('JSON body required.', { status: 415 });
  }
  if (!envConfigs.auth_secret) {
    return respErr('The studio is not configured.', { status: 503 });
  }
  const token = await visitorToken(request);
  if (!token) {
    return respErr('Open the studio again before generating.', {
      status: 428,
    });
  }

  const configs = await getAllConfigs();
  const apiKey = configs.fal_api_key?.trim();
  if (!apiKey) {
    return respErr('Video generation is not configured yet.', {
      status: 503,
    });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respErr('Invalid JSON body.', { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return respErr('Enter a valid prompt and video settings.', {
      status: 400,
    });
  }

  try {
    const result = await createPublicVideo({
      visitorHash: await digest(token),
      ipHash: await digest(`${envConfigs.auth_secret}:${clientIp(request)}`),
      apiKey,
      input: parsed.data,
    });
    return respData(result, { headers: noStore });
  } catch (error) {
    if (error instanceof PublicVideoLimitError) {
      return respErr(error.message, { status: 429 });
    }
    console.error('[public-video] Generation request failed', error);
    return respErr('The video request could not be submitted.', {
      status: 502,
    });
  }
}

export const Route = createFileRoute('/api/public-video')({
  server: { handlers: { GET, POST } },
});
