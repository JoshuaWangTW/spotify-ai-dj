import { NextRequest, NextResponse } from 'next/server';

import { aiDjPlanInputSchema } from '../../../../lib/ai-dj/plan-schema';
import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { AnthropicLlmError } from '../../../../lib/llm/anthropic';
import { OpenAiPlanError } from '../../../../lib/llm/openai';
import { createProviderDjPlan, LlmProviderConfigError } from '../../../../lib/llm/provider';

export const runtime = 'nodejs';

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
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = aiDjPlanInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid AI DJ plan input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `ai-dj:plan:${session.user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const env = getServerEnv();

    const musicProfile = await prisma.musicProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        avoidSummary: true,
        classicalLevel: true,
        jazzLevel: true,
        tasteSummary: true,
      },
    });

    const plan = await createProviderDjPlan(env, input.data, musicProfile);

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof OpenAiPlanError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (error instanceof AnthropicLlmError || error instanceof LlmProviderConfigError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }

    if (error instanceof EnvValidationError) {
      return jsonError(
        'SERVER_CONFIG_INVALID',
        'Server environment configuration is invalid.',
        500,
      );
    }

    throw error;
  }
}
