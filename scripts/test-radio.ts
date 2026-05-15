import assert from 'node:assert/strict';

import { determineRadioProgrammingContext } from '../lib/radio/programming';
import {
  radioSegmentPlanOutputSchema,
  radioStartInputSchema,
  radioTickInputSchema,
} from '../lib/radio/schema';

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

testProgrammingAutoModeFromPrompt();
testProgrammingKeepsExplicitMode();
testStartInputDefaults();
testTickInputDefaultsAndFeedbackLimit();
testSegmentPlanRequiresFiveToEightQueries();

console.log('radio tests passed');
