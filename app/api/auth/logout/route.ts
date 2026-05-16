import { NextRequest, NextResponse } from 'next/server';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession, SPOTIFY_SESSION_COOKIE } from '../../../../lib/auth/session';

export const runtime = 'nodejs';

function methodNotAllowed() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST to logout.' } },
    {
      headers: { Allow: 'POST' },
      status: 405,
    },
  );
}

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const session = getSpotifySession(request);

  if (session) {
    const rateLimitError = await rateLimitRequest({
      key: `auth:logout:${session.user.id}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }
  }

  const response = NextResponse.redirect(new URL('/auth/login', request.url));
  response.cookies.set(SPOTIFY_SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export function GET() {
  return methodNotAllowed();
}
