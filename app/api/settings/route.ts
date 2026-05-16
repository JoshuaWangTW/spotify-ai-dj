import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSpotifySession } from '../../../lib/auth/session';
import { rateLimitRequest, validateSameOriginRequest } from '../../../lib/api/security';
import { validateServerEnv } from '../../../lib/config/env';
import {
  ANTHROPIC_MODEL_OPTIONS,
  DEFAULT_LLM_MODEL,
  OPENAI_MODEL_OPTIONS,
  resolveLlmModel,
} from '../../../lib/llm/model-options';

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

export async function GET(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const query = settingsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!query.success) {
    return jsonError('INVALID_QUERY', 'This endpoint does not accept query parameters.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `settings:${session.user.id}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const env = validateServerEnv();

  if (!env.success) {
    return NextResponse.json({
      ok: false,
      issueCount: env.issues.length,
      anthropicConfigured: false,
      anthropicDefaultModel: resolveLlmModel(null, 'anthropic'),
      anthropicModelOptions: ANTHROPIC_MODEL_OPTIONS,
      llmProvider: null,
      openAiDefaultModel: DEFAULT_LLM_MODEL,
      openAiModelOptions: OPENAI_MODEL_OPTIONS,
      openAiConfigured: false,
      spotifyConfigured: false,
    });
  }

  return NextResponse.json({
    ok: true,
    issueCount: 0,
    anthropicConfigured: Boolean(env.data.ANTHROPIC_API_KEY),
    anthropicDefaultModel: resolveLlmModel(env.data.ANTHROPIC_MODEL, 'anthropic'),
    anthropicModelOptions: ANTHROPIC_MODEL_OPTIONS,
    llmProvider: env.data.LLM_PROVIDER,
    openAiDefaultModel: resolveLlmModel(env.data.OPENAI_MODEL),
    openAiModelOptions: OPENAI_MODEL_OPTIONS,
    openAiConfigured: Boolean(env.data.OPENAI_API_KEY),
    spotifyConfigured: Boolean(
      env.data.SPOTIFY_CLIENT_ID && env.data.SPOTIFY_CLIENT_SECRET && env.data.SPOTIFY_REDIRECT_URI,
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
