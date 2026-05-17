import assert from 'node:assert/strict';

import { bucketHour, makeDjCacheKey, makeTtsScriptHash } from '../lib/dj/cache';
import { tryFastPathDjScript } from '../lib/dj/fast-path';
import { estimateDjCacheMetrics } from '../lib/dj/metrics-core';

function testHourBuckets() {
  assert.equal(bucketHour(0), 0);
  assert.equal(bucketHour(5), 0);
  assert.equal(bucketHour(6), 1);
  assert.equal(bucketHour(11), 1);
  assert.equal(bucketHour(12), 2);
  assert.equal(bucketHour(17), 2);
  assert.equal(bucketHour(18), 3);
  assert.equal(bucketHour(23), 3);
  assert.equal(bucketHour(-1), 3);
  assert.equal(bucketHour(24), 0);
}

function testDjCacheKeyIgnoresRealtimeContext() {
  const first = makeDjCacheKey({
    hour: 22,
    nextTrackId: 'spotify-next',
    personaId: 'Midnight',
    prevTrackId: 'spotify-prev',
  });
  const second = makeDjCacheKey({
    hour: 23,
    nextTrackId: 'spotify-next',
    personaId: 'midnight',
    prevTrackId: 'spotify-prev',
  });
  const differentBucket = makeDjCacheKey({
    hour: 8,
    nextTrackId: 'spotify-next',
    personaId: 'midnight',
    prevTrackId: 'spotify-prev',
  });

  assert.equal(first, second);
  assert.notEqual(first, differentBucket);
}

function testTtsHashUsesScriptAndVoiceOnly() {
  const first = makeTtsScriptHash({
    scriptText: '把剛才的餘韻留住。',
    voiceId: 'zh-TW-HsiaoChenNeural',
  });
  const second = makeTtsScriptHash({
    scriptText: '把剛才的餘韻留住。',
    voiceId: 'zh-tw-hsiaochenneural',
  });
  const differentVoice = makeTtsScriptHash({
    scriptText: '把剛才的餘韻留住。',
    voiceId: 'zh-TW-YunJheNeural',
  });

  assert.equal(first, second);
  assert.notEqual(first, differentVoice);
}

function testFastPathBeforeLlm() {
  const script = tryFastPathDjScript({
    nextTrack: {
      artist: 'Lamp',
      artistUris: ['spotify:artist:lamp'],
      id: 'next',
      title: 'Next',
      uri: 'spotify:track:next',
    },
    prevTrack: {
      artist: 'Lamp',
      artistUris: ['spotify:artist:lamp'],
      id: 'prev',
      title: 'Prev',
      uri: 'spotify:track:prev',
    },
  });

  assert.equal(typeof script, 'string');
  assert.ok(script && script.length > 20);
}

function testDjMetricsEstimate() {
  const metrics = estimateDjCacheMetrics({
    scriptHits: 12,
    scriptMisses: 8,
    ttsAudioHits: 15,
    ttsAudioMisses: 5,
  });

  assert.equal(metrics.scriptRequests, 20);
  assert.equal(metrics.scriptCacheHitRate, 0.6);
  assert.equal(metrics.audioCacheHitRate, 0.75);
  assert.equal(metrics.averageEstimatedCostUsd, 0.00012);
  assert.equal(metrics.averageEstimatedCostUsd < metrics.estimatedCostLimitUsd, true);
}

testHourBuckets();
testDjCacheKeyIgnoresRealtimeContext();
testTtsHashUsesScriptAndVoiceOnly();
testFastPathBeforeLlm();
testDjMetricsEstimate();

console.log('dj cache tests passed');
