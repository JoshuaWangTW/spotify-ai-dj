import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../../lib/auth/spotify-access-token';

export const runtime = 'nodejs';

const tokenQuerySchema = z.object({}).strict();
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { headers: NO_STORE_HEADERS, status },
  );
}

export async function GET(request: NextRequest) {
  const query = tokenQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return jsonError('INVALID_QUERY', 'This endpoint does not accept query parameters.', 400);
  }

  try {
    const token = await getValidSpotifyAccessToken(request);

    return NextResponse.json(
      {
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof SpotifyAccessTokenError) {
      return jsonError(error.code, error.message, error.status);
    }

    throw error;
  }
}
