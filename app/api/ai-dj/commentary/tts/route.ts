import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSpotifySession } from '../../../../../lib/auth/session';
import { EnvValidationError, getServerEnv } from '../../../../../lib/config/env';

export const runtime = 'nodejs';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TTS_TIMEOUT_MS = 20_000;

const commentaryTtsInputSchema = z
  .object({
    text: z.string().trim().min(1).max(1200),
  })
  .strict();

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
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

  let apiKey: string;

  try {
    const env = getServerEnv();
    apiKey = env.OPENAI_API_KEY;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return jsonError(
        'OPENAI_API_KEY_MISSING',
        'OpenAI API key is not configured on the server.',
        500,
      );
    }
    throw error;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_TTS_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        format: 'mp3',
        input: input.data.text,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      return jsonError('OPENAI_TTS_REQUEST_FAILED', 'OpenAI TTS request failed.', 502);
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonError('OPENAI_TTS_TIMEOUT', 'OpenAI TTS request timed out.', 504);
    }

    return jsonError('OPENAI_TTS_REQUEST_FAILED', 'OpenAI TTS request failed.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
