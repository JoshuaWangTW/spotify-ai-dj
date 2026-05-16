import { createHash } from 'node:crypto';

export type DjCacheKeyInput = {
  hour: number;
  personaId: string;
  prevTrackId: string;
  nextTrackId: string;
};

export type TtsCacheKeyInput = {
  scriptText: string;
  voiceId: string;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) {
    return 0;
  }

  return ((Math.trunc(hour) % 24) + 24) % 24;
}

export function bucketHour(hour: number): number {
  const normalizedHour = normalizeHour(hour);

  if (normalizedHour < 6) {
    return 0;
  }

  if (normalizedHour < 12) {
    return 1;
  }

  if (normalizedHour < 18) {
    return 2;
  }

  return 3;
}

export function makeDjCacheKey(input: DjCacheKeyInput): string {
  return sha256(
    [
      input.personaId.trim().toLowerCase(),
      input.prevTrackId.trim(),
      input.nextTrackId.trim(),
      bucketHour(input.hour),
    ].join('|'),
  );
}

export function makeTtsScriptHash(input: TtsCacheKeyInput): string {
  return sha256([input.scriptText.trim(), input.voiceId.trim().toLowerCase()].join('|'));
}
