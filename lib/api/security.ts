import { NextRequest, NextResponse } from 'next/server';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type GlobalWithRateLimit = typeof globalThis & {
  __spotifyAiDjRateLimits?: Map<string, RateLimitBucket>;
};

const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function getRateLimitStore(): Map<string, RateLimitBucket> {
  const globalStore = globalThis as GlobalWithRateLimit;

  if (!globalStore.__spotifyAiDjRateLimits) {
    globalStore.__spotifyAiDjRateLimits = new Map();
  }

  return globalStore.__spotifyAiDjRateLimits;
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

function cleanupExpiredBuckets(store: Map<string, RateLimitBucket>, now: number): void {
  if (now - lastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
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
}): NextResponse | null {
  const now = Date.now();
  const store = getRateLimitStore();
  cleanupExpiredBuckets(store, now);

  const existing = store.get(input.key);

  if (!existing || existing.resetAt <= now) {
    store.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });
    return null;
  }

  existing.count += 1;

  if (existing.count > input.limit) {
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
