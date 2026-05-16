import 'server-only';

import { z } from 'zod';

import type { SpotifyTrackCandidate } from './spotify-types';

export type SpotifyAppCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_QUEUE_URL = 'https://api.spotify.com/v1/me/player/queue';
const SPOTIFY_PLAYER_URL = 'https://api.spotify.com/v1/me/player';
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
  explicit: z.boolean().default(false),
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  duration_ms: z.number().int().nonnegative().optional(),
  id: z.string(),
  is_playable: z.boolean().nullable().optional(),
  name: z.string(),
  popularity: z.number().int().min(0).max(100).optional().default(0),
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

const spotifyPlaybackResponseSchema = z
  .object({
    is_playing: z.boolean().optional(),
    item: spotifySearchTrackSchema.nullable().optional(),
    progress_ms: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough();

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
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(code: string, message: string, status = 502, retryAfterSeconds?: number) {
    super(message);
    this.name = 'SpotifyWebApiError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export type SpotifyPlaybackSnapshot = {
  artistName?: string;
  durationMs?: number;
  isPlaying?: boolean;
  progressMs?: number;
  spotifyUri?: string;
  trackName?: string;
};

export function buildSpotifyAuthorizeUrl(creds: SpotifyAppCredentials, state: string): string {
  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', creds.clientId);
  authorizeUrl.searchParams.set('scope', SPOTIFY_MVP_SCOPES.join(' '));
  authorizeUrl.searchParams.set('redirect_uri', creds.redirectUri);
  authorizeUrl.searchParams.set('state', state);

  return authorizeUrl.toString();
}

export async function exchangeSpotifyAuthorizationCode(
  creds: SpotifyAppCredentials,
  code: string,
): Promise<SpotifyTokenResponse> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: creds.redirectUri,
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
          'base64',
        )}`,
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
  creds: SpotifyAppCredentials,
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
        Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
          'base64',
        )}`,
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

function selectBestTrackCandidates(
  tracks: Array<z.infer<typeof spotifySearchTrackSchema>>,
): Array<z.infer<typeof spotifySearchTrackSchema>> {
  const playableTracks = tracks.filter(
    (track) => track.is_playable !== false && track.is_playable !== null,
  );

  return playableTracks.sort((first, second) => {
    if (first.explicit !== second.explicit) {
      return first.explicit ? 1 : -1;
    }

    return second.popularity - first.popularity;
  });
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  const retryAt = Date.parse(value);

  if (!Number.isNaN(retryAt)) {
    return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
  }

  return undefined;
}

function createSpotifySearchStatusError(response: Response): SpotifyWebApiError {
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));

  if (response.status === 401) {
    return new SpotifyWebApiError(
      'SPOTIFY_SEARCH_AUTH_FAILED',
      'Spotify login expired. Please reconnect Spotify.',
      401,
    );
  }

  if (response.status === 403) {
    return new SpotifyWebApiError(
      'SPOTIFY_SEARCH_FORBIDDEN',
      'Spotify search was denied. Please check Spotify app access or reconnect Spotify.',
      403,
    );
  }

  if (response.status === 429) {
    return new SpotifyWebApiError(
      'SPOTIFY_SEARCH_RATE_LIMITED',
      retryAfterSeconds
        ? `Spotify rate limit was reached. Please try again in about ${retryAfterSeconds} seconds.`
        : 'Spotify rate limit was reached. Please try again later.',
      429,
      retryAfterSeconds,
    );
  }

  return new SpotifyWebApiError('SPOTIFY_SEARCH_FAILED', 'Spotify search failed.', 502);
}

function isFatalSpotifySearchError(error: SpotifyWebApiError): boolean {
  return (
    error.code === 'SPOTIFY_SEARCH_AUTH_FAILED' ||
    error.code === 'SPOTIFY_SEARCH_FORBIDDEN' ||
    error.code === 'SPOTIFY_SEARCH_RATE_LIMITED'
  );
}

async function searchSpotifyTrackCandidatesForQuery(
  accessToken: string,
  query: string,
): Promise<SpotifyTrackCandidate[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const searchUrl = new URL(SPOTIFY_SEARCH_URL);
  searchUrl.searchParams.set('q', normalizedQuery);
  searchUrl.searchParams.set('type', 'track');
  searchUrl.searchParams.set('limit', '5');
  searchUrl.searchParams.set('market', 'from_token');

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(SPOTIFY_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw createSpotifySearchStatusError(response);
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

  return selectBestTrackCandidates(parsed.data.tracks.items)
    .slice(0, 3)
    .map((track) => normalizeSpotifyTrack(normalizedQuery, track));
}

export async function searchSpotifyTracks(
  accessToken: string,
  queries: string[],
): Promise<SpotifyTrackCandidate[]> {
  const candidates: SpotifyTrackCandidate[] = [];
  const seenUris = new Set<string>();
  let recoverableFailureCount = 0;

  for (const query of queries) {
    if (candidates.length >= 8) {
      break;
    }

    try {
      const queryCandidates = await searchSpotifyTrackCandidatesForQuery(accessToken, query);

      for (const candidate of queryCandidates) {
        if (seenUris.has(candidate.spotifyUri)) {
          continue;
        }

        candidates.push(candidate);
        seenUris.add(candidate.spotifyUri);

        if (candidates.length >= 8) {
          break;
        }
      }
    } catch (error) {
      if (error instanceof SpotifyWebApiError) {
        if (isFatalSpotifySearchError(error)) {
          throw error;
        }

        recoverableFailureCount += 1;
        continue;
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        recoverableFailureCount += 1;
        continue;
      }

      throw new SpotifyWebApiError('SPOTIFY_SEARCH_FAILED', 'Spotify search failed.', 502);
    }
  }

  if (candidates.length === 0) {
    throw new SpotifyWebApiError(
      recoverableFailureCount > 0 ? 'SPOTIFY_SEARCH_UNAVAILABLE' : 'SPOTIFY_SEARCH_NO_RESULTS',
      recoverableFailureCount > 0
        ? 'Spotify search was temporarily unavailable. Please try again.'
        : 'Spotify search returned no playable tracks. Try a more specific prompt.',
      502,
    );
  }

  return candidates;
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

/**
 * Starts playback of the given Spotify URIs on a specific device.
 * Uses PUT /me/player/play with a device_id query param. Unlike the queue
 * endpoint, this:
 *   - activates the target device if it is registered but inactive
 *   - replaces Spotify's current playback queue with `spotifyUris`
 *   - immediately starts playing `spotifyUris[0]`
 *
 * This is what the Spotify AI DJ-style "submit prompt -> music starts now"
 * flow needs. Falls back to a SpotifyWebApiError on non-2xx.
 */
export async function startSpotifyPlayback(
  accessToken: string,
  spotifyUris: string[],
  deviceId?: string,
): Promise<void> {
  if (spotifyUris.length === 0) {
    return;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const playUrl = new URL(SPOTIFY_PLAYER_URL + '/play');
    if (deviceId) {
      playUrl.searchParams.set('device_id', deviceId);
    }

    const response = await fetch(playUrl, {
      body: JSON.stringify({ uris: spotifyUris.slice(0, 50) }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      signal: abortController.signal,
    });

    if (!response.ok && response.status !== 204) {
      const status = response.status === 404 ? 409 : 502;
      const code =
        response.status === 404
          ? 'SPOTIFY_NO_ACTIVE_DEVICE'
          : response.status === 403
            ? 'SPOTIFY_PLAYBACK_FORBIDDEN'
            : 'SPOTIFY_PLAYBACK_FAILED';
      const message =
        response.status === 403
          ? 'Spotify playback was forbidden. Premium account required.'
          : 'Spotify playback request failed.';

      throw new SpotifyWebApiError(code, message, status);
    }
  } catch (error) {
    if (error instanceof SpotifyWebApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyWebApiError(
        'SPOTIFY_PLAYBACK_TIMEOUT',
        'Spotify playback request timed out.',
        504,
      );
    }

    throw new SpotifyWebApiError(
      'SPOTIFY_PLAYBACK_FAILED',
      'Spotify playback request failed.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSpotifyPlaybackState(
  accessToken: string,
): Promise<SpotifyPlaybackSnapshot | null> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), SPOTIFY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SPOTIFY_PLAYER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: abortController.signal,
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new SpotifyWebApiError(
        'SPOTIFY_PLAYBACK_STATE_FAILED',
        'Spotify playback state request failed.',
        response.status === 404 ? 409 : 502,
      );
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyPlaybackResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new SpotifyWebApiError(
        'SPOTIFY_PLAYBACK_STATE_INVALID',
        'Spotify playback state response was invalid.',
        502,
      );
    }

    const track = parsed.data.item;

    if (!track) {
      return {
        isPlaying: parsed.data.is_playing,
        progressMs: parsed.data.progress_ms ?? undefined,
      };
    }

    return {
      artistName: track.artists.map((artist) => artist.name).join(', '),
      durationMs: track.duration_ms,
      isPlaying: parsed.data.is_playing,
      progressMs: parsed.data.progress_ms ?? undefined,
      spotifyUri: track.uri,
      trackName: track.name,
    };
  } catch (error) {
    if (error instanceof SpotifyWebApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SpotifyWebApiError(
        'SPOTIFY_PLAYBACK_STATE_TIMEOUT',
        'Spotify playback state request timed out.',
        504,
      );
    }

    throw new SpotifyWebApiError(
      'SPOTIFY_PLAYBACK_STATE_FAILED',
      'Spotify playback state request failed.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

const spotifyTopTrackSchema = z.object({
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })),
  popularity: z.number().int().min(0).max(100).default(0),
});

const spotifyTopTracksResponseSchema = z.object({
  items: z.array(spotifyTopTrackSchema),
});

export type SpotifyTrackSummary = {
  artist: string;
  popularity: number;
  title: string;
};

export async function fetchSpotifyTopTracks(
  accessToken: string,
  limit = 20,
): Promise<SpotifyTrackSummary[] | null> {
  try {
    const url = new URL('https://api.spotify.com/v1/me/top/tracks');
    url.searchParams.set('time_range', 'medium_term');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(SPOTIFY_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyTopTracksResponseSchema.safeParse(json);

    if (!parsed.success) {
      return null;
    }

    return parsed.data.items.map((track) => ({
      artist: track.artists.map((a) => a.name).join(', '),
      popularity: track.popularity,
      title: track.name,
    }));
  } catch {
    return null;
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
