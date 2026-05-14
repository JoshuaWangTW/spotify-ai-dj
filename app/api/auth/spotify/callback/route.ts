import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '../../../../../lib/db/prisma';
import {
  clearOAuthStateCookie,
  createSpotifySession,
  getSpotifySession,
  validateOAuthState,
} from '../../../../../lib/auth/session';
import {
  encryptSpotifyRefreshToken,
} from '../../../../../lib/auth/token-encryption';
import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';
import {
  exchangeSpotifyAuthorizationCode,
  fetchSpotifyUserProfile,
  SpotifyTokenExchangeError,
  SpotifyWebApiError,
  type SpotifyAppCredentials,
} from '../../../../../lib/spotify';
import { isPrismaError } from '../../../../../lib/db/errors';

export const runtime = 'nodejs';

const callbackQuerySchema = z
  .object({
    code: z.string().min(1).max(4096).optional(),
    error: z.string().min(1).max(200).optional(),
    state: z.string().min(1).max(256),
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

function redirectWithAuthStatus(appUrl: string, key: string, value: string): NextResponse {
  const redirectUrl = new URL('/', appUrl);
  redirectUrl.searchParams.set(key, value);

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const query = callbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return jsonError('INVALID_QUERY', 'Invalid Spotify OAuth callback query.', 400);
  }

  if (!validateOAuthState(request, query.data.state)) {
    const response = jsonError('OAUTH_STATE_MISMATCH', 'Spotify OAuth state did not match.', 400);
    clearOAuthStateCookie(response);
    return response;
  }

  const session = getSpotifySession(request);
  if (!session) {
    const response = jsonError('SESSION_REQUIRED', 'Login session is required.', 401);
    clearOAuthStateCookie(response);
    return response;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  if (query.data.error) {
    const response = redirectWithAuthStatus(appUrl, 'auth_error', 'spotify_denied');
    clearOAuthStateCookie(response);
    return response;
  }

  if (!query.data.code) {
    const response = jsonError('MISSING_AUTH_CODE', 'Spotify OAuth callback is missing code.', 400);
    clearOAuthStateCookie(response);
    return response;
  }

  try {
    const env = getServerEnv();
    const creds: SpotifyAppCredentials = {
      clientId: env.SPOTIFY_CLIENT_ID,
      clientSecret: env.SPOTIFY_CLIENT_SECRET,
      redirectUri: env.SPOTIFY_REDIRECT_URI,
    };
    const token = await exchangeSpotifyAuthorizationCode(creds, query.data.code);

    if (!token.refreshToken) {
      const response = jsonError(
        'SPOTIFY_REFRESH_TOKEN_MISSING',
        'Spotify OAuth response did not include a refresh token.',
        502,
      );
      clearOAuthStateCookie(response);
      return response;
    }

    const spotifyProfile = await fetchSpotifyUserProfile(token.accessToken);
    const encryptedRefreshToken = encryptSpotifyRefreshToken(token.refreshToken);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        spotifyUserId: spotifyProfile.spotifyUserId,
        displayName: spotifyProfile.displayName,
        spotifyRefreshToken: encryptedRefreshToken,
      },
    });

    const updatedUser = { id: session.user.id, displayName: spotifyProfile.displayName };
    const response = redirectWithAuthStatus(appUrl, 'auth', 'spotify_connected');

    clearOAuthStateCookie(response);
    createSpotifySession(response, updatedUser, token);

    return response;
  } catch (error) {
    if (error instanceof SpotifyTokenExchangeError) {
      const response = jsonError(
        'SPOTIFY_TOKEN_EXCHANGE_FAILED',
        'Spotify token exchange failed.',
        error.status,
      );
      clearOAuthStateCookie(response);
      return response;
    }

    if (error instanceof SpotifyWebApiError) {
      const response = jsonError(error.code, error.message, error.status);
      clearOAuthStateCookie(response);
      return response;
    }

    if (isPrismaError(error)) {
      const response = jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
      clearOAuthStateCookie(response);
      return response;
    }

    if (error instanceof EnvValidationError) {
      const response = jsonError(
        'SERVER_CONFIG_MISSING',
        'Required server configuration is missing.',
        500,
      );
      clearOAuthStateCookie(response);
      return response;
    }

    throw error;
  }
}
