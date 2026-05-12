import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateServerEnv } from '../../../../lib/config/env';

const configCheckQuerySchema = z.object({}).strict();

export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Not found.',
        },
      },
      { status: 404 },
    );
  }

  const query = configCheckQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_QUERY',
          message: 'This endpoint does not accept query parameters.',
        },
      },
      { status: 400 },
    );
  }

  const env = validateServerEnv();

  if (!env.success) {
    return NextResponse.json(
      {
        error: {
          code: 'ENV_VALIDATION_FAILED',
          message: 'Missing or invalid server environment variables.',
          issueCount: env.issues.length,
          issues: env.issues,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    config: {
      appUrl: env.data.NEXT_PUBLIC_APP_URL,
      llmProvider: env.data.LLM_PROVIDER,
      hasDatabaseUrl: Boolean(env.data.DATABASE_URL),
      hasSpotifyConfig: Boolean(
        env.data.SPOTIFY_CLIENT_ID &&
        env.data.SPOTIFY_CLIENT_SECRET &&
        env.data.SPOTIFY_REDIRECT_URI,
      ),
      hasOpenAiKey: Boolean(env.data.OPENAI_API_KEY),
      hasAnthropicKey: Boolean(env.data.ANTHROPIC_API_KEY),
      hasRedisUrl: Boolean(env.data.REDIS_URL),
    },
  });
}
