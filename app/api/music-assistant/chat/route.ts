import { NextRequest, NextResponse } from 'next/server';

import { rateLimitRequest, validateSameOriginRequest } from '../../../../lib/api/security';
import { getSpotifySession } from '../../../../lib/auth/session';
import { getValidSpotifyAccessToken } from '../../../../lib/auth/spotify-access-token';
import { EnvValidationError, getServerEnv } from '../../../../lib/config/env';
import { isPrismaError } from '../../../../lib/db/errors';
import { prisma } from '../../../../lib/db/prisma';
import {
  createOpenAiMusicAssistantReply,
  OpenAiMusicAssistantError,
} from '../../../../lib/llm/music-assistant-openai';
import {
  musicAssistantChatInputSchema,
  musicAssistantChatOutputSchema,
  type MusicAssistantOutput,
} from '../../../../lib/music-assistant/schema';
import { fetchSpotifyTopTracks, type SpotifyTrackSummary } from '../../../../lib/spotify';

export const runtime = 'nodejs';

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function buildProfileSummaryPatch(output: MusicAssistantOutput): {
  avoidSummary?: string;
  tasteSummary?: string;
} {
  const patch: {
    avoidSummary?: string;
    tasteSummary?: string;
  } = {};

  if (output.profileSummaryPatch.avoidSummary) {
    patch.avoidSummary = output.profileSummaryPatch.avoidSummary;
  }

  if (output.profileSummaryPatch.tasteSummary) {
    patch.tasteSummary = output.profileSummaryPatch.tasteSummary;
  }

  return patch;
}

function buildSpotifyTasteSummary(tracks: SpotifyTrackSummary[] | null): {
  signals: string[];
  source: string;
  summary: string;
} | null {
  if (!tracks || tracks.length === 0) {
    return null;
  }

  const artistCounts = new Map<string, number>();

  for (const track of tracks) {
    for (const artist of track.artist
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    }
  }

  const frequentArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist, count]) => `${artist} (${count})`);
  const averagePopularity = Math.round(
    tracks.reduce((sum, track) => sum + track.popularity, 0) / tracks.length,
  );
  const signals = [`top_tracks_count=${tracks.length}`, `average_popularity=${averagePopularity}`];

  if (frequentArtists.length > 0) {
    signals.push(`frequent_artists=${frequentArtists.join(', ')}`);
  }

  return {
    signals,
    source: 'spotify_top_tracks_medium_term_opt_in',
    summary: [
      `使用者已明確允許使用 Spotify 中期 Top Tracks 摘要。`,
      `共有 ${tracks.length} 首可分析曲目。`,
      frequentArtists.length > 0 ? `常見藝人：${frequentArtists.join('、')}。` : '',
      `平均 popularity 約 ${averagePopularity}/100。`,
    ]
      .filter(Boolean)
      .join(''),
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

  const input = musicAssistantChatInputSchema.safeParse(body);

  if (!input.success) {
    return jsonError('INVALID_INPUT', 'Invalid music assistant chat input.', 400);
  }

  const session = getSpotifySession(request);

  if (!session) {
    return jsonError('SESSION_REQUIRED', 'Login is required.', 401);
  }

  const rateLimitError = await rateLimitRequest({
    key: `music-assistant:chat:${session.user.id}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const env = getServerEnv();
    const conversation = input.data.conversationId
      ? await prisma.assistantConversation.findFirst({
          where: {
            id: input.data.conversationId,
            status: 'active',
            userId: session.user.id,
          },
        })
      : await prisma.assistantConversation.create({
          data: {
            title: input.data.message.slice(0, 80),
            userId: session.user.id,
          },
        });

    if (!conversation) {
      return jsonError('CONVERSATION_NOT_FOUND', 'Assistant conversation was not found.', 404);
    }

    const spotifyToken = input.data.includeSpotifyTaste
      ? await getValidSpotifyAccessToken(request).catch(() => null)
      : null;

    const [musicProfile, memory, recentMessages, topTracks] = await Promise.all([
      prisma.musicProfile.findUnique({
        select: {
          avoidSummary: true,
          classicalLevel: true,
          jazzLevel: true,
          tasteSummary: true,
        },
        where: { userId: session.user.id },
      }),
      prisma.musicMemory.findMany({
        orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
        select: {
          confidence: true,
          content: true,
          type: true,
        },
        take: 20,
        where: {
          status: 'active',
          userId: session.user.id,
        },
      }),
      prisma.assistantMessage.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          role: true,
        },
        take: 10,
        where: { conversationId: conversation.id },
      }),
      spotifyToken ? fetchSpotifyTopTracks(spotifyToken.accessToken) : Promise.resolve(null),
    ]);
    const spotifyTasteSummary = buildSpotifyTasteSummary(topTracks);

    const assistantOutput = await createOpenAiMusicAssistantReply(env.OPENAI_API_KEY, {
      memory,
      message: input.data.message,
      profile: musicProfile,
      recentMessages: recentMessages.reverse(),
      spotifyTasteSummary,
    });
    const profilePatch = buildProfileSummaryPatch(assistantOutput);

    const result = await prisma.$transaction(async (tx: any) => {
      await tx.assistantMessage.create({
        data: {
          content: input.data.message,
          conversationId: conversation.id,
          role: 'user',
        },
      });

      const assistantMessage = await tx.assistantMessage.create({
        data: {
          content: assistantOutput.reply,
          conversationId: conversation.id,
          metadata: {
            memoryCandidates: assistantOutput.memoryCandidates,
            suggestedRadioPrompt: assistantOutput.suggestedRadioPrompt,
          },
          role: 'assistant',
        },
      });

      const savedMemories = [];

      for (const candidate of assistantOutput.memoryCandidates) {
        if (candidate.confidence < 0.55) {
          savedMemories.push({
            ...candidate,
            saved: false,
          });
          continue;
        }

        const saved = await tx.musicMemory.create({
          data: {
            confidence: candidate.confidence,
            content: candidate.content,
            source: 'assistant_chat',
            type: candidate.type,
            userId: session.user.id,
          },
        });

        savedMemories.push({
          ...candidate,
          id: saved.id,
          saved: true,
        });
      }

      let profileUpdated = false;

      if (profilePatch.avoidSummary || profilePatch.tasteSummary) {
        await tx.musicProfile.upsert({
          create: {
            avoidSummary: profilePatch.avoidSummary ?? '',
            tasteSummary: profilePatch.tasteSummary ?? '',
            userId: session.user.id,
          },
          update: profilePatch,
          where: { userId: session.user.id },
        });
        profileUpdated = true;
      }

      await tx.assistantConversation.update({
        data: {
          updatedAt: new Date(),
        },
        where: { id: conversation.id },
      });

      return {
        assistantMessageId: assistantMessage.id,
        profileUpdated,
        savedMemories,
      };
    });

    const output = {
      conversationId: conversation.id,
      memoryCandidates: result.savedMemories,
      profileUpdated: result.profileUpdated,
      reply: assistantOutput.reply,
      suggestedRadioPrompt: assistantOutput.suggestedRadioPrompt || undefined,
    };
    const parsedOutput = musicAssistantChatOutputSchema.safeParse(output);

    if (!parsedOutput.success) {
      return jsonError(
        'MUSIC_ASSISTANT_OUTPUT_INVALID',
        'Music assistant output was invalid.',
        500,
      );
    }

    return NextResponse.json(parsedOutput.data);
  } catch (error) {
    if (error instanceof OpenAiMusicAssistantError) {
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
