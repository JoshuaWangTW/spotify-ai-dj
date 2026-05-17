import 'server-only';

import { prisma } from '../db/prisma';
import { estimateDjCacheMetrics, type DjCacheMetrics } from './metrics-core';

export async function getUserDjCacheMetrics(userId: string): Promise<DjCacheMetrics> {
  const [scriptCaches, ttsAudioCaches] = await Promise.all([
    prisma.djScriptCache.findMany({
      select: {
        hitCount: true,
      },
      where: {
        userId,
      },
    }),
    prisma.ttsAudioCache.findMany({
      select: {
        hitCount: true,
      },
    }),
  ]);

  return estimateDjCacheMetrics({
    scriptHits: scriptCaches.reduce(
      (total: number, item: { hitCount: number }) => total + item.hitCount,
      0,
    ),
    scriptMisses: scriptCaches.length,
    ttsAudioHits: ttsAudioCaches.reduce(
      (total: number, item: { hitCount: number }) => total + item.hitCount,
      0,
    ),
    ttsAudioMisses: ttsAudioCaches.length,
  });
}
