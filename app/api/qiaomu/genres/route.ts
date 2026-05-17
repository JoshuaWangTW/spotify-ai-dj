import { NextRequest, NextResponse } from 'next/server';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { getQiaomuGenreEntries } from '../../../../lib/qiaomu/local-genre-db';
import {
  findQiaomuGenreMatches,
  listQiaomuGenreSuggestions,
  type QiaomuGenreMatch,
  type QiaomuGenreSuggestion,
} from '../../../../lib/qiaomu/search';
import {
  qiaomuGenresInputSchema,
  qiaomuGenresOutputSchema,
  type QiaomuGenreHint,
} from '../../../../lib/qiaomu/schema';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function toGenreHint(match: QiaomuGenreMatch | QiaomuGenreSuggestion): QiaomuGenreHint {
  return {
    children: (match.children ?? []).slice(0, 8),
    description: match.description,
    name: match.name,
    parent: match.parent,
    related: (match.related ?? []).slice(0, 8),
    score: Math.round(match.score),
    source: match.source,
  };
}

export async function GET(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `qiaomu:genres:${session.user.id}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const input = qiaomuGenresInputSchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    q: request.nextUrl.searchParams.get('q') ?? undefined,
  });

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid qiaomu genre query.', 400);
  }

  const entries = await getQiaomuGenreEntries();
  const matches =
    input.data.q.length > 0
      ? findQiaomuGenreMatches(input.data.q, entries, input.data.limit)
      : listQiaomuGenreSuggestions(entries, input.data.limit);
  const output = qiaomuGenresOutputSchema.safeParse({
    configured: entries.length > 0,
    matches: matches.map(toGenreHint),
    ok: true,
  });

  if (!output.success) {
    return jsonError('QIAOMU_GENRES_OUTPUT_INVALID', 'Qiaomu genre output was invalid.', 500);
  }

  return NextResponse.json(output.data);
}
