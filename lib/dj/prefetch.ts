import { prisma } from '../db/prisma';
import { makeDjCacheKey, makeTtsScriptHash } from './cache';
import { getDjPersona } from './personas';
import { buildRuleBasedDjCue, type DjSchedulerTrack } from './scheduler';

export type PrefetchTrack = {
  artist: string;
  artistUris?: string[];
  id: string;
  title: string;
  uri: string;
};

export type PrefetchNextDjInput = {
  hour?: number;
  nextTrack: PrefetchTrack;
  personaId?: string | null;
  prevTrack: PrefetchTrack;
  userId: string;
  voiceId?: string;
};

export type PrefetchNextDjOutput = {
  audioUrl: string | null;
  cached: boolean;
  script: string;
};

function toSchedulerTrack(track: PrefetchTrack): DjSchedulerTrack {
  return {
    artist: track.artist,
    artistUris: track.artistUris ?? [],
    durationMs: 0,
    id: track.id,
    title: track.title,
    uri: track.uri,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

async function readOrCreateScript(
  input: Required<Pick<PrefetchNextDjInput, 'hour' | 'userId'>> & {
    nextTrack: PrefetchTrack;
    personaId: string;
    prevTrack: PrefetchTrack;
  },
): Promise<{ cached: boolean; script: string }> {
  const cacheKey = makeDjCacheKey({
    hour: input.hour,
    nextTrackId: input.nextTrack.id,
    personaId: input.personaId,
    prevTrackId: input.prevTrack.id,
  });
  const cached = await prisma.djScriptCache.findUnique({ where: { cacheKey } });

  if (cached) {
    await prisma.djScriptCache.update({
      data: {
        hitCount: {
          increment: 1,
        },
        lastUsedAt: new Date(),
      },
      where: {
        cacheKey,
      },
    });

    return { cached: true, script: cached.script };
  }

  const cue = buildRuleBasedDjCue({
    currentTrack: toSchedulerTrack(input.prevTrack),
    nextTrack: toSchedulerTrack(input.nextTrack),
  });

  try {
    await prisma.djScriptCache.create({
      data: {
        cacheKey,
        script: cue.script,
        userId: input.userId,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const racedCache = await prisma.djScriptCache.update({
      data: {
        hitCount: {
          increment: 1,
        },
        lastUsedAt: new Date(),
      },
      where: {
        cacheKey,
      },
    });

    return { cached: true, script: racedCache.script };
  }

  return { cached: false, script: cue.script };
}

async function readCachedAudio(input: {
  script: string;
  voiceId: string;
}): Promise<{ audioUrl: string | null; cached: boolean }> {
  const scriptHash = makeTtsScriptHash({
    scriptText: input.script,
    voiceId: input.voiceId,
  });
  const cached = await prisma.ttsAudioCache.findUnique({ where: { scriptHash } });

  if (!cached) {
    return { audioUrl: null, cached: false };
  }

  await prisma.ttsAudioCache.update({
    data: {
      hitCount: {
        increment: 1,
      },
      lastUsedAt: new Date(),
    },
    where: {
      scriptHash,
    },
  });

  return { audioUrl: cached.audioUrl, cached: true };
}

export async function prefetchNextDJ(input: PrefetchNextDjInput): Promise<PrefetchNextDjOutput> {
  const scriptResult = await readOrCreateScript({
    hour: input.hour ?? new Date().getHours(),
    nextTrack: input.nextTrack,
    personaId: getDjPersona(input.personaId).id,
    prevTrack: input.prevTrack,
    userId: input.userId,
  });
  const audioResult = await readCachedAudio({
    script: scriptResult.script,
    voiceId: input.voiceId ?? 'browser-speech',
  });

  return {
    audioUrl: audioResult.audioUrl,
    cached: scriptResult.cached || audioResult.cached,
    script: scriptResult.script,
  };
}
