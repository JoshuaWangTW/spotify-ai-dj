import { z } from 'zod';

export const musicMemoryTypeSchema = z.enum([
  'taste',
  'avoid',
  'situation',
  'learning_goal',
  'dj_style',
]);

export const musicAssistantChatInputSchema = z
  .object({
    conversationId: z.string().trim().min(1).max(128).optional(),
    includeSpotifyTaste: z.boolean().default(false),
    message: z.string().trim().min(1).max(1200),
  })
  .strict();

export const musicAssistantMemoryCandidateSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    content: z.string().trim().min(1).max(240),
    type: musicMemoryTypeSchema,
  })
  .strict();

export const musicAssistantOutputSchema = z
  .object({
    reply: z.string().trim().min(1).max(1200),
    memoryCandidates: z.array(musicAssistantMemoryCandidateSchema).max(5),
    profileSummaryPatch: z
      .object({
        avoidSummary: z.string().trim().max(600).optional(),
        tasteSummary: z.string().trim().max(600).optional(),
      })
      .strict(),
    suggestedRadioPrompt: z.string().trim().max(400).optional(),
  })
  .strict();

export const musicAssistantChatOutputSchema = z
  .object({
    conversationId: z.string(),
    memoryCandidates: z.array(
      musicAssistantMemoryCandidateSchema.extend({
        id: z.string().optional(),
        saved: z.boolean(),
      }),
    ),
    profileUpdated: z.boolean(),
    reply: z.string(),
    suggestedRadioPrompt: z.string().optional(),
  })
  .strict();

export type MusicMemoryType = z.infer<typeof musicMemoryTypeSchema>;
export type MusicAssistantChatInput = z.infer<typeof musicAssistantChatInputSchema>;
export type MusicAssistantOutput = z.infer<typeof musicAssistantOutputSchema>;
export type MusicAssistantChatOutput = z.infer<typeof musicAssistantChatOutputSchema>;

export const musicAssistantJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'memoryCandidates', 'profileSummaryPatch', 'suggestedRadioPrompt'],
  properties: {
    memoryCandidates: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'content', 'confidence'],
        properties: {
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          content: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: ['taste', 'avoid', 'situation', 'learning_goal', 'dj_style'],
          },
        },
      },
    },
    profileSummaryPatch: {
      type: 'object',
      additionalProperties: false,
      required: ['tasteSummary', 'avoidSummary'],
      properties: {
        avoidSummary: {
          type: 'string',
        },
        tasteSummary: {
          type: 'string',
        },
      },
    },
    reply: {
      type: 'string',
    },
    suggestedRadioPrompt: {
      type: 'string',
    },
  },
} as const;
