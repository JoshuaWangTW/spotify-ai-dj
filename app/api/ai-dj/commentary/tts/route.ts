import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../../lib/api/security';
import {
  DEFAULT_OPENAI_TTS_VOICE,
  openAiTtsVoiceSchema,
} from '../../../../../lib/ai-dj/tts-schema';
import { getSpotifySession } from '../../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';
import { synthesizeWithFallback } from '../../../../../lib/tts/with-fallback';

export const runtime = 'nodejs';

const commentaryTtsInputSchema = z
  .object({
    text: z.string().trim().min(1).max(1200),
    voice: openAiTtsVoiceSchema.default(DEFAULT_OPENAI_TTS_VOICE),
  })
  .strict();

const voiceMap = {
  coral: 'zh-TW-HsiaoChenNeural',
  marin: 'zh-TW-YunJheNeural',
  nova: 'zh-TW-HsiaoChenNeural',
  shimmer: 'zh-TW-HsiaoYuNeural',
} satisfies Record<z.infer<typeof openAiTtsVoiceSchema>, string>;

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

  const input = commentaryTtsInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid commentary TTS input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `ai-dj:tts:${session.user.id}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const env = getServerEnv();
    const tts = await synthesizeWithFallback({
      env,
      text: input.data.text,
      timeoutMs: 6_000,
      voiceId: voiceMap[input.data.voice],
    });

    if (!tts.result) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'X-DJ-TTS-Fallback': 'browser',
        },
      });
    }

    return new NextResponse(tts.result.audioBuffer, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'audio/mpeg',
        'X-DJ-TTS-Provider': tts.provider,
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return jsonError(
        'SERVER_CONFIG_INVALID',
        'Server environment configuration is invalid.',
        500,
      );
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        'X-DJ-TTS-Fallback': 'browser',
      },
    });
  }
}
