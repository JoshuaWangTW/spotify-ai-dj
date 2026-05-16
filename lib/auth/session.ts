import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
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
  spotify?: {
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

type SignedSessionPayload = {
  createdAt: number;
  displayName: string;
  sessionId: string;
  spotifyConnected: boolean;
  userId: string;
  version: 1;
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

function getSessionSigningSecret(): string | null {
  return process.env.NEXTAUTH_SECRET || null;
}

function signSessionPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function buildSessionCookieValue(session: SpotifyTokenSession): string {
  const secret = getSessionSigningSecret();

  if (!secret) {
    return session.id;
  }

  const payload: SignedSessionPayload = {
    createdAt: session.createdAt,
    displayName: session.user.displayName,
    sessionId: session.id,
    spotifyConnected: session.spotify !== undefined,
    userId: session.user.id,
    version: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signSessionPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function parseSignedSessionCookie(value: string): SignedSessionPayload | null {
  const secret = getSessionSigningSecret();

  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = value.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<SignedSessionPayload>;

    if (
      payload.version !== 1 ||
      typeof payload.sessionId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.displayName !== 'string' ||
      typeof payload.createdAt !== 'number'
    ) {
      return null;
    }

    return {
      createdAt: payload.createdAt,
      displayName: payload.displayName,
      sessionId: payload.sessionId,
      spotifyConnected: payload.spotifyConnected === true,
      userId: payload.userId,
      version: 1,
    };
  } catch {
    return null;
  }
}

export function getSignedSessionPayloadFromCookie(value: string): SignedSessionPayload | null {
  const signedSession = parseSignedSessionCookie(value);

  if (!signedSession) {
    return null;
  }

  if (Date.now() - signedSession.createdAt > SESSION_MAX_AGE_MS) {
    getSessionStore().delete(signedSession.sessionId);
    return null;
  }

  return signedSession;
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
  user: {
    displayName?: string | null;
    id: string;
  },
  token?: {
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
      id: user.id,
      displayName: user.displayName ?? 'Spotify user',
    },
    spotify: token
      ? {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          tokenType: token.tokenType,
          scope: token.scope,
          expiresAt: now + token.expiresIn * 1000,
        }
      : undefined,
    createdAt: now,
  };

  const store = getSessionStore();
  pruneExpiredSessions(store, now);
  store.set(sessionId, session);
  pruneOldestSessions(store);

  response.cookies.set(SPOTIFY_SESSION_COOKIE, buildSessionCookieValue(session), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: isProduction(),
  });

  return session;
}

export function rememberSpotifySession(session: SpotifyTokenSession): void {
  const store = getSessionStore();
  pruneExpiredSessions(store, Date.now());
  store.set(session.id, session);
  pruneOldestSessions(store);
}

export function getSpotifySession(request: NextRequest): SpotifyTokenSession | null {
  const sessionCookie = request.cookies.get(SPOTIFY_SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return null;
  }

  const store = getSessionStore();
  const legacySession = store.get(sessionCookie);

  if (legacySession) {
    if (Date.now() - legacySession.createdAt > SESSION_MAX_AGE_MS) {
      store.delete(legacySession.id);
      return null;
    }

    return legacySession;
  }

  const signedSession = parseSignedSessionCookie(sessionCookie);

  if (!signedSession) {
    return null;
  }

  if (Date.now() - signedSession.createdAt > SESSION_MAX_AGE_MS) {
    store.delete(signedSession.sessionId);
    return null;
  }

  return (
    store.get(signedSession.sessionId) ?? {
      id: signedSession.sessionId,
      user: {
        id: signedSession.userId,
        displayName: signedSession.displayName,
      },
      createdAt: signedSession.createdAt,
    }
  );
}
