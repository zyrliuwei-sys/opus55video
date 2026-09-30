/**
 * Image generation catalog (EvoLink · GPT Image 2.5 Sunburst).
 *
 * Client-safe: the studio UI reads it to show prices and the API route reads
 * it to charge. Site credits use EvoLink's unit (1 credit = ¥0.1 ≈ $0.0147),
 * and every generation is charged at CREDIT_MARKUP × the EvoLink list price.
 */

export const IMAGE_MODEL = 'gpt-image-2.5-sunburst';

/** Site credits charged = EvoLink credits × this, rounded up. */
export const CREDIT_MARKUP = 7;

/** EvoLink list price for image output tokens, in EvoLink credits per 1K. */
const EVOLINK_CREDITS_PER_1K_OUTPUT_TOKENS = 1.836;

export const IMAGE_QUALITIES = ['low', 'medium', 'high'] as const;
export const IMAGE_RESOLUTIONS = ['1K', '2K'] as const;
export const IMAGE_SIZES = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;

export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];
export type ImageSize = (typeof IMAGE_SIZES)[number];

/**
 * Output tokens per image. 1K figures are EvoLink's published 1024² values;
 * 2K was measured at ~2.03× 1K (medium: 439 → 892 tokens).
 */
const OUTPUT_TOKENS: Record<ImageResolution, Record<ImageQuality, number>> = {
  '1K': { low: 196, medium: 439, high: 1756 },
  '2K': { low: 400, medium: 892, high: 3570 },
};

/** Site credits charged up front for one image. */
export function imageCreditCost(
  quality: ImageQuality,
  resolution: ImageResolution
): number {
  const evolinkCredits =
    (OUTPUT_TOKENS[resolution][quality] / 1000) *
    EVOLINK_CREDITS_PER_1K_OUTPUT_TOKENS;
  return Math.ceil(evolinkCredits * CREDIT_MARKUP);
}
