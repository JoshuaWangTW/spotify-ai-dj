import { z } from 'zod';

export const DEFAULT_LLM_MODEL = 'gpt-4o';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const LLM_MODEL_STORAGE_KEY = 'spotify-ai-dj:llm-model';
export const LLM_PROVIDER_STORAGE_KEY = 'spotify-ai-dj:llm-provider';

export const llmProviderSchema = z.enum(['openai', 'anthropic']);

export const llmModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Invalid LLM model id.');

export type LlmModel = z.infer<typeof llmModelSchema>;
export type LlmProvider = z.infer<typeof llmProviderSchema>;

export type LlmModelOption = {
  description: string;
  id: LlmModel;
  label: string;
  provider: LlmProvider;
};

export const OPENAI_MODEL_OPTIONS: LlmModelOption[] = [
  {
    description: 'Default balanced model for planning and structured output.',
    id: DEFAULT_LLM_MODEL,
    label: 'GPT-4o',
    provider: 'openai',
  },
  {
    description: 'Lower cost option for chat and short commentary.',
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
  },
  {
    description: 'Stronger general reasoning when your OpenAI project has access.',
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    provider: 'openai',
  },
  {
    description: 'Faster GPT-4.1 variant when your OpenAI project has access.',
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    provider: 'openai',
  },
];

export const ANTHROPIC_MODEL_OPTIONS: LlmModelOption[] = [
  {
    description: 'Balanced Claude model for structured planning.',
    id: DEFAULT_ANTHROPIC_MODEL,
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
  },
  {
    description: 'Lower cost Claude option when your Anthropic key has access.',
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
  },
  {
    description: 'Higher capability Claude option when your Anthropic key has access.',
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
  },
];

export const LLM_MODEL_OPTIONS = [...OPENAI_MODEL_OPTIONS, ...ANTHROPIC_MODEL_OPTIONS];

export function resolveLlmProvider(provider?: string | null): LlmProvider {
  const parsed = llmProviderSchema.safeParse(provider ?? 'openai');

  return parsed.success ? parsed.data : 'openai';
}

export function getDefaultLlmModel(provider?: string | null): LlmModel {
  return resolveLlmProvider(provider) === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_LLM_MODEL;
}

export function resolveLlmModel(model?: string | null, provider?: string | null): LlmModel {
  const parsed = llmModelSchema.safeParse(model ?? getDefaultLlmModel(provider));

  return parsed.success ? parsed.data : getDefaultLlmModel(provider);
}
