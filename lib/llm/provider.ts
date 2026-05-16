import 'server-only';

import type { AiDjCommentaryInput } from '../ai-dj/commentary-schema';
import type { AiDjPlanInput } from '../ai-dj/plan-schema';
import type { ServerEnv } from '../config/env';
import type { RadioProgrammingContext } from '../radio/programming';
import type { RadioTickInput } from '../radio/schema';
import {
  createAnthropicDjCommentary,
  createAnthropicDjPlan,
  createAnthropicMusicAssistantReply,
  createAnthropicRadioSegment,
} from './anthropic';
import type { LlmProvider } from './model-options';
import { resolveLlmModel, resolveLlmProvider } from './model-options';
import { createOpenAiMusicAssistantReply } from './music-assistant-openai';
import { createOpenAiDjCommentary, createOpenAiDjPlan } from './openai';
import { createOpenAiRadioSegment } from './radio-openai';

type MusicProfileContext = {
  avoidSummary: string;
  classicalLevel: string;
  jazzLevel: string;
  tasteSummary: string;
};

type PreviousRadioSegmentContext = {
  index: number;
  planJson: unknown;
  queuedTrackUris: string[];
  trackQueries: string[];
};

type ConversationMessageContext = {
  content: string;
  role: string;
};

type MusicMemoryContext = {
  content: string;
  confidence: number;
  type: string;
};

type SpotifyTasteSummaryContext = {
  signals: string[];
  source: string;
  summary: string;
};

export class LlmProviderConfigError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = 'LlmProviderConfigError';
    this.code = code;
    this.status = status;
  }
}

function resolveProvider(input: { llmProvider?: string | null }, env: ServerEnv): LlmProvider {
  return resolveLlmProvider(input.llmProvider ?? env.LLM_PROVIDER);
}

function resolveProviderModel(
  provider: LlmProvider,
  input: { llmModel?: string | null },
  env: ServerEnv,
) {
  return resolveLlmModel(
    input.llmModel ?? (provider === 'anthropic' ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL),
    provider,
  );
}

function getProviderApiKey(provider: LlmProvider, env: ServerEnv): string {
  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      throw new LlmProviderConfigError(
        'ANTHROPIC_API_KEY_MISSING',
        'Anthropic API key is not configured on the server.',
      );
    }

    return env.ANTHROPIC_API_KEY;
  }

  if (!env.OPENAI_API_KEY) {
    throw new LlmProviderConfigError(
      'OPENAI_API_KEY_MISSING',
      'OpenAI API key is not configured on the server.',
    );
  }

  return env.OPENAI_API_KEY;
}

export function createProviderDjPlan(
  env: ServerEnv,
  input: AiDjPlanInput,
  profile?: MusicProfileContext | null,
) {
  const provider = resolveProvider(input, env);
  const apiKey = getProviderApiKey(provider, env);
  const model = resolveProviderModel(provider, input, env);

  return provider === 'anthropic'
    ? createAnthropicDjPlan(apiKey, input, profile, { model })
    : createOpenAiDjPlan(apiKey, input, profile, { model });
}

export function createProviderDjCommentary(env: ServerEnv, input: AiDjCommentaryInput) {
  const provider = resolveProvider(input, env);
  const apiKey = getProviderApiKey(provider, env);
  const model = resolveProviderModel(provider, input, env);

  return provider === 'anthropic'
    ? createAnthropicDjCommentary(apiKey, input, { model })
    : createOpenAiDjCommentary(apiKey, input, { model });
}

export function createProviderRadioSegment(
  env: ServerEnv,
  input: {
    feedback?: RadioTickInput['feedback'];
    llmModel?: string | null;
    llmProvider?: string | null;
    playbackState?: RadioTickInput['playbackState'];
    previousSegment?: PreviousRadioSegmentContext | null;
    profile?: MusicProfileContext | null;
    programming: RadioProgrammingContext;
    prompt: string;
  },
) {
  const provider = resolveProvider(input, env);
  const apiKey = getProviderApiKey(provider, env);
  const model = resolveProviderModel(provider, input, env);

  return provider === 'anthropic'
    ? createAnthropicRadioSegment(apiKey, input, { model })
    : createOpenAiRadioSegment(apiKey, input, { model });
}

export function createProviderMusicAssistantReply(
  env: ServerEnv,
  input: {
    llmModel?: string | null;
    llmProvider?: string | null;
    memory: MusicMemoryContext[];
    message: string;
    profile?: MusicProfileContext | null;
    recentMessages: ConversationMessageContext[];
    spotifyTasteSummary?: SpotifyTasteSummaryContext | null;
  },
) {
  const provider = resolveProvider(input, env);
  const apiKey = getProviderApiKey(provider, env);
  const model = resolveProviderModel(provider, input, env);

  return provider === 'anthropic'
    ? createAnthropicMusicAssistantReply(apiKey, input, { model })
    : createOpenAiMusicAssistantReply(apiKey, input, { model });
}
