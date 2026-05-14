import { NextRequest, NextResponse } from 'next/server';

import { getSpotifySession, generateOpaqueToken, setOAuthStateCookie } from '../../../../../lib/auth/session';
import { decryptSecret } from '../../../../../lib/auth/token-encryption';
import { prisma } from '../../../../../lib/db/prisma';
import { buildSpotifyAuthorizeUrl, type SpotifyAppCredentials } from '../../../../../lib/spotify';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = getSpotifySession(request);
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { spotifyClientId: true },
  });

  if (!user?.spotifyClientId) {
    return NextResponse.redirect(new URL('/settings?error=missing_spotify_credentials', request.url));
  }

  const clientId = decryptSecret(user.spotifyClientId);
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? '';

  const creds: SpotifyAppCredentials = { clientId, clientSecret: '', redirectUri };
  const state = generateOpaqueToken();
  const response = NextResponse.redirect(buildSpotifyAuthorizeUrl(creds, state));
  setOAuthStateCookie(response, state);

  return response;
}
