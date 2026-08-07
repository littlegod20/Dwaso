import Anthropic from '@anthropic-ai/sdk';
import { VisionResultSchema, type VisionResult } from '@dwaso/shared-types';
import type { Env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export type VisionCandidate = {
  id: string;
  name: string;
  category: string | null;
};

export type VisionRequest = {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  candidates: VisionCandidate[];
};

export type VisionResponse = {
  result: VisionResult;
  costMicros: number;
  latencyMs: number;
};

/**
 * The third and only paid tier of the scan cascade. Behind an interface so tests
 * can assert tier selection without a network call or a bill, and so the model
 * can be swapped without touching the pipeline.
 */
export interface VisionProvider {
  identify(request: VisionRequest): Promise<VisionResponse>;
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Published per-token prices for the Sonnet tier, in millionths of a US dollar,
 * so a per-scan cost is representable as an integer and the cascade's economics
 * stay measurable rather than estimated.
 */
const INPUT_COST_MICROS_PER_TOKEN = 3;
const OUTPUT_COST_MICROS_PER_TOKEN = 15;

const SYSTEM_PROMPT = `You identify retail products in photographs taken by small shop owners in West Africa.

You are given a photo and a list of products already in this shop's catalog.

Rules:
- If the photo shows one of the listed products, return its exact id in matchedProductId.
- If it does not, return null for matchedProductId and describe what you see in the other fields.
- Never invent an id that is not in the list.
- confidence is your honest probability that matchedProductId is correct, 0 to 1. Return 0 when matchedProductId is null.
- extractedName should be the product name as printed on the packaging, including brand and size.
- visibleBarcode should only be filled when the digits are legibly readable in the photo.

Respond with the identify_product tool and nothing else.`;

class ClaudeVisionProvider implements VisionProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }

  async identify(request: VisionRequest): Promise<VisionResponse> {
    const startedAt = Date.now();

    const catalogue = request.candidates.length
      ? request.candidates
          .map(
            (candidate) =>
              `- ${candidate.id}: ${candidate.name}${candidate.category ? ` (${candidate.category})` : ''}`,
          )
          .join('\n')
      : '(this shop has no products yet)';

    let message;

    try {
      message = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        // A tool schema rather than free text: the model is constrained to a
        // shape we can validate, so a malformed answer is a validation error
        // rather than a product row invented from prose.
        tools: [
          {
            name: 'identify_product',
            description: 'Report which catalog product the photo shows, if any.',
            input_schema: {
              type: 'object',
              properties: {
                matchedProductId: { type: ['string', 'null'] },
                confidence: { type: 'number' },
                extractedName: { type: ['string', 'null'] },
                category: { type: ['string', 'null'] },
                size: { type: ['string', 'null'] },
                visibleBarcode: { type: ['string', 'null'] },
              },
              required: ['matchedProductId', 'confidence'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'identify_product' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: request.mediaType,
                  data: request.imageBase64,
                },
              },
              { type: 'text', text: `Products in this shop:\n${catalogue}` },
            ],
          },
        ],
      });
    } catch (error) {
      // An upstream outage degrades scanning to the free tiers rather than
      // taking down the endpoint; the caller falls back to manual selection.
      throw AppError.upstreamUnavailable(
        `Vision model (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }

    const toolUse = message.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      throw AppError.upstreamUnavailable('Vision model returned no structured result');
    }

    const parsed = VisionResultSchema.safeParse({
      matchedProductId: null,
      extractedName: null,
      category: null,
      size: null,
      visibleBarcode: null,
      ...(toolUse.input as Record<string, unknown>),
    });

    if (!parsed.success) {
      throw AppError.upstreamUnavailable('Vision model returned an unusable result');
    }

    // A hallucinated id would otherwise attach a sale to someone else's product,
    // so the answer is only trusted if it names a candidate we actually offered.
    const known = new Set(request.candidates.map((candidate) => candidate.id));
    const result: VisionResult =
      parsed.data.matchedProductId && !known.has(parsed.data.matchedProductId)
        ? { ...parsed.data, matchedProductId: null, confidence: 0 }
        : parsed.data;

    return {
      result,
      costMicros:
        message.usage.input_tokens * INPUT_COST_MICROS_PER_TOKEN +
        message.usage.output_tokens * OUTPUT_COST_MICROS_PER_TOKEN,
      latencyMs: Date.now() - startedAt,
    };
  }
}

/** Used when no API key is configured: the cascade degrades to barcode plus
 * manual selection instead of the endpoint failing. */
class UnavailableVisionProvider implements VisionProvider {
  async identify(): Promise<VisionResponse> {
    throw AppError.upstreamUnavailable('Vision model is not configured');
  }
}

export function createVisionProvider(env: Env): VisionProvider {
  if (!env.ANTHROPIC_API_KEY) return new UnavailableVisionProvider();
  return new ClaudeVisionProvider(env.ANTHROPIC_API_KEY, env.VISION_MODEL);
}
