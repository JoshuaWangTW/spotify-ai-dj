import assert from 'node:assert/strict';

import {
  musicAssistantChatInputSchema,
  musicAssistantOutputSchema,
} from '../lib/music-assistant/schema';
import { determineRadioProgrammingContext } from '../lib/radio/programming';
import { applyQiaomuGenreMatchesToPlan } from '../lib/radio/qiaomu-enhancer-core';
import {
  applyRadioSearchPolicy,
  buildRadioSearchPolicyInstruction,
  parseRadioIntent,
} from '../lib/radio/search-policy';
import {
  radioSegmentPlanOutputSchema,
  radioStartInputSchema,
  radioTickInputSchema,
  type RadioSegmentPlanOutput,
} from '../lib/radio/schema';
import { buildSpotifySearchQueryVariants } from '../lib/spotify-search';

function testProgrammingAutoModeFromPrompt() {
  const context = determineRadioProgrammingContext({
    clientTimeIso: '2026-05-15T05:00:00.000Z',
    mode: 'auto',
    prompt: '下午工作想專注，不要太吵',
    timezone: 'Asia/Taipei',
  });

  assert.equal(context.mode, 'work_focus');
  assert.equal(context.period, 'afternoon');
  assert.equal(context.situation, 'focused listening');
  assert.ok(context.energyTarget >= 0);
  assert.ok(context.energyTarget <= 1);
}

function testProgrammingKeepsExplicitMode() {
  const context = determineRadioProgrammingContext({
    clientTimeIso: '2026-05-15T15:30:00.000Z',
    mode: 'classical_intro',
    prompt: '深夜想聽巴赫',
    timezone: 'Asia/Taipei',
  });

  assert.equal(context.mode, 'classical_intro');
  assert.equal(context.period, 'late_night');
}

function testJapaneseRockPromptUsesNeutralProgramming() {
  const context = determineRadioProgrammingContext({
    clientTimeIso: '2026-05-15T12:00:00.000Z',
    mode: 'auto',
    prompt: '輕柔日文搖滾之夜',
    timezone: 'Asia/Taipei',
  });

  assert.equal(context.mode, 'dinner_store_background');
  assert.equal(context.situation, 'user-directed listening');
}

function testStartInputDefaults() {
  const parsed = radioStartInputSchema.safeParse({
    prompt: '今晚像電台一樣慢慢接爵士',
  });

  assert.equal(parsed.success, true);

  if (parsed.success) {
    assert.equal(parsed.data.autoplayQueue, true);
    assert.equal(parsed.data.mode, 'auto');
  }
}

function testTickInputDefaultsAndFeedbackLimit() {
  const parsed = radioTickInputSchema.safeParse({
    sessionId: 'radio-session-id',
  });

  assert.equal(parsed.success, true);

  if (parsed.success) {
    assert.equal(parsed.data.autoplayQueue, true);
    assert.deepEqual(parsed.data.feedback, []);
  }

  const tooMuchFeedback = radioTickInputSchema.safeParse({
    feedback: Array.from({ length: 11 }, () => ({ feedbackType: 'like' })),
    sessionId: 'radio-session-id',
  });

  assert.equal(tooMuchFeedback.success, false);
}

function testSegmentPlanRequiresFiveToEightQueries() {
  const validPlan = {
    difficulty: 'beginner',
    djIntro: '這一段先保持柔和脈動，讓旋律和空間感慢慢打開。',
    energy: 0.42,
    mode: 'jazz_intro',
    queueReasoning: [
      '先用清楚旋律建立入口',
      '接著用鋼琴三重奏延續呼吸',
      '加入一首較有藍調感的段落',
      '把能量維持在中低',
      '最後留一個自然銜接到下一段的尾巴',
    ],
    segmentTitle: 'Late Jazz Warmup',
    situation: 'late-night jazz guidance',
    spotifySearchQueries: [
      'Chet Baker mellow jazz',
      'Bill Evans piano trio calm',
      'Miles Davis cool jazz',
      'Stan Getz soft jazz',
      'Oscar Peterson ballad trio',
    ],
    transitionNote: '下一段可以從更安靜的鋼琴或小編制開始。',
    vocalPreference: 'low',
  };

  assert.equal(radioSegmentPlanOutputSchema.safeParse(validPlan).success, true);

  const tooShort = radioSegmentPlanOutputSchema.safeParse({
    ...validPlan,
    queueReasoning: validPlan.queueReasoning.slice(0, 4),
    spotifySearchQueries: validPlan.spotifySearchQueries.slice(0, 4),
  });

  assert.equal(tooShort.success, false);
}

function testJapaneseRockSearchPolicy() {
  const instruction = buildRadioSearchPolicyInstruction('輕柔日文搖滾之夜');

  assert.match(instruction, /japanese|日本|J-rock/i);
  assert.match(instruction, /K-pop/);

  const plan: RadioSegmentPlanOutput = {
    difficulty: 'beginner',
    djIntro: '這一段先保持柔和脈動，讓旋律和空間感慢慢打開。',
    energy: 0.42,
    mode: 'dinner_store_background',
    queueReasoning: [
      '先用清楚旋律建立入口',
      '接著維持中低能量',
      '加入吉他聲線但不過度激烈',
      '保留夜晚感',
      '最後留一個自然銜接到下一段的尾巴',
    ],
    segmentTitle: 'Soft Japanese Rock Night',
    situation: 'user-directed listening',
    spotifySearchQueries: [
      'soft night music',
      'mellow rock',
      'night playlist',
      'soft vocal rock',
      'evening guitar music',
    ],
    transitionNote: '下一段可以往更安靜的 indie rock 延伸。',
    vocalPreference: 'medium',
  };

  const rewritten = applyRadioSearchPolicy('輕柔日文搖滾之夜', plan);

  assert.equal(rewritten.spotifySearchQueries.length, 5);
  assert.ok(rewritten.spotifySearchQueries.every((query) => /Japanese|羊文学/.test(query)));
  assert.ok(rewritten.spotifySearchQueries.every((query) => !/BTS|Carmen|Bizet/i.test(query)));

  const nextSegment = applyRadioSearchPolicy('輕柔日文搖滾之夜', plan, {
    index: 1,
    trackQueries: rewritten.spotifySearchQueries,
  });

  assert.notDeepEqual(nextSegment.spotifySearchQueries, rewritten.spotifySearchQueries);
}

function testGenericIntentParsingAndSearchPolicy() {
  const koreanIndie = parseRadioIntent('週末下午想聽韓國 indie，不要 K-pop');

  assert.equal(koreanIndie.locale, 'korean');
  assert.equal(koreanIndie.genre, 'indie');
  assert.deepEqual(koreanIndie.excludedGenres, ['kpop']);

  const cityPopPlan: RadioSegmentPlanOutput = {
    difficulty: 'beginner',
    djIntro: '用輕快的節奏把下午慢慢打亮。',
    energy: 0.5,
    mode: 'dinner_store_background',
    queueReasoning: [
      '先用經典城市流行建立色彩',
      '接著換一位不同歌手',
      '保留復古合成器感',
      '避免太重的鼓',
      '最後保持可銜接的中速律動',
    ],
    segmentTitle: 'City Pop Afternoon',
    situation: 'user-directed listening',
    spotifySearchQueries: ['city pop', 'japanese pop', 'retro night', 'mellow pop', '80s pop'],
    transitionNote: '下一段可以往更柔和的日系 pop 走。',
    vocalPreference: 'medium',
  };
  const rewritten = applyRadioSearchPolicy('日本 city pop 下午', cityPopPlan);

  assert.equal(rewritten.spotifySearchQueries.length, 5);
  assert.ok(rewritten.spotifySearchQueries.some((query) => /Mariya|Tatsuro|Anri/.test(query)));
  assert.ok(rewritten.spotifySearchQueries.every((query) => !/BTS|Carmen|Bizet/i.test(query)));
}

function testSpotifySearchQueryVariants() {
  const variants = buildSpotifySearchQueryVariants('artist:"羊文学" Japanese indie rock mellow');

  assert.deepEqual(variants, [
    'artist:"羊文学" Japanese indie rock mellow',
    '羊文学 Japanese indie rock mellow',
    '羊文学 top tracks',
    '羊文学',
  ]);

  assert.deepEqual(buildSpotifySearchQueryVariants('soft Japanese rock'), ['soft Japanese rock']);
}

function testQiaomuGenreEnhancerUsesSpecificSubgenres() {
  const plan: RadioSegmentPlanOutput = {
    difficulty: 'beginner',
    djIntro: '把夜色裡的吉他聲拉近一點，讓聲牆保持柔軟而不壓迫。',
    energy: 0.38,
    mode: 'dinner_store_background',
    queueReasoning: [
      '先從模糊吉他聲牆建立夜晚質地',
      '接著保留中低速節奏',
      '避免過度流行主旋律',
      '讓人聲退到比較空氣感的位置',
      '最後銜接到更安靜的 dream pop 方向',
    ],
    segmentTitle: 'Shoegaze Night',
    situation: 'user-directed listening',
    spotifySearchQueries: [
      'soft night music',
      'mellow rock',
      'dreamy guitar music',
      'evening indie playlist',
      'soft vocal rock',
    ],
    transitionNote: '下一段可以往 dream pop 或 ambient pop 延伸。',
    vocalPreference: 'medium',
  };

  const enhanced = applyQiaomuGenreMatchesToPlan({
    matches: [
      {
        children: ['Dream Pop', 'Noise Pop'],
        name: 'Shoegaze',
        parent: 'Rock',
        related: ['Ambient Pop'],
        score: 120,
      },
    ],
    plan,
    prompt: '輕柔 shoegaze 夜晚',
  });

  assert.match(enhanced.spotifySearchQueries[0], /Shoegaze/);
  assert.ok(enhanced.spotifySearchQueries.some((query) => /Dream Pop|Ambient Pop/.test(query)));
  assert.equal(enhanced.spotifySearchQueries.length, 5);
}

function testMusicAssistantChatInput() {
  const parsed = musicAssistantChatInputSchema.safeParse({
    message: '我想慢慢建立我的爵士偏好，先從舒服、不太吵的鋼琴開始。',
  });

  assert.equal(parsed.success, true);

  if (parsed.success) {
    assert.equal(parsed.data.includeSpotifyTaste, false);
  }

  const empty = musicAssistantChatInputSchema.safeParse({
    message: '   ',
  });

  assert.equal(empty.success, false);
}

function testMusicAssistantOutputMemoryCandidates() {
  const parsed = musicAssistantOutputSchema.safeParse({
    memoryCandidates: [
      {
        confidence: 0.82,
        content: '使用者偏好不太吵、鋼琴為主的爵士入門曲目。',
        type: 'taste',
      },
      {
        confidence: 0.76,
        content: '工作時應避免強鼓點與高能量人聲。',
        type: 'avoid',
      },
    ],
    profileSummaryPatch: {
      avoidSummary: '工作時避免強鼓點與高能量人聲。',
      tasteSummary: '偏好不太吵、鋼琴為主的爵士入門曲目。',
    },
    reply: '我先記住：你偏好柔和、鋼琴主導、不太吵的爵士。',
    suggestedRadioPrompt: '柔和鋼琴爵士，適合工作，不要太吵。',
  });

  assert.equal(parsed.success, true);

  const invalidType = musicAssistantOutputSchema.safeParse({
    memoryCandidates: [
      {
        confidence: 0.82,
        content: 'invalid',
        type: 'spotify_history',
      },
    ],
    profileSummaryPatch: {},
    reply: 'ok',
  });

  assert.equal(invalidType.success, false);
}

testProgrammingAutoModeFromPrompt();
testProgrammingKeepsExplicitMode();
testJapaneseRockPromptUsesNeutralProgramming();
testStartInputDefaults();
testTickInputDefaultsAndFeedbackLimit();
testSegmentPlanRequiresFiveToEightQueries();
testJapaneseRockSearchPolicy();
testGenericIntentParsingAndSearchPolicy();
testSpotifySearchQueryVariants();
testQiaomuGenreEnhancerUsesSpecificSubgenres();
testMusicAssistantChatInput();
testMusicAssistantOutputMemoryCandidates();

console.log('radio tests passed');
