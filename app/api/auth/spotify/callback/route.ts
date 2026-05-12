import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';
import {
  clearOAuthStateCookie,
  createSpotifySession,
  validateOAuthState,
} from '../../../../../lib/auth/session';
import {
  exchangeSpotifyAuthorizationCode,
  SpotifyTokenExchangeError,
} from '../../../../../lib/spotify';

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

  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return jsonError(
        'ENV_VALIDATION_FAILED',
        'Missing or invalid server environment variables.',
        500,
      );
    }

    throw error;
  }

  if (!validateOAuthState(request, query.data.state)) {
    const response = jsonError('OAUTH_STATE_MISMATCH', 'Spotify OAuth state did not match.', 400);
    clearOAuthStateCookie(response);

    return response;
  }

  if (query.data.error) {
    const response = redirectWithAuthStatus(env.NEXT_PUBLIC_APP_URL, 'auth_error', 'spotify_denied');
    clearOAuthStateCookie(response);

    return response;
  }

  if (!query.data.code) {
    const response = jsonError('MISSING_AUTH_CODE', 'Spotify OAuth callback is missing code.', 400);
    clearOAuthStateCookie(response);

    return response;
  }

  try {
    const token = await exchangeSpotifyAuthorizationCode(env, query.data.code);
    const response = redirectWithAuthStatus(env.NEXT_PUBLIC_APP_URL, 'auth', 'spotify_connected');

    clearOAuthStateCookie(response);
    createSpotifySession(response, token);

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

    throw error;
  }
}
