import { z } from 'zod';

import { aiDjModeSchema } from '../ai-dj/plan-schema';

export const radioSessionStatusSchema = z.enum(['active', 'stopped']);
export const radioEventTypeSchema = z.enum([
  'session_started',
  'segment_queued',
  'tick_requested',
  'session_stopped',
]);

export type AiDjMode = z.infer<typeof aiDjModeSchema>;

export const radioStartInputSchema = z
  .object({
    autoplayQueue: z.boolean().default(true),
    clientTimeIso: z.string().datetime().optional(),
    mode: aiDjModeSchema.default('auto'),
    prompt: z.string().trim().min(1).max(500),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const radioPlaybackStateSchema = z
  .object({
    artistName: z.string().trim().min(1).max(160).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    isPlaying: z.boolean().optional(),
    progressMs: z.number().int().nonnegative().optional(),
    queueCount: z.number().int().nonnegative().max(100).optional(),
    spotifyUri: z.string().trim().max(120).optional(),
    trackName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const radioTickFeedbackSchema = z
  .object({
    feedbackType: z.enum([
      'like',
      'dislike',
      'too_loud',
      'no_vocals',
      'work_focus',
      'more_detail',
      'skip',
    ]),
    spotifyTrackId: z.string().trim().min(1).max(80).optional(),
    trackName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const radioTickInputSchema = z
  .object({
    autoplayQueue: z.boolean().default(true),
    clientTimeIso: z.string().datetime().optional(),
    feedback: z.array(radioTickFeedbackSchema).max(10).default([]),
    playbackState: radioPlaybackStateSchema.optional(),
    sessionId: z.string().trim().min(1).max(128),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const radioStopInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(128),
  })
  .strict();

export const radioSegmentPlanOutputSchema = z
  .object({
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    djIntro: z.string().trim().min(1).max(320),
    energy: z.number().min(0).max(1),
    mode: aiDjModeSchema.exclude(['auto']),
    queueReasoning: z.array(z.string().trim().min(1).max(180)).min(5).max(8),
    segmentTitle: z.string().trim().min(1).max(80),
    situation: z.string().trim().min(1).max(80),
    spotifySearchQueries: z.array(z.string().trim().min(1).max(120)).min(5).max(8),
    transitionNote: z.string().trim().min(1).max(220),
    vocalPreference: z.enum(['instrumental', 'low', 'medium', 'high', 'no_preference']),
  })
  .strict();

export const radioTrackCandidateSchema = z
  .object({
    album: z.string(),
    albumImageUrl: z.string().url().optional(),
    artist: z.string(),
    explicit: z.boolean(),
    popularity: z.number().int().min(0).max(100),
    query: z.string(),
    spotifyUri: z.string(),
    spotifyUrl: z.string().url(),
    title: z.string(),
  })
  .strict();

export const radioSegmentResponseSchema = z
  .object({
    id: z.string(),
    index: z.number().int().nonnegative(),
    plan: radioSegmentPlanOutputSchema,
    queuedTrackUris: z.array(z.string()),
    tracks: z.array(radioTrackCandidateSchema).max(8),
  })
  .strict();

export const radioQueueWarningSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    message: z.string().trim().min(1).max(220),
    retryAfterSeconds: z.number().int().positive().max(86_400).optional(),
  })
  .strict();

export const radioStartOutputSchema = z
  .object({
    ok: z.literal(true),
    queueWarning: radioQueueWarningSchema.optional(),
    segment: radioSegmentResponseSchema,
    session: z.object({
      id: z.string(),
      mode: aiDjModeSchema.exclude(['auto']),
      status: radioSessionStatusSchema,
      userPrompt: z.string(),
    }),
  })
  .strict();

export const radioTickOutputSchema = z
  .object({
    ok: z.literal(true),
    queueWarning: radioQueueWarningSchema.optional(),
    segment: radioSegmentResponseSchema,
    session: z.object({
      id: z.string(),
      mode: aiDjModeSchema.exclude(['auto']),
      status: radioSessionStatusSchema,
    }),
  })
  .strict();

export const radioStopOutputSchema = z
  .object({
    ok: z.literal(true),
    session: z.object({
      endedAt: z.string(),
      id: z.string(),
      status: z.literal('stopped'),
    }),
  })
  .strict();

export type RadioStartInput = z.infer<typeof radioStartInputSchema>;
export type RadioTickInput = z.infer<typeof radioTickInputSchema>;
export type RadioStopInput = z.infer<typeof radioStopInputSchema>;
export type RadioSegmentPlanOutput = z.infer<typeof radioSegmentPlanOutputSchema>;
export type RadioSegmentResponse = z.infer<typeof radioSegmentResponseSchema>;
export type RadioQueueWarning = z.infer<typeof radioQueueWarningSchema>;
export type RadioStartOutput = z.infer<typeof radioStartOutputSchema>;
export type RadioTickOutput = z.infer<typeof radioTickOutputSchema>;
export type RadioStopOutput = z.infer<typeof radioStopOutputSchema>;

export const radioSegmentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'segmentTitle',
    'mode',
    'situation',
    'energy',
    'vocalPreference',
    'difficulty',
    'spotifySearchQueries',
    'queueReasoning',
    'djIntro',
    'transitionNote',
  ],
  properties: {
    difficulty: {
      type: 'string',
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    djIntro: {
      type: 'string',
    },
    energy: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
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
    queueReasoning: {
      type: 'array',
      minItems: 5,
      maxItems: 8,
      items: {
        type: 'string',
      },
    },
    segmentTitle: {
      type: 'string',
    },
    situation: {
      type: 'string',
    },
    spotifySearchQueries: {
      type: 'array',
      minItems: 5,
      maxItems: 8,
      items: {
        type: 'string',
      },
    },
    transitionNote: {
      type: 'string',
    },
    vocalPreference: {
      type: 'string',
      enum: ['instrumental', 'low', 'medium', 'high', 'no_preference'],
    },
  },
} as const;
