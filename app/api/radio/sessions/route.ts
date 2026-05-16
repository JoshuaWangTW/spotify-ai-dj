// app/api/radio/sessions/route.ts
// Lists the user's radio sessions for the Library tab.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';

export const runtime = 'nodejs';

export const radioSessionSummarySchema = z.object({
  id: z.string(),
  status: z.enum(['active', 'stopped']),
  mode: z.string(),
  userPrompt: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  segmentCount: z.number().int().nonnegative(),
});

export const radioSessionsOutputSchema = z.object({
  ok: z.literal(true),
  sessions: z.array(radioSessionSummarySchema),
});

export type RadioSessionSummary = z.infer<typeof radioSessionSummarySchema>;
export type RadioSessionsOutput = z.infer<typeof radioSessionsOutputSchema>;

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
    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await prisma.radioSegment.groupBy({
          by: ['sessionId'],
          where: { sessionId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(counts.map((c) => [c.sessionId, c._count._all] as const));

    const sessions = rows.map((row) => ({
      id: row.id,
      status: row.status as 'active' | 'stopped',
      mode: row.mode,
      userPrompt: row.userPrompt,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      segmentCount: countMap.get(row.id) ?? 0,
    }));

    return NextResponse.json({ ok: true, sessions });
  } catch (error) {
    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }
    throw error;
  }
}
