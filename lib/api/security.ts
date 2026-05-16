import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '../db/prisma';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getAllowedOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>([request.nextUrl.origin]);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = request.headers.get('host')?.trim();
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (forwardedHost && forwardedProto) {
    origins.add(`${forwardedProto}://${forwardedHost}`);
  }

  if (host) {
    origins.add(`${request.nextUrl.protocol}//${host}`);
  }

  if (publicAppUrl) {
    try {
      origins.add(new URL(publicAppUrl).origin);
    } catch {
      // Ignore invalid deployment metadata instead of failing every request.
    }
  }

  return origins;
}

export function validateSameOriginRequest(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');

  if (!origin) {
    return null;
  }

  if (!getAllowedOrigins(request).has(origin)) {
    return jsonError('INVALID_ORIGIN', 'Cross-site request origin is not allowed.', 403);
  }

  return null;
}

export function rateLimitRequest(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<NextResponse | null> {
  return rateLimitRequestWithDatabase(input);
}

async function rateLimitRequestWithDatabase(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<NextResponse | null> {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + input.windowMs);
  const existing = await prisma.rateLimitBucket.findUnique({
    where: { key: input.key },
  });

  if (!existing) {
    try {
      await prisma.rateLimitBucket.create({
        data: {
          count: 1,
          key: input.key,
          resetAt: nextResetAt,
        },
      });
      return null;
    } catch {
      const updated = await prisma.rateLimitBucket.update({
        data: {
          count: {
            increment: 1,
          },
        },
        where: { key: input.key },
      });

      return updated.count > input.limit
        ? jsonError('RATE_LIMITED', 'Too many requests. Please try again later.', 429)
        : null;
    }
  }

  if (existing.resetAt <= now) {
    await prisma.rateLimitBucket.update({
      data: {
        count: 1,
        resetAt: nextResetAt,
      },
      where: { key: input.key },
    });
    return null;
  }

  const updated = await prisma.rateLimitBucket.update({
    data: {
      count: {
        increment: 1,
      },
    },
    where: { key: input.key },
  });

  if (updated.count > input.limit) {
    return jsonError('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }

  return null;
}

export function getRequestRateLimitKey(request: NextRequest, prefix: string): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const identity = forwardedFor || realIp || 'unknown';

  return `${prefix}:${identity}`;
}
