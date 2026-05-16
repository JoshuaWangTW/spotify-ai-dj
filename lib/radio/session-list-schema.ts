import { z } from 'zod';

export const radioSessionSummarySchema = z
  .object({
    endedAt: z.string().nullable(),
    id: z.string(),
    mode: z.string(),
    segmentCount: z.number().int().nonnegative(),
    startedAt: z.string(),
    status: z.enum(['active', 'stopped']),
    userPrompt: z.string(),
  })
  .strict();

export const radioSessionsOutputSchema = z
  .object({
    ok: z.literal(true),
    sessions: z.array(radioSessionSummarySchema),
  })
  .strict();

export type RadioSessionSummary = z.infer<typeof radioSessionSummarySchema>;
export type RadioSessionsOutput = z.infer<typeof radioSessionsOutputSchema>;
