import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { cleanupDjCaches } from '../../../../lib/dj/cache-cleanup';

export const runtime = 'nodejs';

const cleanupCacheInputSchema = z
  .object({
    ttlDays: z.number().int().min(1).max(365).default(30),
  })
  .strict();

const cleanupCacheOutputSchema = z
  .object({
    ok: z.literal(true),
    result: z.object({
      cutoffIso: z.string().datetime(),
      deletedDjScripts: z.number().int().nonnegative(),
      deletedTtsAudio: z.number().int().nonnegative(),
      ttlDays: z.number().int().min(1).max(365),
    }),
  })
  .strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isCleanupAuthorized(request: NextRequest): boolean {
  const adminToken = process.env.ADMIN_CLEANUP_TOKEN?.trim();

  if (!adminToken) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('x-admin-token') === adminToken;
}

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  if (!getSpotifySession(request)) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  if (!isCleanupAuthorized(request)) {
    return jsonError(
      'ADMIN_CLEANUP_NOT_AUTHORIZED',
      'Cache cleanup is not authorized on this deployment.',
      403,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = cleanupCacheInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid cache cleanup input.', 400);
  }

  const output = cleanupCacheOutputSchema.parse({
    ok: true,
    result: await cleanupDjCaches({ ttlDays: input.data.ttlDays }),
  });

  return NextResponse.json(output);
}
