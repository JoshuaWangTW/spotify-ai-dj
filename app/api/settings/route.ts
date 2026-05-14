import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSpotifySession } from '../../../lib/auth/session';
import { validateServerEnv } from '../../../lib/config/env';

export const runtime = 'nodejs';

const settingsQuerySchema = z.object({}).strict();

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

export function GET(request: NextRequest) {
  const query = settingsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return jsonError('INVALID_QUERY', 'This endpoint does not accept query parameters.', 400);
  }

  const session = getSpotifySession(request);
  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const env = validateServerEnv();

  if (!env.success) {
    return NextResponse.json({
      ok: false,
      issueCount: env.issues.length,
      llmProvider: null,
      openAiConfigured: false,
      spotifyConfigured: false,
    });
  }

  return NextResponse.json({
    ok: true,
    issueCount: 0,
    llmProvider: env.data.LLM_PROVIDER,
    openAiConfigured: Boolean(env.data.OPENAI_API_KEY),
    spotifyConfigured: Boolean(
      env.data.SPOTIFY_CLIENT_ID &&
        env.data.SPOTIFY_CLIENT_SECRET &&
        env.data.SPOTIFY_REDIRECT_URI,
    ),
  });
}

export function PUT() {
  return jsonError(
    'SETTINGS_READ_ONLY',
    'Server secrets must be configured through environment variables.',
    405,
  );
}
