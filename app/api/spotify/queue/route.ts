import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';
import { queueSpotifyTracks, SpotifyWebApiError } from '../../../../lib/spotify';

export const runtime = 'nodejs';

const spotifyQueueInputSchema = z
  .object({
    spotifyUris: z
      .array(z.string().regex(/^spotify:track:[A-Za-z0-9]+$/))
      .min(1)
      .max(20),
  })
  .strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = spotifyQueueInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid Spotify queue input.', 400);
  }

  try {
    const token = await getValidSpotifyAccessToken(request);
    await queueSpotifyTracks(token.accessToken, input.data.spotifyUris);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SpotifyAccessTokenError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (error instanceof SpotifyWebApiError) {
      return jsonError(error.code, error.message, error.status);
    }

    throw error;
  }
}
