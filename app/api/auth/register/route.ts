import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db/prisma';
import { hashPassword } from '../../../../lib/auth/password';
import { createSpotifySession } from '../../../../lib/auth/session';
import {
  getRequestRateLimitKey,
  rateLimitRequest,
  validateSameOriginRequest,
} from '../../../../lib/api/security';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const rateLimitError = rateLimitRequest({
    key: getRequestRateLimitKey(request, 'auth:register'),
    limit: 10,
    windowMs: 30 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: displayName ?? null,
      musicProfile: { create: {} },
    },
  });

  const response = NextResponse.json({ ok: true }, { status: 201 });
  createSpotifySession(response, { id: user.id, displayName: user.displayName });
  return response;
}
