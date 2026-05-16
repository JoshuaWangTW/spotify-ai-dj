import { getServerEnv } from '../config/env';
import { prisma } from '../db/prisma';
import { getDjAudioUrl, hasDjAudioCache, writeDjAudioCache } from '../tts/file-cache';
import { synthesizeWithFallback } from '../tts/with-fallback';
import { makeDjCacheKey, makeTtsScriptHash } from './cache';
import { tryFastPathDjScript } from './fast-path';
import { generateDjScript } from './generate';
import { getDjPersona } from './personas';
import { buildRuleBasedDjCue, type DjSchedulerTrack } from './scheduler';

const DEFAULT_DJ_TTS_VOICE = 'zh-TW-HsiaoChenNeural';

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
  provider: 'azure' | 'browser-only' | 'cache' | 'edge-tts';
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

async function createScript(input: {
  nextTrack: PrefetchTrack;
  personaId: string;
  prevTrack: PrefetchTrack;
  userId: string;
}): Promise<string> {
  const fastPathScript = tryFastPathDjScript({
    nextTrack: input.nextTrack,
    prevTrack: input.prevTrack,
  });

  if (fastPathScript) {
    return fastPathScript;
  }

  const fallbackScript = buildRuleBasedDjCue({
    currentTrack: toSchedulerTrack(input.prevTrack),
    nextTrack: toSchedulerTrack(input.nextTrack),
  }).script;

  try {
    const recentScripts = await prisma.djScriptCache.findMany({
      orderBy: {
        lastUsedAt: 'desc',
      },
      select: {
        script: true,
      },
      take: 5,
      where: {
        userId: input.userId,
      },
    });

    return await generateDjScript({
      env: getServerEnv(),
      nextTrack: input.nextTrack,
      persona: getDjPersona(input.personaId),
      prevTrack: input.prevTrack,
      recentScripts: recentScripts.map((item: { script: string }) => item.script),
    });
  } catch {
    return fallbackScript;
  }
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

  const script = await createScript(input);

  try {
    await prisma.djScriptCache.create({
      data: {
        cacheKey,
        script,
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

  return { cached: false, script };
}

async function readCachedAudio(input: {
  script: string;
  voiceId: string;
}): Promise<{ audioUrl: string | null; cached: boolean; scriptHash: string }> {
  const scriptHash = makeTtsScriptHash({
    scriptText: input.script,
    voiceId: input.voiceId,
  });
  const cached = await prisma.ttsAudioCache.findUnique({ where: { scriptHash } });

  if (!cached || !(await hasDjAudioCache(scriptHash))) {
    return { audioUrl: null, cached: false, scriptHash };
  }

  const updated = await prisma.ttsAudioCache.update({
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

  return { audioUrl: updated.audioUrl, cached: true, scriptHash };
}

async function synthesizeAndCacheAudio(input: {
  script: string;
  scriptHash: string;
  voiceId: string;
}): Promise<{ audioUrl: string | null; provider: PrefetchNextDjOutput['provider'] }> {
  const env = getServerEnv();
  const ttsResult = await synthesizeWithFallback({
    env,
    text: input.script,
    timeoutMs: 6_000,
    voiceId: input.voiceId,
  });

  if (!ttsResult.result) {
    return {
      audioUrl: null,
      provider: 'browser-only',
    };
  }

  const stored = await writeDjAudioCache({
    audioBuffer: ttsResult.result.audioBuffer,
    scriptHash: input.scriptHash,
  });
  const audioUrl = getDjAudioUrl(input.scriptHash);

  await prisma.ttsAudioCache.upsert({
    create: {
      audioUrl,
      byteSize: stored.byteSize,
      duration: ttsResult.result.duration,
      scriptHash: input.scriptHash,
      voiceId: input.voiceId,
    },
    update: {
      audioUrl,
      byteSize: stored.byteSize,
      duration: ttsResult.result.duration,
      hitCount: {
        increment: 1,
      },
      lastUsedAt: new Date(),
      voiceId: input.voiceId,
    },
    where: {
      scriptHash: input.scriptHash,
    },
  });

  return {
    audioUrl,
    provider: ttsResult.provider,
  };
}

export async function prefetchNextDJ(input: PrefetchNextDjInput): Promise<PrefetchNextDjOutput> {
  const user = await prisma.user.findUnique({
    select: {
      djPersonaId: true,
    },
    where: {
      id: input.userId,
    },
  });
  const personaId = getDjPersona(input.personaId ?? user?.djPersonaId).id;
  const scriptResult = await readOrCreateScript({
    hour: input.hour ?? new Date().getHours(),
    nextTrack: input.nextTrack,
    personaId,
    prevTrack: input.prevTrack,
    userId: input.userId,
  });
  const voiceId = input.voiceId ?? DEFAULT_DJ_TTS_VOICE;
  const audioResult = await readCachedAudio({
    script: scriptResult.script,
    voiceId,
  });

  if (audioResult.cached) {
    return {
      audioUrl: audioResult.audioUrl,
      cached: true,
      provider: 'cache',
      script: scriptResult.script,
    };
  }

  const synthesized = await synthesizeAndCacheAudio({
    script: scriptResult.script,
    scriptHash: audioResult.scriptHash,
    voiceId,
  });

  return {
    audioUrl: synthesized.audioUrl,
    cached: scriptResult.cached,
    provider: synthesized.provider,
    script: scriptResult.script,
  };
}
