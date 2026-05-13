import 'server-only';

import { NextRequest } from 'next/server';

import { getSpotifySession, rememberSpotifySession } from './session';
import {
  decryptSpotifyRefreshToken,
  encryptSpotifyRefreshToken,
  TokenEncryptionError,
} from './token-encryption';
import { EnvValidationError, getServerEnv } from '../config/env';
import { isPrismaError } from '../db/errors';
import { prisma } from '../db/prisma';
import { refreshSpotifyAccessToken, SpotifyTokenExchangeError } from '../spotify';

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

async function getStoredRefreshToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    select: {
      spotifyRefreshToken: true,
    },
    where: {
      id: userId,
    },
  });

  if (!user) {
    return null;
  }

  return decryptSpotifyRefreshToken(user.spotifyRefreshToken);
}

async function persistRotatedRefreshToken(userId: string, refreshToken?: string): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.user.update({
    data: {
      spotifyRefreshToken: encryptSpotifyRefreshToken(refreshToken),
    },
    where: {
      id: userId,
    },
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
      const env = getServerEnv();
      const refreshToken =
        session.spotify?.refreshToken ?? (await getStoredRefreshToken(session.user.id));

      if (!refreshToken) {
        throw new SpotifyAccessTokenError(
          'SPOTIFY_REFRESH_TOKEN_MISSING',
          'Spotify login must be repeated.',
          401,
        );
      }

      const refreshedToken = await refreshSpotifyAccessToken(env, refreshToken);

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

      if (error instanceof EnvValidationError) {
        throw new SpotifyAccessTokenError(
          'ENV_VALIDATION_FAILED',
          'Missing or invalid server environment variables.',
          500,
        );
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
