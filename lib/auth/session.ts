import 'server-only';

import { randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const SPOTIFY_OAUTH_STATE_COOKIE = 'spotify_ai_dj_oauth_state';
export const SPOTIFY_SESSION_COOKIE = 'spotify_ai_dj_session';

const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const MAX_MOCK_SESSIONS = 500;

export type SpotifyTokenSession = {
  id: string;
  user: {
    id: string;
    displayName: string;
  };
  spotify: {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    scope: string;
    expiresAt: number;
  };
  createdAt: number;
};

type SessionStore = Map<string, SpotifyTokenSession>;

type GlobalWithSpotifySessionStore = typeof globalThis & {
  __spotifyAiDjSessionStore?: SessionStore;
};

function getSessionStore(): SessionStore {
  const globalStore = globalThis as GlobalWithSpotifySessionStore;

  if (!globalStore.__spotifyAiDjSessionStore) {
    globalStore.__spotifyAiDjSessionStore = new Map();
  }

  return globalStore.__spotifyAiDjSessionStore;
}

function pruneExpiredSessions(store: SessionStore, now: number): void {
  for (const [sessionId, session] of store) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      store.delete(sessionId);
    }
  }
}

function pruneOldestSessions(store: SessionStore): void {
  while (store.size > MAX_MOCK_SESSIONS) {
    const oldestSessionId = store.keys().next().value as string | undefined;

    if (!oldestSessionId) {
      return;
    }

    store.delete(oldestSessionId);
  }
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function setOAuthStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: isProduction(),
  });
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: isProduction(),
  });
}

export function validateOAuthState(request: NextRequest, receivedState: string): boolean {
  const expectedState = request.cookies.get(SPOTIFY_OAUTH_STATE_COOKIE)?.value;

  if (!expectedState) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedState);
  const receivedBuffer = Buffer.from(receivedState);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function createSpotifySession(
  response: NextResponse,
  token: {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    scope: string;
    expiresIn: number;
  },
): SpotifyTokenSession {
  const sessionId = generateOpaqueToken();
  const now = Date.now();
  const session: SpotifyTokenSession = {
    id: sessionId,
    user: {
      id: 'mock-spotify-user',
      displayName: 'Spotify user',
    },
    spotify: {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scope: token.scope,
      expiresAt: now + token.expiresIn * 1000,
    },
    createdAt: now,
  };

  const store = getSessionStore();
  pruneExpiredSessions(store, now);
  store.set(sessionId, session);
  pruneOldestSessions(store);

  response.cookies.set(SPOTIFY_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: isProduction(),
  });

  return session;
}

export function getSpotifySession(request: NextRequest): SpotifyTokenSession | null {
  const sessionId = request.cookies.get(SPOTIFY_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return null;
  }

  const store = getSessionStore();
  const session = store.get(sessionId);

  if (!session) {
    return null;
  }

  if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
    store.delete(sessionId);
    return null;
  }

  return session;
}
