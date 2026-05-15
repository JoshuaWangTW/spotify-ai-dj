import { NextRequest, NextResponse } from 'next/server';

import { getSpotifySession } from '../../../../lib/auth/session';
import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { OpenAiRadioError, createOpenAiRadioSegment } from '../../../../lib/llm/radio-openai';
import { determineRadioProgrammingContext } from '../../../../lib/radio/programming';
import {
  radioStartInputSchema,
  radioStartOutputSchema,
  type RadioSegmentPlanOutput,
} from '../../../../lib/radio/schema';
import { queueSpotifyTracks, searchSpotifyTracks, SpotifyWebApiError } from '../../../../lib/spotify';
import type { SpotifyTrackCandidate } from '../../../../lib/spotify-types';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildSegmentResponse(input: {
  id: string;
  index: number;
  plan: RadioSegmentPlanOutput;
  queuedTrackUris: string[];
  tracks: SpotifyTrackCandidate[];
}) {
  return {
    id: input.id,
    index: input.index,
    plan: input.plan,
    queuedTrackUris: input.queuedTrackUris,
    tracks: input.tracks.slice(0, 8),
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', 400);
  }

  const input = radioStartInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid radio start input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  try {
    const env = getServerEnv();
    const token = await getValidSpotifyAccessToken(request);
    const programming = determineRadioProgrammingContext(input.data);

    const musicProfile = await prisma.musicProfile.findUnique({
      select: {
        avoidSummary: true,
        classicalLevel: true,
        jazzLevel: true,
        tasteSummary: true,
      },
      where: { userId: session.user.id },
    });

    const plan = await createOpenAiRadioSegment(env.OPENAI_API_KEY, {
      profile: musicProfile,
      programming,
      prompt: input.data.prompt,
    });
    const tracks = await searchSpotifyTracks(token.accessToken, plan.spotifySearchQueries);
    const queuedTrackUris = input.data.autoplayQueue
      ? tracks.map((track) => track.spotifyUri).slice(0, 8)
      : [];

    if (queuedTrackUris.length > 0) {
      await queueSpotifyTracks(token.accessToken, queuedTrackUris);
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const radioSession = await tx.radioSession.create({
        data: {
          currentSegmentIndex: 1,
          mode: programming.mode,
          programmingContext: programming,
          status: 'active',
          userId: session.user.id,
          userPrompt: input.data.prompt,
        },
      });

      const segment = await tx.radioSegment.create({
        data: {
          djIntro: plan.djIntro,
          energy: plan.energy,
          index: 1,
          mode: plan.mode,
          planJson: plan,
          queuedTrackUris,
          sessionId: radioSession.id,
          situation: plan.situation,
          trackQueries: plan.spotifySearchQueries,
        },
      });

      await tx.radioEvent.createMany({
        data: [
          {
            payload: { programming },
            sessionId: radioSession.id,
            type: 'session_started',
          },
          {
            payload: { queuedTrackUris },
            segmentId: segment.id,
            sessionId: radioSession.id,
            type: 'segment_queued',
          },
        ],
      });

      return { radioSession, segment };
    });

    const output = {
      ok: true,
      segment: buildSegmentResponse({
        id: result.segment.id,
        index: result.segment.index,
        plan,
        queuedTrackUris,
        tracks,
      }),
      session: {
        id: result.radioSession.id,
        mode: programming.mode,
        status: 'active',
        userPrompt: input.data.prompt,
      },
    };
    const parsedOutput = radioStartOutputSchema.safeParse(output);

    if (!parsedOutput.success) {
      return jsonError('RADIO_START_OUTPUT_INVALID', 'Radio start output was invalid.', 500);
    }

    return NextResponse.json(parsedOutput.data);
  } catch (error) {
    if (error instanceof OpenAiRadioError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (error instanceof SpotifyAccessTokenError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (error instanceof SpotifyWebApiError) {
      return jsonError(error.code, error.message, error.status);
    }

    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }

    if (error instanceof EnvValidationError) {
      return jsonError(
        'OPENAI_API_KEY_MISSING',
        'OpenAI API key is not configured on the server.',
        500,
      );
    }

    throw error;
  }
}
