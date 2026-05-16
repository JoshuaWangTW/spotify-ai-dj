import assert from 'node:assert/strict';

import { DjScheduler, type DjCue, type SpotifyPlaybackStateLike } from '../lib/dj/scheduler';

function makeState(input: {
  currentId: string;
  currentArtistUri?: string;
  nextId?: string;
  position?: number;
}): SpotifyPlaybackStateLike {
  return {
    duration: 1000,
    paused: false,
    position: input.position ?? 0,
    track_window: {
      current_track: {
        artists: [{ name: `Artist ${input.currentId}`, uri: input.currentArtistUri ?? 'artist:1' }],
        duration_ms: 1000,
        id: input.currentId,
        name: `Track ${input.currentId}`,
        uri: `spotify:track:${input.currentId}`,
      },
      next_tracks: input.nextId
        ? [
            {
              artists: [{ name: `Artist ${input.nextId}`, uri: 'artist:2' }],
              duration_ms: 1000,
              id: input.nextId,
              name: `Track ${input.nextId}`,
              uri: `spotify:track:${input.nextId}`,
            },
          ]
        : [],
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function testPrefetchTriggersOnceAfterHalfway() {
  let prefetchCount = 0;
  const scheduler = new DjScheduler({
    pauseSpotify: async () => undefined,
    playCue: async () => undefined,
    prefetchCue: async ({ nextTrack }) => {
      prefetchCount += 1;
      return { script: 'cue', trackId: nextTrack.id };
    },
    resumeSpotify: async () => undefined,
  });

  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 400 }));
  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 500 }));
  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 800 }));
  await flushMicrotasks();

  assert.equal(prefetchCount, 1);
}

async function testTrackChangePlaysMatchingPendingCue() {
  const calls: string[] = [];
  const scheduler = new DjScheduler({
    pauseSpotify: async () => {
      calls.push('pause');
    },
    playCue: async (cue: DjCue) => {
      calls.push(`play:${cue.trackId}`);
    },
    prefetchCue: async ({ nextTrack }) => ({ script: 'cue', trackId: nextTrack.id }),
    resumeSpotify: async () => {
      calls.push('resume');
    },
  });

  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 700 }));
  await flushMicrotasks();
  scheduler.onStateChange(makeState({ currentId: 'b', nextId: 'c', position: 0 }));
  await flushMicrotasks();

  assert.deepEqual(calls, ['pause', 'play:b', 'resume']);
}

async function testMissingCueDoesNotPauseSpotify() {
  let pauseCount = 0;
  const scheduler = new DjScheduler({
    pauseSpotify: async () => {
      pauseCount += 1;
    },
    playCue: async () => undefined,
    prefetchCue: async () => null,
    resumeSpotify: async () => undefined,
  });

  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 700 }));
  await flushMicrotasks();
  scheduler.onStateChange(makeState({ currentId: 'b', nextId: 'c', position: 0 }));
  await flushMicrotasks();

  assert.equal(pauseCount, 0);
}

async function testSchedulerCanBeDisabled() {
  let enabled = false;
  let prefetchCount = 0;
  const scheduler = new DjScheduler({
    isEnabled: () => enabled,
    pauseSpotify: async () => undefined,
    playCue: async () => undefined,
    prefetchCue: async ({ nextTrack }) => {
      prefetchCount += 1;
      return { script: 'cue', trackId: nextTrack.id };
    },
    resumeSpotify: async () => undefined,
  });

  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 700 }));
  await flushMicrotasks();
  enabled = true;
  scheduler.onStateChange(makeState({ currentId: 'a', nextId: 'b', position: 700 }));
  await flushMicrotasks();

  assert.equal(prefetchCount, 1);
}

async function main() {
  await testPrefetchTriggersOnceAfterHalfway();
  await testTrackChangePlaysMatchingPendingCue();
  await testMissingCueDoesNotPauseSpotify();
  await testSchedulerCanBeDisabled();

  console.log('dj scheduler tests passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
