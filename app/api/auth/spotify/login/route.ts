import { NextRequest, NextResponse } from 'next/server';

import { getSpotifySession, generateOpaqueToken, setOAuthStateCookie } from '../../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';
import { buildSpotifyAuthorizeUrl, type SpotifyAppCredentials } from '../../../../../lib/spotify';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = getSpotifySession(request);
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    const env = getServerEnv();
    const creds: SpotifyAppCredentials = {
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      redirectUri: env.SPOTIFY_REDIRECT_URI,
    };
    const state = generateOpaqueToken();
    const response = NextResponse.redirect(buildSpotifyAuthorizeUrl(creds, state));
    setOAuthStateCookie(response, state);

    return response;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return NextResponse.redirect(new URL('/settings?error=server_config_missing', request.url));
    }

    throw error;
  }
}
