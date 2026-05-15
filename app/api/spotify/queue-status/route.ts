import { NextRequest, NextResponse } from 'next/server';

import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const token = await getValidSpotifyAccessToken(request);

    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });

    if (!response.ok) {
      return jsonError('QUEUE_STATUS_FAILED', 'Failed to get queue status.', 502);
    }

    const data = (await response.json()) as { queue?: unknown[] };

    return NextResponse.json({ queueCount: data.queue?.length ?? 0 });
  } catch (error) {
    if (error instanceof SpotifyAccessTokenError) {
      return jsonError(error.code, error.message, error.status);
    }

    throw error;
  }
}
