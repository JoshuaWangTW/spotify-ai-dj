import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/db/prisma';
import { verifyPassword } from '../../../../lib/auth/password';
import { createSpotifySession } from '../../../../lib/auth/session';
import {
  getRequestRateLimitKey,
  rateLimitRequest,
  validateSameOriginRequest,
} from '../../../../lib/api/security';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  const rateLimitError = await rateLimitRequest({
    key: getRequestRateLimitKey(request, 'auth:login'),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  createSpotifySession(response, { id: user.id, displayName: user.displayName });
  return response;
}
