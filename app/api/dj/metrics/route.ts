import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { getUserDjCacheMetrics } from '../../../../lib/dj/metrics';

export const runtime = 'nodejs';

const djMetricsOutputSchema = z
  .object({
    metrics: z.object({
      audioCacheHitRate: z.number().min(0).max(1),
      averageEstimatedCostUsd: z.number().nonnegative(),
      estimatedCostLimitUsd: z.number().positive(),
      estimatedLlmCostPerMissUsd: z.number().positive(),
      scriptCacheHitRate: z.number().min(0).max(1),
      scriptMisses: z.number().int().nonnegative(),
      scriptRequests: z.number().int().nonnegative(),
      ttsAudioMisses: z.number().int().nonnegative(),
      ttsAudioRequests: z.number().int().nonnegative(),
    }),
    ok: z.literal(true),
  })
  .strict();

const djMetricsQuerySchema = z.object({}).strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const query = djMetricsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return jsonError('INVALID_QUERY', 'This endpoint does not accept query parameters.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `dj:metrics:${session.user.id}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const output = djMetricsOutputSchema.parse({
    metrics: await getUserDjCacheMetrics(session.user.id),
    ok: true,
  });

  return NextResponse.json(output);
}
