import 'server-only';

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { QiaomuGenreEntry } from './search';

type QiaomuJsonObject = Record<string, unknown>;

let cachedEntries: Promise<QiaomuGenreEntry[]> | null = null;

const MAX_JSON_FILES = 800;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(asString).filter(Boolean) as string[];
}

function slugToName(value: string): string {
  return value
    .replace(/\.json$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function entryFromObject(object: QiaomuJsonObject, source: string): QiaomuGenreEntry | null {
  const name = asString(object.name) ?? slugToName(path.basename(source));

  if (!name) {
    return null;
  }

  const childObjects = Array.isArray(object.sub_genres) ? object.sub_genres : [];
  const childNames = childObjects
    .map((child) =>
      child && typeof child === 'object' ? asString((child as QiaomuJsonObject).name) : undefined,
    )
    .filter(Boolean) as string[];

  return {
    aliases: uniq([
      ...asStringArray(object.aliases),
      asString(object.slug) ?? '',
      asString(object.url)?.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ') ?? '',
    ]),
    children: uniq([...asStringArray(object.children), ...childNames]),
    description: asString(object.description),
    level: asString(object.level),
    name,
    parent: asString(object.parent),
    related: uniq([
      ...asStringArray(object.related),
      ...asStringArray(object.related_genres),
      ...asStringArray(object.influences),
    ]),
    source,
  };
}

function collectEntriesFromJson(value: unknown, source: string, entries: QiaomuGenreEntry[]): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEntriesFromJson(item, source, entries);
    }
    return;
  }

  const object = value as QiaomuJsonObject;
  const entry = entryFromObject(object, source);

  if (entry) {
    entries.push(entry);
  }

  for (const key of ['genres', 'sub_genres', 'children', 'related_genres']) {
    collectEntriesFromJson(object[key], source, entries);
  }
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveQiaomuGenreDbDir(): Promise<string | null> {
  const configured = process.env.QIAOMU_GENRE_DB_DIR?.trim();
  const candidates = configured
    ? [configured, path.join(configured, 'references')]
    : [
        path.join(process.cwd(), 'data', 'qiaomu', 'references'),
        path.join(process.cwd(), 'data', 'qiaomu-music-player-spotify', 'references'),
      ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);

    if (await directoryExists(resolved)) {
      return resolved;
    }
  }

  return null;
}

async function listJsonFiles(directory: string, files: string[] = []): Promise<string[]> {
  if (files.length >= MAX_JSON_FILES) {
    return files;
  }

  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (files.length >= MAX_JSON_FILES) {
      break;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await listJsonFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadEntries(): Promise<QiaomuGenreEntry[]> {
  const root = await resolveQiaomuGenreDbDir();

  if (!root) {
    return [];
  }

  const files = await listJsonFiles(root);
  const entries: QiaomuGenreEntry[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf8');
      collectEntriesFromJson(
        JSON.parse(raw),
        path.relative(root, file).replace(/\\/g, '/'),
        entries,
      );
    } catch {
      continue;
    }
  }

  return entries;
}

export async function getQiaomuGenreEntries(): Promise<QiaomuGenreEntry[]> {
  cachedEntries ??= loadEntries();
  return cachedEntries;
}
