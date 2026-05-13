import 'server-only';

import { z } from 'zod';

import type { SpotifyTrackCandidate } from './spotify-types';
import type { ServerEnv } from './config/env';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_QUEUE_URL = 'https://api.spotify.com/v1/me/player/queue';
const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me';
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

const spotifySearchTrackSchema = z.object({
  album: z.object({
    images: z.array(
      z.object({
        url: z.string().url(),
      }),
    ),
    name: z.string(),
  }),
  artists: z.array(
    z.object({
      name: z.string(),
    }),
  ),
  explicit: z.boolean(),
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  id: z.string(),
  is_playable: z.boolean().optional(),
  name: z.string(),
  popularity: z.number().int().min(0).max(100),
  uri: z.string(),
});

const spotifySearchResponseSchema = z.object({
  tracks: z.object({
    items: z.array(spotifySearchTrackSchema),
  }),
});

const spotifyUserProfileSchema = z.object({
  display_name: z.string().nullable().optional(),
  id: z.string().min(1),
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

export class SpotifyWebApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'SpotifyWebApiError';
    this.code = code;
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
      throw new SpotifyTokenExchangeError('Spotify token exchange failed.', 502);
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

export async function refreshSpotifyAccessToken(
  env: ServerEnv,
  refreshToken: string,
): Promise<SpotifyTokenResponse> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
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
      throw new SpotifyTokenExchangeError('Spotify token refresh failed.', 502);
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyTokenResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new SpotifyTokenExchangeError('Spotify token refresh response was invalid.');
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
      throw new SpotifyTokenExchangeError('Spotify token refresh timed out.', 504);
    }

    throw new SpotifyTokenExchangeError('Spotify token refresh failed.');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSpotifyTrack(
  query: string,
  track: z.infer<typeof spotifySearchTrackSchema>,
): SpotifyTrackCandidate {
  return {
    album: track.album.name,
    albumImageUrl: track.album.images[0]?.url,
    artist: track.artists.map((artist) => artist.name).join(', '),
    explicit: track.explicit,
    popularity: track.popularity,
    query,
    spotifyUri: track.uri,
    spotifyUrl: track.external_urls.spotify,
    title: track.name,
  };
}

function selectBestTrackCandidate(
  tracks: Array<z.infer<typeof spotifySearchTrackSchema>>,
): z.infer<typeof spotifySearchTrackSchema> | null {
  const playableTracks = tracks.filter((track) => track.is_playable !== false);

  return (
    playableTracks.sort((first, second) => {
      if (first.explicit !== second.explicit) {
        return first.explicit ? 1 : -1;
      }

      return second.popularity - first.popularity;
    })[0] ?? null
  );
}

export async function searchSpotifyTracks(
  accessToken: string,
  queries: string[],
): Promise<SpotifyTrackCandidate[]> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const candidates = await Promise.all(
      queries.map(async (query) => {
        const searchUrl = new URL(SPOTIFY_SEARCH_URL);
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('type', 'track');
        searchUrl.searchParams.set('limit', '3');

        const response = await fetch(searchUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new SpotifyWebApiError('SPOTIFY_SEARCH_FAILED', 'Spotify search failed.', 502);
        }

        const json = (await response.json()) as unknown;
        const parsed = spotifySearchResponseSchema.safeParse(json);

        if (!parsed.success) {
          throw new SpotifyWebApiError(
            'SPOTIFY_SEARCH_RESPONSE_INVALID',
            'Spotify search response was invalid.',
            502,
          );
        }

        const selectedTrack = selectBestTrackCandidate(parsed.data.tracks.items);

        return selectedTrack ? normalizeSpotifyTrack(query, selectedTrack) : null;
      }),
    );

    return candidates.filter((candidate): candidate is SpotifyTrackCandidate => Boolean(candidate));
  } catch (error) {
    if (error instanceof SpotifyWebApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyWebApiError('SPOTIFY_SEARCH_TIMEOUT', 'Spotify search timed out.', 504);
    }

    throw new SpotifyWebApiError('SPOTIFY_SEARCH_FAILED', 'Spotify search failed.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function queueSpotifyTracks(
  accessToken: string,
  spotifyUris: string[],
): Promise<void> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    for (const spotifyUri of spotifyUris) {
      const queueUrl = new URL(SPOTIFY_QUEUE_URL);
      queueUrl.searchParams.set('uri', spotifyUri);

      const response = await fetch(queueUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        const status = response.status === 404 ? 409 : 502;
        const code = response.status === 404 ? 'SPOTIFY_NO_ACTIVE_DEVICE' : 'SPOTIFY_QUEUE_FAILED';

        throw new SpotifyWebApiError(code, 'Spotify queue request failed.', status);
      }
    }
  } catch (error) {
    if (error instanceof SpotifyWebApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyWebApiError(
        'SPOTIFY_QUEUE_TIMEOUT',
        'Spotify queue request timed out.',
        504,
      );
    }

    throw new SpotifyWebApiError('SPOTIFY_QUEUE_FAILED', 'Spotify queue request failed.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSpotifyUserProfile(accessToken: string): Promise<{
  displayName?: string | null;
  spotifyUserId: string;
}> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SPOTIFY_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new SpotifyWebApiError(
        'SPOTIFY_PROFILE_FAILED',
        'Spotify profile request failed.',
        502,
      );
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyUserProfileSchema.safeParse(json);

    if (!parsed.success) {
      throw new SpotifyWebApiError(
        'SPOTIFY_PROFILE_RESPONSE_INVALID',
        'Spotify profile response was invalid.',
        502,
      );
    }

    return {
      displayName: parsed.data.display_name,
      spotifyUserId: parsed.data.id,
    };
  } catch (error) {
    if (error instanceof SpotifyWebApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyWebApiError('SPOTIFY_PROFILE_TIMEOUT', 'Spotify profile timed out.', 504);
    }

    throw new SpotifyWebApiError('SPOTIFY_PROFILE_FAILED', 'Spotify profile request failed.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
