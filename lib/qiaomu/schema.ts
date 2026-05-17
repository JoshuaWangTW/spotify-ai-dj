import { z } from 'zod';

export const qiaomuGenreHintSchema = z
  .object({
    children: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    description: z.string().trim().max(500).optional(),
    name: z.string().trim().min(1).max(120),
    parent: z.string().trim().min(1).max(120).optional(),
    related: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    score: z.number().int().nonnegative(),
    source: z.string().trim().max(240).optional(),
  })
  .strict();

export const qiaomuGenresInputSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(24).default(12),
    q: z.string().trim().max(160).default(''),
  })
  .strict();

export const qiaomuGenresOutputSchema = z
  .object({
    configured: z.boolean(),
    matches: z.array(qiaomuGenreHintSchema).max(24),
    ok: z.literal(true),
  })
  .strict();

export type QiaomuGenreHint = z.infer<typeof qiaomuGenreHintSchema>;
export type QiaomuGenresOutput = z.infer<typeof qiaomuGenresOutputSchema>;
