import { NextRequest, NextResponse } from 'next/server';

import { validateSameOriginRequest } from '../../../../../lib/api/security';
import { getSpotifySession } from '../../../../../lib/auth/session';
import { readDjAudioCache } from '../../../../../lib/tts/file-cache';

export const runtime = 'nodejs';

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest, context: { params: { hash: string } }) {
  const originError = validateSameOriginRequest(request);

  if (originError) {
    return originError;
  }

  if (!getSpotifySession(request)) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const { hash } = context.params;

  if (!HASH_PATTERN.test(hash)) {
    return jsonError('INVALID_AUDIO_HASH', 'Invalid DJ audio hash.', 400);
  }

  const audio = await readDjAudioCache(hash);

  if (!audio) {
    return jsonError('DJ_AUDIO_NOT_FOUND', 'DJ audio cache entry was not found.', 404);
  }

  return new NextResponse(audio, {
    headers: {
      'Cache-Control': 'private, max-age=604800, immutable',
      'Content-Type': 'audio/mpeg',
    },
  });
}
