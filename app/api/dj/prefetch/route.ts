import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { prefetchNextDJ } from '../../../../lib/dj/prefetch';

export const runtime = 'nodejs';

const prefetchTrackSchema = z
  .object({
    artist: z.string().trim().min(1).max(240),
    artistUris: z.array(z.string().trim().min(1).max(160)).max(8).optional(),
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(240),
    uri: z.string().trim().min(1).max(160),
  })
  .strict();

const djPrefetchInputSchema = z
  .object({
    hour: z.number().int().min(0).max(23).optional(),
    nextTrack: prefetchTrackSchema,
    personaId: z.string().trim().min(1).max(40).optional(),
    prevTrack: prefetchTrackSchema,
    voiceId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const djPrefetchOutputSchema = z
  .object({
    audioUrl: z.string().trim().min(1).max(240).nullable(),
    cached: z.boolean(),
    ok: z.literal(true),
    provider: z.enum(['azure', 'browser-only', 'cache', 'edge-tts']),
    script: z.string().trim().min(1).max(240),
  })
  .strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `dj:prefetch:${session.user.id}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = djPrefetchInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid DJ prefetch input.', 400);
  }

  const result = await prefetchNextDJ({
    ...input.data,
    userId: session.user.id,
  });
  const output = djPrefetchOutputSchema.parse({
    ok: true,
    ...result,
  });

  return NextResponse.json(output);
}
