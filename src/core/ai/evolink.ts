/**
 * Minimal EvoLink client for async image and video generation.
 * Docs: https://evolink.ai/docs/en/api-manual/image-series/gpt-image-2.5/gpt-image-2.5-image-generation
 *       https://evolink.ai/docs/en/api-manual/video-series/seedance2.0/seedance-2.0-text-to-video
 */

export const EVOLINK_DEFAULT_BASE_URL = 'https://direct.evolink.ai/v1';

/**
 * Accept what admins actually paste: the marketing site (https://evolink.ai)
 * maps to the API default, and a bare API host gets its /v1 suffix.
 */
export function normalizeEvolinkBaseUrl(input?: string): string {
  const raw = input?.trim();
  if (!raw) return EVOLINK_DEFAULT_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.hostname === 'evolink.ai' || url.hostname === 'www.evolink.ai') {
      return EVOLINK_DEFAULT_BASE_URL;
    }
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path || '/v1'}`;
  } catch {
    return EVOLINK_DEFAULT_BASE_URL;
  }
}

export type EvolinkTaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface EvolinkTask {
  id: string;
  status: EvolinkTaskStatus;
  progress?: number;
  results?: string[];
  usage?: { credits_used?: number; credits_reserved?: number };
  error?: { code?: string; message?: string } | null;
}

export class EvolinkError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export class EvolinkClient {
  private baseUrl: string;

  constructor(
    private apiKey: string,
    baseUrl?: string
  ) {
    this.baseUrl = normalizeEvolinkBaseUrl(baseUrl);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new EvolinkError(
        data?.error?.message || `EvoLink request failed (${resp.status})`,
        resp.status,
        data?.error?.code
      );
    }
    return data as T;
  }

  createImageTask(params: {
    model: string;
    prompt: string;
    size?: string;
    resolution?: string;
    quality?: string;
  }): Promise<EvolinkTask> {
    return this.request('/images/generations', {
      method: 'POST',
      body: JSON.stringify({ ...params, n: 1 }),
    });
  }

  createVideoTask(params: {
    model: string;
    prompt: string;
    duration: number;
    quality: string;
    aspect_ratio: string;
    generate_audio: boolean;
    image_urls?: string[];
  }): Promise<EvolinkTask> {
    return this.request('/videos/generations', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  getTask(taskId: string): Promise<EvolinkTask> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }
}
