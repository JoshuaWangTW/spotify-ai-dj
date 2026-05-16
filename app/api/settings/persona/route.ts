import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { prisma } from '../../../../lib/db/prisma';
import { PERSONAS, getDjPersona } from '../../../../lib/dj/personas';

export const runtime = 'nodejs';

const personaIdSchema = z.enum(['friend', 'hyped', 'midnight', 'scholar']);

const updatePersonaInputSchema = z
  .object({
    personaId: personaIdSchema,
  })
  .strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
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

  const user = await prisma.user.findUnique({
    select: {
      djPersonaId: true,
    },
    where: {
      id: session.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    personaId: getDjPersona(user?.djPersonaId).id,
    personas: Object.values(PERSONAS).map((persona) => ({
      id: persona.id,
      name: persona.name,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `settings:persona:${session.user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = updatePersonaInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid DJ persona input.', 400);
  }

  const user = await prisma.user.update({
    data: {
      djPersonaId: input.data.personaId,
    },
    select: {
      djPersonaId: true,
    },
    where: {
      id: session.user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    personaId: getDjPersona(user.djPersonaId).id,
  });
}
