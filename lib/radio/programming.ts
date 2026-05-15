import type { AiDjMode } from './schema';

export type RadioProgrammingContext = {
  energyTarget: number;
  hour: number;
  mode: Exclude<AiDjMode, 'auto'>;
  period: 'morning' | 'afternoon' | 'evening' | 'late_night';
  situation: string;
  timezone?: string;
};

function clampEnergy(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getPeriod(hour: number): RadioProgrammingContext['period'] {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  }

  if (hour >= 12 && hour < 18) {
    return 'afternoon';
  }

  if (hour >= 18 && hour < 23) {
    return 'evening';
  }

  return 'late_night';
}

function inferMode(
  requestedMode: AiDjMode,
  prompt: string,
  period: RadioProgrammingContext['period'],
): RadioProgrammingContext['mode'] {
  if (requestedMode !== 'auto') {
    return requestedMode;
  }

  const normalizedPrompt = prompt.toLowerCase();

  if (/work|focus|專注|工作|讀書/.test(normalizedPrompt)) {
    return 'work_focus';
  }

  if (/coffee|roast|烘豆|咖啡/.test(normalizedPrompt)) {
    return 'coffee_roasting';
  }

  if (/dinner|store|晚餐|店|營業|背景/.test(normalizedPrompt)) {
    return 'dinner_store_background';
  }

  if (/classical|bach|debussy|古典|巴赫|德布西/.test(normalizedPrompt)) {
    return 'classical_intro';
  }

  if (/jazz|swing|爵士|藍調/.test(normalizedPrompt)) {
    return 'jazz_intro';
  }

  return period === 'late_night' || period === 'evening' ? 'jazz_intro' : 'work_focus';
}

function inferSituation(
  mode: RadioProgrammingContext['mode'],
  period: RadioProgrammingContext['period'],
): string {
  if (mode === 'work_focus') {
    return 'focused listening';
  }

  if (mode === 'coffee_roasting') {
    return 'coffee roasting flow';
  }

  if (mode === 'dinner_store_background') {
    return 'background listening';
  }

  if (mode === 'classical_intro') {
    return period === 'late_night' ? 'quiet classical guidance' : 'classical learning';
  }

  return period === 'late_night' ? 'late-night jazz guidance' : 'jazz learning';
}

function inferEnergy(mode: RadioProgrammingContext['mode'], period: RadioProgrammingContext['period']): number {
  const baseByMode: Record<RadioProgrammingContext['mode'], number> = {
    classical_intro: 0.38,
    coffee_roasting: 0.55,
    dinner_store_background: 0.35,
    jazz_intro: 0.45,
    work_focus: 0.32,
  };
  const periodAdjustment: Record<RadioProgrammingContext['period'], number> = {
    afternoon: 0.06,
    evening: -0.03,
    late_night: -0.12,
    morning: 0.02,
  };

  return clampEnergy(baseByMode[mode] + periodAdjustment[period]);
}

export function determineRadioProgrammingContext(input: {
  clientTimeIso?: string;
  mode: AiDjMode;
  prompt: string;
  timezone?: string;
}): RadioProgrammingContext {
  const date = input.clientTimeIso ? new Date(input.clientTimeIso) : new Date();
  const hour = Number.isNaN(date.getTime()) ? new Date().getHours() : date.getHours();
  const period = getPeriod(hour);
  const mode = inferMode(input.mode, input.prompt, period);

  return {
    energyTarget: inferEnergy(mode, period),
    hour,
    mode,
    period,
    situation: inferSituation(mode, period),
    timezone: input.timezone,
  };
}
