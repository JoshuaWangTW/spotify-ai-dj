import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';

export const runtime = 'nodejs';

const inputSchema = z.object({ deviceId: z.string().min(1) }).strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = inputSchema.safeParse(body);
  if (!input.success) {
    return jsonError('INVALID_INPUT', 'deviceId is required.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = rateLimitRequest({
    key: `spotify:transfer:${session.user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const token = await getValidSpotifyAccessToken(request);

    const response = await fetch('https://api.spotify.com/v1/me/player', {
      body: JSON.stringify({ device_ids: [input.data.deviceId], play: false }),
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    });

    if (!response.ok && response.status !== 204) {
      return jsonError('TRANSFER_FAILED', 'Failed to transfer playback.', 502);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SpotifyAccessTokenError) {
      return jsonError(error.code, error.message, error.status);
    }
    throw error;
  }
}
