import { NextRequest, NextResponse } from 'next/server';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { radioStopInputSchema, radioStopOutputSchema } from '../../../../lib/radio/schema';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
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

  const input = radioStopInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid radio stop input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `radio:stop:${session.user.id}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const radioSession = await prisma.radioSession.findFirst({
      where: {
        id: input.data.sessionId,
        status: 'active',
        userId: session.user.id,
      },
    });

    if (!radioSession) {
      return jsonError('RADIO_SESSION_NOT_FOUND', 'Active radio session was not found.', 404);
    }

    const endedAt = new Date();

    await prisma.$transaction(async (tx: any) => {
      await tx.radioSession.update({
        data: {
          endedAt,
          status: 'stopped',
        },
        where: { id: radioSession.id },
      });

      await tx.radioEvent.create({
        data: {
          payload: { endedAt: endedAt.toISOString() },
          sessionId: radioSession.id,
          type: 'session_stopped',
        },
      });
    });

    const output = {
      ok: true,
      session: {
        endedAt: endedAt.toISOString(),
        id: radioSession.id,
        status: 'stopped',
      },
    };
    const parsedOutput = radioStopOutputSchema.safeParse(output);

    if (!parsedOutput.success) {
      return jsonError('RADIO_STOP_OUTPUT_INVALID', 'Radio stop output was invalid.', 500);
    }

    return NextResponse.json(parsedOutput.data);
  } catch (error) {
    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }

    throw error;
  }
}
