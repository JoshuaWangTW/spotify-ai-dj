import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';

export const runtime = 'nodejs';

const feedbackTypeSchema = z.enum([
  'like',
  'dislike',
  'too_loud',
  'no_vocals',
  'work_focus',
  'more_detail',
]);

const trackFeedbackInputSchema = z
  .object({
    artistName: z.string().trim().min(1).max(160).optional(),
    context: z.string().trim().max(240).optional(),
    feedbackType: feedbackTypeSchema,
    spotifyTrackId: z.string().trim().min(1).max(80),
    trackName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

type FeedbackForSummary = {
  feedbackType: string;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function countFeedback(feedback: FeedbackForSummary[], type: string): number {
  return feedback.filter((item) => item.feedbackType === type).length;
}

function buildTasteSummary(feedback: FeedbackForSummary[]): string {
  const likes = countFeedback(feedback, 'like');
  const workFocus = countFeedback(feedback, 'work_focus');
  const moreDetail = countFeedback(feedback, 'more_detail');

  const parts = [];

  if (likes > 0) {
    parts.push(`使用者對 ${likes} 首推薦按過喜歡`);
  }

  if (workFocus > 0) {
    parts.push(`有 ${workFocus} 筆回饋表示適合工作情境`);
  }

  if (moreDetail > 0) {
    parts.push(`有 ${moreDetail} 筆回饋希望得到更深入導聆`);
  }

  return parts.length > 0 ? parts.join('；') : '';
}

function buildAvoidSummary(feedback: FeedbackForSummary[]): string {
  const dislikes = countFeedback(feedback, 'dislike');
  const tooLoud = countFeedback(feedback, 'too_loud');
  const noVocals = countFeedback(feedback, 'no_vocals');
  const parts = [];

  if (dislikes > 0) {
    parts.push(`避開類似 ${dislikes} 首被按不喜歡的曲目`);
  }

  if (tooLoud > 0) {
    parts.push(`有 ${tooLoud} 筆回饋指出太吵，降低能量與鼓點強度`);
  }

  if (noVocals > 0) {
    parts.push(`有 ${noVocals} 筆回饋要求不要人聲，優先 instrumental`);
  }

  return parts.length > 0 ? parts.join('；') : '';
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

  const input = trackFeedbackInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid track feedback input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = rateLimitRequest({
    key: `feedback:track:${session.user.id}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const context = JSON.stringify({
    artistName: input.data.artistName,
    context: input.data.context,
    trackName: input.data.trackName,
  });

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const feedback = await tx.trackFeedback.create({
        data: {
          context,
          feedbackType: input.data.feedbackType,
          spotifyTrackId: input.data.spotifyTrackId,
          userId: session.user.id,
        },
      });
      const feedbackCount = await tx.trackFeedback.count({
        where: {
          userId: session.user.id,
        },
      });
      let profileUpdated = false;

      if (feedbackCount % 10 === 0) {
        const recentFeedback = await tx.trackFeedback.findMany({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            feedbackType: true,
          },
          take: 50,
          where: {
            userId: session.user.id,
          },
        });

        await tx.musicProfile.upsert({
          where: {
            userId: session.user.id,
          },
          update: {
            avoidSummary: buildAvoidSummary(recentFeedback),
            tasteSummary: buildTasteSummary(recentFeedback),
          },
          create: {
            avoidSummary: buildAvoidSummary(recentFeedback),
            tasteSummary: buildTasteSummary(recentFeedback),
            userId: session.user.id,
          },
        });
        profileUpdated = true;
      }

      return {
        feedbackId: feedback.id,
        feedbackCount,
        profileUpdated,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (isPrismaError(error)) {
      return jsonError('DATABASE_REQUEST_FAILED', 'Database request failed.', 500);
    }

    throw error;
  }
}
