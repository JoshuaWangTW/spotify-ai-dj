import { z } from 'zod';

import { llmModelSchema, llmProviderSchema } from '../llm/model-options';

export const aiDjModeSchema = z.enum([
  'auto',
  'jazz_intro',
  'classical_intro',
  'work_focus',
  'coffee_roasting',
  'dinner_store_background',
]);

export const aiDjPlanInputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500),
    mode: aiDjModeSchema.default('auto'),
    llmModel: llmModelSchema.optional(),
    llmProvider: llmProviderSchema.optional(),
    sessionId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const aiDjPlanOutputSchema = z
  .object({
    mode: aiDjModeSchema.exclude(['auto']),
    situation: z.string().trim().min(1).max(80),
    energy: z.number().min(0).max(1),
    vocalPreference: z.enum(['instrumental', 'low', 'medium', 'high', 'no_preference']),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    spotifySearchQueries: z.array(z.string().trim().min(1).max(120)).min(5).max(10),
    queueReasoning: z.array(z.string().trim().min(1).max(160)).min(5).max(10),
    djIntro: z.string().trim().min(1).max(220),
  })
  .strict();

export type AiDjPlanInput = z.infer<typeof aiDjPlanInputSchema>;
export type AiDjPlanOutput = z.infer<typeof aiDjPlanOutputSchema>;

export const aiDjPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'mode',
    'situation',
    'energy',
    'vocalPreference',
    'difficulty',
    'spotifySearchQueries',
    'queueReasoning',
    'djIntro',
  ],
  properties: {
    mode: {
      type: 'string',
      enum: [
        'jazz_intro',
        'classical_intro',
        'work_focus',
        'coffee_roasting',
        'dinner_store_background',
      ],
    },
    situation: {
      type: 'string',
      description: 'Short listening situation such as learning, focus, evening, roasting.',
    },
    energy: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: '0 is very calm, 1 is high energy.',
    },
    vocalPreference: {
      type: 'string',
      enum: ['instrumental', 'low', 'medium', 'high', 'no_preference'],
    },
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    spotifySearchQueries: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    queueReasoning: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    djIntro: {
      type: 'string',
    },
  },
} as const;
