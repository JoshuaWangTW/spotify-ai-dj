export type DjCacheMetrics = {
  audioCacheHitRate: number;
  averageEstimatedCostUsd: number;
  estimatedCostLimitUsd: number;
  estimatedLlmCostPerMissUsd: number;
  scriptCacheHitRate: number;
  scriptMisses: number;
  scriptRequests: number;
  ttsAudioMisses: number;
  ttsAudioRequests: number;
};

export const DJ_COST_LIMIT_USD = 0.001;
export const ESTIMATED_LLM_COST_PER_MISS_USD = 0.0003;

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

export function estimateDjCacheMetrics(input: {
  scriptHits: number;
  scriptMisses: number;
  ttsAudioHits: number;
  ttsAudioMisses: number;
}): DjCacheMetrics {
  const scriptRequests = input.scriptHits + input.scriptMisses;
  const ttsAudioRequests = input.ttsAudioHits + input.ttsAudioMisses;
  const averageEstimatedCostUsd =
    scriptRequests === 0
      ? 0
      : Number(
          ((input.scriptMisses * ESTIMATED_LLM_COST_PER_MISS_USD) / scriptRequests).toFixed(6),
        );

  return {
    audioCacheHitRate: ratio(input.ttsAudioHits, ttsAudioRequests),
    averageEstimatedCostUsd,
    estimatedCostLimitUsd: DJ_COST_LIMIT_USD,
    estimatedLlmCostPerMissUsd: ESTIMATED_LLM_COST_PER_MISS_USD,
    scriptCacheHitRate: ratio(input.scriptHits, scriptRequests),
    scriptMisses: input.scriptMisses,
    scriptRequests,
    ttsAudioMisses: input.ttsAudioMisses,
    ttsAudioRequests,
  };
}
