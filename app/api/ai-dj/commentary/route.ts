import { NextRequest, NextResponse } from 'next/server';

import {
  aiDjCommentaryInputSchema,
  type AiDjCommentaryOutput,
} from '../../../../lib/ai-dj/commentary-schema';
import { getSpotifySession } from '../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { createOpenAiDjCommentary, OpenAiCommentaryError } from '../../../../lib/llm/openai';

export const runtime = 'nodejs';

type CommentaryCache = Map<string, AiDjCommentaryOutput>;

type GlobalWithCommentaryCache = typeof globalThis & {
  __spotifyAiDjCommentaryCache?: CommentaryCache;
};

const MAX_COMMENTARY_CACHE_ITEMS = 300;

function getCommentaryCache(): CommentaryCache {
  const globalCache = globalThis as GlobalWithCommentaryCache;

  if (!globalCache.__spotifyAiDjCommentaryCache) {
    globalCache.__spotifyAiDjCommentaryCache = new Map();
  }

  return globalCache.__spotifyAiDjCommentaryCache;
}

function getCacheKey(input: {
  artistName: string;
  depth: string;
  mode: string;
  trackName: string;
}): string {
  return [input.trackName, input.artistName, input.mode, input.depth]
    .map((value) => value.trim().toLowerCase())
    .join('|');
}

function pruneCommentaryCache(cache: CommentaryCache): void {
  while (cache.size > MAX_COMMENTARY_CACHE_ITEMS) {
    const oldestKey = cache.keys().next().value as string | undefined;

    if (!oldestKey) {
      return;
    }

    cache.delete(oldestKey);
  }
}

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

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = aiDjCommentaryInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid AI DJ commentary input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const cache = getCommentaryCache();
  const cacheKey = getCacheKey(input.data);
  const cachedCommentary = cache.get(cacheKey);

  if (cachedCommentary) {
    return NextResponse.json(cachedCommentary);
  }

  try {
    const env = getServerEnv();
    const commentary = await createOpenAiDjCommentary(env.OPENAI_API_KEY, input.data);

    cache.set(cacheKey, commentary);
    pruneCommentaryCache(cache);

    return NextResponse.json(commentary);
  } catch (error) {
    if (error instanceof OpenAiCommentaryError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (error instanceof EnvValidationError) {
      return jsonError(
        'OPENAI_API_KEY_MISSING',
        'OpenAI API key is not configured on the server.',
        500,
      );
    }

    throw error;
  }
}
