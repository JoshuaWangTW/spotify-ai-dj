import 'server-only';

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function getDjAudioCacheDir(): string {
  return process.env.DJ_AUDIO_CACHE_DIR || path.join(process.cwd(), '.cache', 'dj-audio');
}

export function getDjAudioPath(scriptHash: string): string {
  if (!HASH_PATTERN.test(scriptHash)) {
    throw new Error('Invalid DJ audio cache hash.');
  }

  return path.join(getDjAudioCacheDir(), `${scriptHash}.mp3`);
}

export function getDjAudioUrl(scriptHash: string): string {
  if (!HASH_PATTERN.test(scriptHash)) {
    throw new Error('Invalid DJ audio cache hash.');
  }

  return `/api/dj/audio/${scriptHash}`;
}

export async function writeDjAudioCache(input: {
  audioBuffer: Buffer;
  scriptHash: string;
}): Promise<{ audioUrl: string; byteSize: number }> {
  await mkdir(getDjAudioCacheDir(), { recursive: true });
  await writeFile(getDjAudioPath(input.scriptHash), input.audioBuffer);

  return {
    audioUrl: getDjAudioUrl(input.scriptHash),
    byteSize: input.audioBuffer.byteLength,
  };
}

export async function readDjAudioCache(scriptHash: string): Promise<Buffer | null> {
  try {
    return await readFile(getDjAudioPath(scriptHash));
  } catch {
    return null;
  }
}

export async function hasDjAudioCache(scriptHash: string): Promise<boolean> {
  try {
    const file = await stat(getDjAudioPath(scriptHash));

    return file.isFile();
  } catch {
    return false;
  }
}
