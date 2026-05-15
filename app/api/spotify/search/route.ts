import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';
import { searchSpotifyTracks, SpotifyWebApiError } from '../../../../lib/spotify';

export const runtime = 'nodejs';

const spotifySearchInputSchema = z
  .object({
    queries: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
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

  const input = spotifySearchInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid Spotify search input.', 400);
  }

  try {
    const token = await getValidSpotifyAccessToken(request);
    const tracks = await searchSpotifyTracks(token.accessToken, input.data.queries);

    return NextResponse.json({ tracks });
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
