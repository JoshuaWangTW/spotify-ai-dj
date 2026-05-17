export type QiaomuGenreEntry = {
  aliases?: string[];
  children?: string[];
  description?: string;
  level?: string;
  name: string;
  parent?: string;
  related?: string[];
  source?: string;
};

export type QiaomuGenreMatch = QiaomuGenreEntry & {
  score: number;
};

export type QiaomuGenreSuggestion = QiaomuGenreEntry & {
  score: number;
};

const BROAD_GENRES = new Set([
  'ambient',
  'blues',
  'classical music',
  'country',
  'dance',
  'electronic',
  'folk',
  'hip hop',
  'jazz',
  'metal',
  'pop',
  'punk',
  'r&b',
  'rock',
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}"']/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3);
}

function entryTerms(entry: QiaomuGenreEntry): string[] {
  return [entry.name, ...(entry.aliases ?? [])].map(normalize).filter(Boolean);
}

function scoreEntry(prompt: string, entry: QiaomuGenreEntry): number {
  const normalizedPrompt = normalize(prompt);
  const promptTokens = new Set(tokenize(prompt));
  const terms = entryTerms(entry);
  let score = 0;

  for (const term of terms) {
    if (term.length === 0) {
      continue;
    }

    if (normalizedPrompt === term) {
      score += 120;
    } else if (normalizedPrompt.includes(term)) {
      score += 90;
    }

    const termTokens = tokenize(term);
    const overlap = termTokens.filter((token) => promptTokens.has(token)).length;

    if (overlap > 0) {
      score += overlap * 18;
    }

    if (termTokens.length > 1 && overlap === termTokens.length) {
      score += 30;
    }
  }

  if (
    entry.parent &&
    normalize(entry.parent).length > 0 &&
    normalizedPrompt.includes(normalize(entry.parent))
  ) {
    score += 6;
  }

  if (entry.description) {
    const descriptionTokens = tokenize(entry.description).slice(0, 24);
    const overlap = descriptionTokens.filter((token) => promptTokens.has(token)).length;
    score += Math.min(overlap * 2, 10);
  }

  return score;
}

function isUsefulMatch(entry: QiaomuGenreEntry, score: number): boolean {
  const name = normalize(entry.name);

  if (score < 36) {
    return false;
  }

  if (BROAD_GENRES.has(name) && score < 110) {
    return false;
  }

  return true;
}

export function findQiaomuGenreMatches(
  prompt: string,
  entries: QiaomuGenreEntry[],
  limit = 5,
): QiaomuGenreMatch[] {
  return entries
    .map((entry) => ({ ...entry, score: scoreEntry(prompt, entry) }))
    .filter((entry) => isUsefulMatch(entry, entry.score))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function listQiaomuGenreSuggestions(
  entries: QiaomuGenreEntry[],
  limit = 12,
): QiaomuGenreSuggestion[] {
  return entries
    .filter((entry) => {
      const name = normalize(entry.name);
      return !BROAD_GENRES.has(name) && Boolean(entry.parent || entry.children?.length);
    })
    .map((entry) => ({
      ...entry,
      score: entry.children?.length ? 30 + entry.children.length : 20,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function normalizeQiaomuGenreName(value: string): string {
  return normalize(value);
}
