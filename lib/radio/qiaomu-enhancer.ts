import 'server-only';

import { getQiaomuGenreEntries } from '../qiaomu/local-genre-db';
import { findQiaomuGenreMatches } from '../qiaomu/search';
import type { QiaomuGenreHint } from '../qiaomu/schema';
import { applyQiaomuGenreMatchesToPlan } from './qiaomu-enhancer-core';
import type { RadioSegmentPlanOutput } from './schema';

type PreviousSegmentContext = {
  index?: number;
  trackQueries?: string[];
};

export type QiaomuEnhancedRadioPlan = {
  genreHints: QiaomuGenreHint[];
  plan: RadioSegmentPlanOutput;
};

function toGenreHint(match: ReturnType<typeof findQiaomuGenreMatches>[number]): QiaomuGenreHint {
  return {
    children: (match.children ?? []).slice(0, 8),
    description: match.description,
    name: match.name,
    parent: match.parent,
    related: (match.related ?? []).slice(0, 8),
    score: Math.round(match.score),
    source: match.source,
  };
}

export async function applyQiaomuGenreEnhancement(input: {
  plan: RadioSegmentPlanOutput;
  previousSegment?: PreviousSegmentContext | null;
  prompt: string;
}): Promise<QiaomuEnhancedRadioPlan> {
  const entries = await getQiaomuGenreEntries();

  if (entries.length === 0) {
    return { genreHints: [], plan: input.plan };
  }

  const matches = findQiaomuGenreMatches(input.prompt, entries);

  return {
    genreHints: matches.map(toGenreHint),
    plan: applyQiaomuGenreMatchesToPlan({
      matches,
      plan: input.plan,
      previousSegment: input.previousSegment,
      prompt: input.prompt,
    }),
  };
}

export async function getQiaomuGenreHintsForPrompt(
  prompt: string,
  limit = 5,
): Promise<QiaomuGenreHint[]> {
  const entries = await getQiaomuGenreEntries();

  if (entries.length === 0) {
    return [];
  }

  return findQiaomuGenreMatches(prompt, entries, limit).map(toGenreHint);
}
