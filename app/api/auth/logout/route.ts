import { NextRequest, NextResponse } from 'next/server';
import { getSpotifySession, SPOTIFY_SESSION_COOKIE } from '../../../../lib/auth/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  getSpotifySession(request);
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
