import { NextRequest, NextResponse } from 'next/server';

import { validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { radioSessionsOutputSchema } from '../../../../lib/radio/session-list-schema';

export const runtime = 'nodejs';

type RadioSessionRow = {
  endedAt: Date | null;
  id: string;
  mode: string;
  startedAt: Date;
  status: string;
  userPrompt: string;
};

type RadioSegmentCountRow = {
  _count: {
    _all: number;
  };
  sessionId: string;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const originError = validateSameOriginRequest(request);
  if (originError) return originError;

  const session = getSpotifySession(request);
  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  try {
    const rows = await prisma.radioSession.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        mode: true,
        userPrompt: true,
        startedAt: true,
        endedAt: true,
      },
    });

    // Pull segment counts in one extra query so we don't need to know the
    // Prisma relation back-reference name.
    const ids = rows.map((row: RadioSessionRow) => row.id);
    const counts = ids.length
      ? await prisma.radioSegment.groupBy({
          by: ['sessionId'],
          where: { sessionId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(
      (counts as RadioSegmentCountRow[]).map(
        (count) => [count.sessionId, count._count._all] as const,
      ),
    );

    const sessions = (rows as RadioSessionRow[]).map((row) => ({
      id: row.id,
      status: row.status as 'active' | 'stopped',
      mode: row.mode,
      userPrompt: row.userPrompt,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      segmentCount: countMap.get(row.id) ?? 0,
    }));
    const output = radioSessionsOutputSchema.safeParse({ ok: true, sessions });

    if (!output.success) {
      return jsonError('RADIO_SESSIONS_OUTPUT_INVALID', 'Radio sessions output was invalid.', 500);
    }

    return NextResponse.json(output.data);
  } catch (error) {
    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }
    throw error;
  }
}
