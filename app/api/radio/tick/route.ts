import { NextRequest, NextResponse } from 'next/server';

import { getSpotifySession } from '../../../../lib/auth/session';
import {
  getValidSpotifyAccessToken,
  SpotifyAccessTokenError,
} from '../../../../lib/auth/spotify-access-token';
import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import { OpenAiRadioError, createOpenAiRadioSegment } from '../../../../lib/llm/radio-openai';
import { determineRadioProgrammingContext } from '../../../../lib/radio/programming';
import {
  radioTickInputSchema,
  radioTickOutputSchema,
  type AiDjMode,
  type RadioSegmentPlanOutput,
} from '../../../../lib/radio/schema';
import {
  fetchSpotifyPlaybackState,
  queueSpotifyTracks,
  searchSpotifyTracks,
  SpotifyWebApiError,
} from '../../../../lib/spotify';
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

  const input = radioTickInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid radio tick input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = rateLimitRequest({
    key: `radio:tick:${session.user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const radioSession = await prisma.radioSession.findFirst({
      include: {
        segments: {
          orderBy: { index: 'desc' },
          take: 1,
        },
      },
      where: {
        id: input.data.sessionId,
        status: 'active',
        userId: session.user.id,
      },
    });

    if (!radioSession) {
      return jsonError('RADIO_SESSION_NOT_FOUND', 'Active radio session was not found.', 404);
    }

    const previousSegment = radioSession.segments[0] ?? null;
    const env = getServerEnv();
    const token = await getValidSpotifyAccessToken(request);
    const playbackState =
      input.data.playbackState ?? (await fetchSpotifyPlaybackState(token.accessToken)) ?? undefined;
    const programming = determineRadioProgrammingContext({
      clientTimeIso: input.data.clientTimeIso,
      mode: radioSession.mode as AiDjMode,
      prompt: radioSession.userPrompt,
      timezone: input.data.timezone,
    });

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
      feedback: input.data.feedback,
      playbackState,
      previousSegment,
      profile: musicProfile,
      programming,
      prompt: radioSession.userPrompt,
    });
    const tracks = await searchSpotifyTracks(token.accessToken, plan.spotifySearchQueries);
    const queuedTrackUris = input.data.autoplayQueue
      ? tracks.map((track) => track.spotifyUri).slice(0, 8)
      : [];

    if (queuedTrackUris.length > 0) {
      await queueSpotifyTracks(token.accessToken, queuedTrackUris);
    }

    const nextIndex = (previousSegment?.index ?? radioSession.currentSegmentIndex) + 1;

    const segment = await prisma.$transaction(async (tx: any) => {
      const createdSegment = await tx.radioSegment.create({
        data: {
          djIntro: plan.djIntro,
          energy: plan.energy,
          index: nextIndex,
          mode: plan.mode,
          planJson: plan,
          queuedTrackUris,
          sessionId: radioSession.id,
          situation: plan.situation,
          trackQueries: plan.spotifySearchQueries,
        },
      });

      await tx.radioSession.update({
        data: {
          currentSegmentIndex: nextIndex,
          mode: programming.mode,
          programmingContext: programming,
        },
        where: { id: radioSession.id },
      });

      await tx.radioEvent.create({
        data: {
          payload: {
            feedback: input.data.feedback,
            playbackState,
          },
          sessionId: radioSession.id,
          type: 'tick_requested',
        },
      });

      await tx.radioEvent.create({
        data: {
          payload: { queuedTrackUris },
          segmentId: createdSegment.id,
          sessionId: radioSession.id,
          type: 'segment_queued',
        },
      });

      const trackFeedback = input.data.feedback
        .filter((feedback) => feedback.spotifyTrackId)
        .map((feedback) => ({
          context: JSON.stringify({
            radioSessionId: radioSession.id,
            segmentId: createdSegment.id,
            trackName: feedback.trackName,
          }),
          feedbackType: feedback.feedbackType,
          spotifyTrackId: feedback.spotifyTrackId as string,
          userId: session.user.id,
        }));

      if (trackFeedback.length > 0) {
        await tx.trackFeedback.createMany({ data: trackFeedback });
      }

      return createdSegment;
    });

    const output = {
      ok: true,
      segment: buildSegmentResponse({
        id: segment.id,
        index: segment.index,
        plan,
        queuedTrackUris,
        tracks,
      }),
      session: {
        id: radioSession.id,
        mode: programming.mode,
        status: 'active',
      },
    };
    const parsedOutput = radioTickOutputSchema.safeParse(output);

    if (!parsedOutput.success) {
      return jsonError('RADIO_TICK_OUTPUT_INVALID', 'Radio tick output was invalid.', 500);
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
