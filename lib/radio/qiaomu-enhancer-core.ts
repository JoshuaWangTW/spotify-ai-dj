import type { QiaomuGenreMatch } from '../qiaomu/search';
import type { RadioSegmentPlanOutput } from './schema';

type PreviousSegmentContext = {
  index?: number;
  trackQueries?: string[];
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function detectLocaleTerm(prompt: string): string | null {
  const normalized = prompt.toLowerCase();

  if (includesAny(normalized, [/日文/, /日本/, /japanese/, /j-?rock/, /邦ロック/, /邦楽/])) {
    return 'Japanese';
  }

  if (includesAny(normalized, [/韓文/, /韓國/, /korean/, /k-?pop/, /韓團/])) {
    return 'Korean';
  }

  if (includesAny(normalized, [/台灣/, /臺灣/, /taiwan/])) {
    return 'Taiwan';
  }

  if (includesAny(normalized, [/中文/, /華語/, /mandopop/, /c-?pop/])) {
    return 'Mandopop';
  }

  return null;
}

function detectMoodTerms(prompt: string): string[] {
  const normalized = prompt.toLowerCase();
  const terms: string[] = [];

  if (includesAny(normalized, [/輕柔/, /柔和/, /舒服/, /放鬆/, /soft/, /mellow/, /chill/])) {
    terms.push('mellow');
  }
  if (includesAny(normalized, [/夜/, /深夜/, /晚上/, /night/, /midnight/])) {
    terms.push('night');
  }
  if (includesAny(normalized, [/專注/, /工作/, /讀書/, /focus/, /study/, /work/])) {
    terms.push('focus');
  }
  if (includesAny(normalized, [/純音樂/, /無人聲/, /instrumental/])) {
    terms.push('instrumental');
  }
  if (includesAny(normalized, [/木吉他/, /原聲/, /acoustic/])) {
    terms.push('acoustic');
  }

  return terms.slice(0, 2);
}

function rotate<T>(values: T[], offset: number): T[] {
  if (values.length === 0) {
    return values;
  }

  const normalizedOffset = ((offset % values.length) + values.length) % values.length;

  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)];
}

function buildMatchQueries(prompt: string, matches: QiaomuGenreMatch[]): string[] {
  const locale = detectLocaleTerm(prompt);
  const moodTerms = detectMoodTerms(prompt);
  const queries: string[] = [];

  for (const match of matches) {
    const baseTerms = [locale, match.name, ...moodTerms].filter(Boolean) as string[];
    queries.push(baseTerms.join(' '));

    const relatedTerms = uniq([...(match.children ?? []), ...(match.related ?? [])]).slice(0, 3);

    for (const related of relatedTerms) {
      queries.push([locale, related, ...moodTerms].filter(Boolean).join(' '));
    }

    if (match.parent && match.parent.toLowerCase() !== match.name.toLowerCase()) {
      queries.push([locale, match.name, match.parent, ...moodTerms].filter(Boolean).join(' '));
    }
  }

  return uniq(queries);
}

export function applyQiaomuGenreMatchesToPlan(input: {
  matches: QiaomuGenreMatch[];
  plan: RadioSegmentPlanOutput;
  previousSegment?: PreviousSegmentContext | null;
  prompt: string;
}): RadioSegmentPlanOutput {
  if (input.matches.length === 0) {
    return input.plan;
  }

  const targetCount = Math.max(5, Math.min(8, input.plan.spotifySearchQueries.length));
  const previousQueries = new Set(
    (input.previousSegment?.trackQueries ?? []).map((query) => query.toLowerCase()),
  );
  const qiaomuQueries = rotate(
    buildMatchQueries(input.prompt, input.matches),
    (input.previousSegment?.index ?? 0) * targetCount,
  ).filter((query) => !previousQueries.has(query.toLowerCase()));

  if (qiaomuQueries.length === 0) {
    return input.plan;
  }

  const existingQueries = input.plan.spotifySearchQueries.filter(
    (query) => !previousQueries.has(query.toLowerCase()),
  );
  const spotifySearchQueries = uniq([...qiaomuQueries, ...existingQueries]).slice(0, targetCount);

  if (spotifySearchQueries.length < 5) {
    return input.plan;
  }

  const genreNames = input.matches
    .slice(0, 2)
    .map((match) => match.name)
    .join(', ');

  return {
    ...input.plan,
    queueReasoning: input.plan.queueReasoning.map((reason, index) =>
      index === 0 ? `${reason} Qiaomu genre match: ${genreNames}.` : reason,
    ),
    spotifySearchQueries,
  };
}
