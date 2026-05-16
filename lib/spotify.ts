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
  'user-read-recently-played',
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
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'SpotifyWebApiError';
    this.code = code;
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
        Authorization: `Basic ${Buffer.from(
          `${creds.clientId}:${creds.clientSecret}`,
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
        Authorization: `Basic ${Buffer.from(
          `${creds.clientId}:${creds.clientSecret}`,
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
  const playableTracks = tracks.filter((track) => track.is_playable !== false && track.is_playable !== null);

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

const spotifyRecentlyPlayedSchema = z.object({
  items: z.array(
    z.object({
      played_at: z.string(),
      track: z.object({
        name: z.string(),
        artists: z.array(z.object({ name: z.string() })),
      }),
    }),
  ),
});

export type SpotifyTrackSummary = {
  artist: string;
  popularity: number;
  title: string;
};

export type SpotifyRecentTrack = {
  artist: string;
  playedAt: string;
  title: string;
};

export type SpotifyListeningHistory = {
  recentlyPlayed: SpotifyRecentTrack[];
  topTracks: SpotifyTrackSummary[];
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

export async function fetchSpotifyRecentlyPlayed(
  accessToken: string,
  limit = 20,
): Promise<SpotifyRecentTrack[] | null> {
  try {
    const url = new URL('https://api.spotify.com/v1/me/player/recently-played');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(SPOTIFY_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as unknown;
    const parsed = spotifyRecentlyPlayedSchema.safeParse(json);

    if (!parsed.success) {
      return null;
    }

    return parsed.data.items.map((item) => ({
      artist: item.track.artists.map((a) => a.name).join(', '),
      playedAt: item.played_at,
      title: item.track.name,
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
