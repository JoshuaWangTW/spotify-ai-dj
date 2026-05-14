import 'server-only';

import { NextRequest } from 'next/server';

import { getSpotifySession, rememberSpotifySession } from './session';
import {
  decryptSecret,
  decryptSpotifyRefreshToken,
  encryptSpotifyRefreshToken,
  TokenEncryptionError,
} from './token-encryption';
import { isPrismaError } from '../db/errors';
import { prisma } from '../db/prisma';
import { refreshSpotifyAccessToken, SpotifyTokenExchangeError, type SpotifyAppCredentials } from '../spotify';

const TOKEN_REFRESH_SKEW_MS = 60 * 1000;

export class SpotifyAccessTokenError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'SpotifyAccessTokenError';
    this.code = code;
    this.status = status;
  }
}

async function getStoredCredentials(userId: string): Promise<{
  refreshToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
}> {
  const user = await prisma.user.findUnique({
    select: {
      spotifyRefreshToken: true,
      spotifyClientId: true,
      spotifyClientSecret: true,
    },
    where: { id: userId },
  });

  if (!user) {
    return { refreshToken: null, clientId: null, clientSecret: null };
  }

  return {
    refreshToken: user.spotifyRefreshToken
      ? decryptSpotifyRefreshToken(user.spotifyRefreshToken)
      : null,
    clientId: user.spotifyClientId ? decryptSecret(user.spotifyClientId) : null,
    clientSecret: user.spotifyClientSecret ? decryptSecret(user.spotifyClientSecret) : null,
  };
}

async function persistRotatedRefreshToken(userId: string, refreshToken?: string): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.user.update({
    data: {
      spotifyRefreshToken: encryptSpotifyRefreshToken(refreshToken),
    },
    where: { id: userId },
  });
}

export async function getValidSpotifyAccessToken(request: NextRequest): Promise<{
  accessToken: string;
  expiresAt: number;
  tokenType: string;
}> {
  const session = getSpotifySession(request);

  if (!session) {
    throw new SpotifyAccessTokenError(
      'SPOTIFY_SESSION_REQUIRED',
      'Spotify login is required.',
      401,
    );
  }

  if (!session.spotify || session.spotify.expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS) {
    try {
      const stored = await getStoredCredentials(session.user.id);

      if (!stored.clientId || !stored.clientSecret) {
        throw new SpotifyAccessTokenError(
          'SPOTIFY_CREDENTIALS_MISSING',
          'Spotify credentials not configured.',
          402,
        );
      }

      const refreshToken =
        session.spotify?.refreshToken ?? stored.refreshToken;

      if (!refreshToken) {
        throw new SpotifyAccessTokenError(
          'SPOTIFY_REFRESH_TOKEN_MISSING',
          'Spotify login must be repeated.',
          401,
        );
      }

      const creds: SpotifyAppCredentials = {
        clientId: stored.clientId,
        clientSecret: stored.clientSecret,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? '',
      };

      const refreshedToken = await refreshSpotifyAccessToken(creds, refreshToken);

      await persistRotatedRefreshToken(session.user.id, refreshedToken.refreshToken);

      session.spotify = {
        accessToken: refreshedToken.accessToken,
        expiresAt: Date.now() + refreshedToken.expiresIn * 1000,
        refreshToken: refreshedToken.refreshToken ?? refreshToken,
        scope: refreshedToken.scope,
        tokenType: refreshedToken.tokenType,
      };
      rememberSpotifySession(session);
    } catch (error) {
      if (error instanceof SpotifyAccessTokenError) {
        throw error;
      }

      if (error instanceof SpotifyTokenExchangeError) {
        throw new SpotifyAccessTokenError(
          'SPOTIFY_TOKEN_REFRESH_FAILED',
          'Spotify access token refresh failed.',
          error.status,
        );
      }

      if (isPrismaError(error)) {
        throw new SpotifyAccessTokenError(
          'DATABASE_REQUEST_FAILED',
          'Database request failed.',
          500,
        );
      }

      if (error instanceof TokenEncryptionError) {
        throw new SpotifyAccessTokenError(
          'SPOTIFY_REFRESH_TOKEN_INVALID',
          'Spotify login must be repeated.',
          401,
        );
      }

      throw error;
    }
  }

  if (!session.spotify) {
    throw new SpotifyAccessTokenError(
      'SPOTIFY_TOKEN_REFRESH_FAILED',
      'Spotify access token refresh failed.',
      401,
    );
  }

  return {
    accessToken: session.spotify.accessToken,
    expiresAt: session.spotify.expiresAt,
    tokenType: session.spotify.tokenType,
  };
}
