/**
 * Video generation catalog (EvoLink · Seedance 2.0).
 *
 * Client-safe: the studio UI reads it to show prices and the API route reads
 * it to charge. Site credits use EvoLink's unit (1 credit = ¥0.1 ≈ $0.0147),
 * and every generation is charged at VIDEO_CREDIT_MARKUP × the EvoLink list
 * price for the output duration.
 */

export const VIDEO_MODES = ['text', 'image'] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];

export const VIDEO_MODELS: Record<VideoMode, string> = {
  text: 'seedance-2.0-text-to-video',
  image: 'seedance-2.0-image-to-video',
};

/** Site credits charged = EvoLink credits × this, rounded up. */
export const VIDEO_CREDIT_MARKUP = 7;

export const VIDEO_QUALITIES = ['480p', '720p', '1080p'] as const;
export const VIDEO_RATIOS = [
  'adaptive',
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
] as const;
export const VIDEO_MIN_DURATION = 4;
export const VIDEO_MAX_DURATION = 15;
export const VIDEO_DURATIONS = Array.from(
  { length: VIDEO_MAX_DURATION - VIDEO_MIN_DURATION + 1 },
  (_, i) => VIDEO_MIN_DURATION + i
);
/** Text prompts: EvoLink recommends ≤1,000 English words / 500 CJK chars. */
export const VIDEO_PROMPT_MAX = 2500;

export type VideoQuality = (typeof VIDEO_QUALITIES)[number];
export type VideoRatio = (typeof VIDEO_RATIOS)[number];

/** EvoLink list price for text/image-to-video, in EvoLink credits per second. */
const EVOLINK_CREDITS_PER_SECOND: Record<VideoQuality, number> = {
  '480p': 6.2775,
  '720p': 13.5,
  '1080p': 33.75,
};

/** Site credits charged up front for one video. */
export function videoCreditCost(
  quality: VideoQuality,
  duration: number
): number {
  return Math.ceil(
    EVOLINK_CREDITS_PER_SECOND[quality] * duration * VIDEO_CREDIT_MARKUP
  );
}
