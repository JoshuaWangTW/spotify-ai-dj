import { NextRequest, NextResponse } from 'next/server';

import { aiDjPlanInputSchema } from '../../../../lib/ai-dj/plan-schema';
import { getSpotifySession } from '../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { createOpenAiDjPlan, OpenAiPlanError } from '../../../../lib/llm/openai';

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

  try {
    const env = getServerEnv();

    if (env.LLM_PROVIDER !== 'openai') {
      return jsonError('LLM_PROVIDER_UNSUPPORTED', 'Only OpenAI is supported for plan MVP.', 501);
    }

    const session = getSpotifySession(request);
    const musicProfile =
      session && session.user.id !== 'mock-spotify-user'
        ? await prisma.musicProfile.findUnique({
            where: {
              userId: session.user.id,
            },
            select: {
              avoidSummary: true,
              classicalLevel: true,
              jazzLevel: true,
              tasteSummary: true,
            },
          })
        : null;
    const plan = await createOpenAiDjPlan(env.OPENAI_API_KEY, input.data, musicProfile);

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return jsonError(
        'ENV_VALIDATION_FAILED',
        'Missing or invalid server environment variables.',
        500,
      );
    }

    if (error instanceof OpenAiPlanError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }

    throw error;
  }
}
