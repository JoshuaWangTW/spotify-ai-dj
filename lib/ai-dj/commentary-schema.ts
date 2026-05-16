import { z } from 'zod';

import { llmModelSchema, llmProviderSchema } from '../llm/model-options';
import { aiDjModeSchema } from './plan-schema';

export const commentaryDepthSchema = z.enum(['short', 'deep']);

export const aiDjCommentaryInputSchema = z
  .object({
    trackName: z.string().trim().min(1).max(160),
    artistName: z.string().trim().min(1).max(160),
    mode: aiDjModeSchema.exclude(['auto']),
    depth: commentaryDepthSchema.default('short'),
    llmModel: llmModelSchema.optional(),
    llmProvider: llmProviderSchema.optional(),
  })
  .strict();

export const aiDjCommentaryOutputSchema = z
  .object({
    commentary: z.string().trim().min(40).max(260),
    listeningPoints: z.array(z.string().trim().min(1).max(80)).min(2).max(3),
  })
  .strict();

export type AiDjCommentaryInput = z.infer<typeof aiDjCommentaryInputSchema>;
export type AiDjCommentaryOutput = z.infer<typeof aiDjCommentaryOutputSchema>;

export const aiDjCommentaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['commentary', 'listeningPoints'],
  properties: {
    commentary: {
      type: 'string',
      description:
        'Chinese listening commentary. Use 80-150 Chinese characters for short, up to 220 for deep.',
    },
    listeningPoints: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
} as const;
