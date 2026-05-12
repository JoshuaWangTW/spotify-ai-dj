import 'server-only';

import { z } from 'zod';

import type { ServerEnv } from './config/env';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_REQUEST_TIMEOUT_MS = 10_000;

export const SPOTIFY_MVP_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-top-read',
] as const;

const spotifyTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  scope: z.string().default(''),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
});

export type SpotifyTokenResponse = {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn: number;
  refreshToken?: string;
};

export class SpotifyTokenExchangeError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'SpotifyTokenExchangeError';
    this.status = status;
  }
}

export function buildSpotifyAuthorizeUrl(env: ServerEnv, state: string): string {
  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', env.SPOTIFY_CLIENT_ID);
  authorizeUrl.searchParams.set('scope', SPOTIFY_MVP_SCOPES.join(' '));
  authorizeUrl.searchParams.set('redirect_uri', env.SPOTIFY_REDIRECT_URI);
  authorizeUrl.searchParams.set('state', state);

  return authorizeUrl.toString();
}

export async function exchangeSpotifyAuthorizationCode(
  env: ServerEnv,
  code: string,
): Promise<SpotifyTokenResponse> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.SPOTIFY_REDIRECT_URI,
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new SpotifyTokenExchangeError('Spotify token exchange failed.', response.status);
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyTokenResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new SpotifyTokenExchangeError('Spotify token response was invalid.');
    }

    return {
      accessToken: parsed.data.access_token,
      expiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token,
      scope: parsed.data.scope,
      tokenType: parsed.data.token_type,
    };
  } catch (error) {
    if (error instanceof SpotifyTokenExchangeError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyTokenExchangeError('Spotify token exchange timed out.', 504);
    }

    throw new SpotifyTokenExchangeError('Spotify token exchange failed.');
  } finally {
    clearTimeout(timeout);
  }
}
