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
import { AnthropicLlmError } from '../../../../lib/llm/anthropic';
import { LlmProviderConfigError, createProviderRadioSegment } from '../../../../lib/llm/provider';
import { OpenAiRadioError } from '../../../../lib/llm/radio-openai';
import { determineRadioProgrammingContext } from '../../../../lib/radio/programming';
import { applyQiaomuGenreEnhancement } from '../../../../lib/radio/qiaomu-enhancer';
import { applyRadioSearchPolicy } from '../../../../lib/radio/search-policy';
import {
  radioStartInputSchema,
  radioStartOutputSchema,
  type RadioQueueWarning,
  type RadioSegmentPlanOutput,
} from '../../../../lib/radio/schema';
import type { QiaomuGenreHint } from '../../../../lib/qiaomu/schema';
import {
  queueSpotifyTracks,
  searchSpotifyTracks,
  SpotifyWebApiError,
  startSpotifyPlayback,
} from '../../../../lib/spotify';
import type { SpotifyTrackCandidate } from '../../../../lib/spotify-types';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildSegmentResponse(input: {
  genreHints?: QiaomuGenreHint[];
  id: string;
  index: number;
  plan: RadioSegmentPlanOutput;
  queuedTrackUris: string[];
  tracks: SpotifyTrackCandidate[];
}) {
  return {
    genreHints: input.genreHints ?? [],
    id: input.id,
    index: input.index,
    plan: input.plan,
    queuedTrackUris: input.queuedTrackUris,
    tracks: input.tracks.slice(0, 8),
  };
}

function isBlockingSpotifyRadioError(error: SpotifyWebApiError): boolean {
  return error.code === 'SPOTIFY_SEARCH_AUTH_FAILED' || error.code === 'SPOTIFY_SEARCH_FORBIDDEN';
}

function buildQueueWarning(error: SpotifyWebApiError): RadioQueueWarning {
  return {
    code: error.code,
    message: error.message,
    retryAfterSeconds: error.retryAfterSeconds,
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

  const input = radioStartInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid radio start input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `radio:start:${session.user.id}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
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

    const qiaomuPlan = await applyQiaomuGenreEnhancement({
      plan: applyRadioSearchPolicy(
        input.data.prompt,
        await createProviderRadioSegment(env, {
          llmModel: input.data.llmModel,
          llmProvider: input.data.llmProvider,
          profile: musicProfile,
          programming,
          prompt: input.data.prompt,
        }),
      ),
      prompt: input.data.prompt,
    });
    const plan = qiaomuPlan.plan;
    let tracks: SpotifyTrackCandidate[] = [];
    let queuedTrackUris: string[] = [];
    let queueWarning: RadioQueueWarning | undefined;

    try {
      tracks = await searchSpotifyTracks(token.accessToken, plan.spotifySearchQueries);
      const trackUrisToQueue = input.data.autoplayQueue
        ? tracks.map((track) => track.spotifyUri).slice(0, 8)
        : [];

      if (trackUrisToQueue.length > 0) {
        // Start-of-session: use PUT /me/player/play with the browser
        // deviceId so Spotify both (a) activates our Web Playback SDK
        // device and (b) immediately starts playing the queue. This
        // mirrors the Spotify AI DJ-style "tap -> music starts" UX.
        //
        // If no deviceId is provided (e.g. SDK still booting), fall
        // back to the queue endpoint, which requires an existing
        // active device and yields a friendly queueWarning otherwise.
        try {
          if (input.data.deviceId) {
            await startSpotifyPlayback(token.accessToken, trackUrisToQueue, input.data.deviceId);
          } else {
            await queueSpotifyTracks(token.accessToken, trackUrisToQueue);
          }
          queuedTrackUris = trackUrisToQueue;
        } catch (error) {
          if (error instanceof SpotifyWebApiError) {
            queueWarning = buildQueueWarning(error);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      if (error instanceof SpotifyWebApiError && !isBlockingSpotifyRadioError(error)) {
        queueWarning = buildQueueWarning(error);
      } else {
        throw error;
      }
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
            payload: { queueWarning, queuedTrackUris },
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
      queueWarning,
      segment: buildSegmentResponse({
        genreHints: qiaomuPlan.genreHints,
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

    if (error instanceof AnthropicLlmError || error instanceof LlmProviderConfigError) {
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
        'SERVER_CONFIG_INVALID',
        'Server environment configuration is invalid.',
        500,
      );
    }

    throw error;
  }
}
