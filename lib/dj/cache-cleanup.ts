import { prisma } from '../db/prisma';

export type CleanupDjCacheResult = {
  cutoffIso: string;
  deletedDjScripts: number;
  deletedTtsAudio: number;
  ttlDays: number;
};

export async function cleanupDjCaches(input: { ttlDays: number }): Promise<CleanupDjCacheResult> {
  const ttlDays = Math.max(1, Math.min(365, Math.trunc(input.ttlDays)));
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const [deletedDjScripts, deletedTtsAudio] = await prisma.$transaction([
    prisma.djScriptCache.deleteMany({
      where: {
        lastUsedAt: {
          lt: cutoff,
        },
      },
    }),
    prisma.ttsAudioCache.deleteMany({
      where: {
        lastUsedAt: {
          lt: cutoff,
        },
      },
    }),
  ]);

  return {
    cutoffIso: cutoff.toISOString(),
    deletedDjScripts: deletedDjScripts.count,
    deletedTtsAudio: deletedTtsAudio.count,
    ttlDays,
  };
}
