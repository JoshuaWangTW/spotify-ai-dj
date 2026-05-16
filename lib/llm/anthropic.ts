import 'server-only';

import { z } from 'zod';

import type { AiDjCommentaryInput, AiDjCommentaryOutput } from '../ai-dj/commentary-schema';
import { aiDjCommentaryJsonSchema, aiDjCommentaryOutputSchema } from '../ai-dj/commentary-schema';
import type { AiDjPlanInput, AiDjPlanOutput } from '../ai-dj/plan-schema';
import { aiDjPlanJsonSchema, aiDjPlanOutputSchema } from '../ai-dj/plan-schema';
import { buildJoshuaRadioSystemPrompt } from '../ai-dj/persona';
import {
  musicAssistantJsonSchema,
  musicAssistantOutputSchema,
  type MusicAssistantOutput,
} from '../music-assistant/schema';
import type { RadioProgrammingContext } from '../radio/programming';
import {
  radioSegmentJsonSchema,
  radioSegmentPlanOutputSchema,
  type RadioSegmentPlanOutput,
  type RadioTickInput,
} from '../radio/schema';
import { buildAssistantSystemPrompt, buildAssistantUserContext } from './music-assistant-openai';
import {
  buildCommentaryUserContext,
  buildUserContext,
  commentarySystemPrompt,
  planningSystemPrompt,
} from './openai';
import { buildRadioUserContext } from './radio-openai';
import { resolveLlmModel, type LlmModel } from './model-options';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_REQUEST_TIMEOUT_MS = 15_000;

const anthropicErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        type: z.string().optional(),
      })
      .optional(),
    type: z.string().optional(),
  })
  .passthrough();

const anthropicMessageSchema = z
  .object({
    content: z.array(
      z
        .object({
          text: z.string().optional(),
          type: z.string(),
        })
        .passthrough(),
    ),
    stop_reason: z.string().nullable().optional(),
  })
  .passthrough();

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

type AnthropicScope = 'PLAN' | 'COMMENTARY' | 'RADIO' | 'ASSISTANT';

export class AnthropicLlmError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'AnthropicLlmError';
    this.code = code;
    this.status = status;
  }
}

function createAnthropicRequestError(
  scope: AnthropicScope,
  status: number,
  upstreamError: z.infer<typeof anthropicErrorSchema> | null,
): AnthropicLlmError {
  const prefix = `ANTHROPIC_${scope}`;
  const upstreamType = upstreamError?.error?.type ?? upstreamError?.type;

  if (status === 401) {
    return new AnthropicLlmError(`${prefix}_AUTH_FAILED`, 'Anthropic API key is invalid.', 401);
  }

  if (status === 403) {
    return new AnthropicLlmError(
      `${prefix}_ACCESS_DENIED`,
      'Anthropic project does not have access to this request.',
      403,
    );
  }

  if (status === 404 || upstreamType === 'not_found_error') {
    return new AnthropicLlmError(
      `${prefix}_MODEL_UNAVAILABLE`,
      'Configured Anthropic model is unavailable for this API key.',
      502,
    );
  }

  if (status === 429) {
    return new AnthropicLlmError(
      `${prefix}_RATE_LIMITED`,
      'Anthropic quota or rate limit was reached.',
      429,
    );
  }

  if (status === 400) {
    return new AnthropicLlmError(
      `${prefix}_BAD_REQUEST`,
      'Anthropic rejected the request format.',
      502,
    );
  }

  return new AnthropicLlmError(`${prefix}_REQUEST_FAILED`, 'Anthropic request failed.', 502);
}

function extractAnthropicText(
  scope: AnthropicScope,
  response: z.infer<typeof anthropicMessageSchema>,
): string {
  if (response.stop_reason === 'refusal') {
    throw new AnthropicLlmError(
      `ANTHROPIC_${scope}_REFUSAL`,
      'Anthropic refused to generate this response.',
      422,
    );
  }

  const text = response.content.find((content) => content.type === 'text' && content.text)?.text;

  if (!text) {
    throw new AnthropicLlmError(
      `ANTHROPIC_${scope}_EMPTY`,
      'Anthropic response did not include text.',
    );
  }

  return text;
}

function simplifyJsonSchemaForAnthropic(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => simplifyJsonSchemaForAnthropic(item));
  }

  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const unsupportedConstraintKeys = new Set([
    'exclusiveMaximum',
    'exclusiveMinimum',
    'format',
    'maxItems',
    'maxLength',
    'maximum',
    'minItems',
    'minLength',
    'minimum',
    'pattern',
  ]);
  const simplified: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (unsupportedConstraintKeys.has(key)) {
      continue;
    }

    simplified[key] = simplifyJsonSchemaForAnthropic(value);
  }

  return simplified;
}

async function createAnthropicStructuredOutput<T>(input: {
  apiKey: string;
  jsonSchema: unknown;
  maxTokens: number;
  model?: LlmModel | string | null;
  outputSchema: z.ZodSchema<T>;
  scope: AnthropicScope;
  systemPrompt: string;
  temperature: number;
  userContext: string;
}): Promise<T> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), ANTHROPIC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: [
          {
            content: input.userContext,
            role: 'user',
          },
        ],
        model: resolveLlmModel(input.model, 'anthropic'),
        output_config: {
          format: {
            schema: simplifyJsonSchemaForAnthropic(input.jsonSchema),
            type: 'json_schema',
          },
        },
        system: input.systemPrompt,
        temperature: input.temperature,
      }),
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
      },
      method: 'POST',
      signal: abortController.signal,
    });

    const json = (await response.json()) as unknown;

    if (!response.ok) {
      const parsedError = anthropicErrorSchema.safeParse(json);
      throw createAnthropicRequestError(
        input.scope,
        response.status,
        parsedError.success ? parsedError.data : null,
      );
    }

    const parsedResponse = anthropicMessageSchema.safeParse(json);

    if (!parsedResponse.success) {
      throw new AnthropicLlmError(
        `ANTHROPIC_${input.scope}_RESPONSE_INVALID`,
        'Anthropic response envelope was invalid.',
      );
    }

    const outputText = extractAnthropicText(input.scope, parsedResponse.data);
    const parsedJson = JSON.parse(outputText) as unknown;
    const parsedOutput = input.outputSchema.safeParse(parsedJson);

    if (!parsedOutput.success) {
      throw new AnthropicLlmError(
        `ANTHROPIC_${input.scope}_SCHEMA_INVALID`,
        'Anthropic output did not match the expected schema.',
      );
    }

    return parsedOutput.data;
  } catch (error) {
    if (error instanceof AnthropicLlmError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new AnthropicLlmError(
        `ANTHROPIC_${input.scope}_JSON_INVALID`,
        'Anthropic output was not valid JSON.',
      );
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AnthropicLlmError(
        `ANTHROPIC_${input.scope}_TIMEOUT`,
        'Anthropic request timed out.',
        504,
      );
    }

    throw new AnthropicLlmError(
      `ANTHROPIC_${input.scope}_REQUEST_FAILED`,
      'Anthropic request failed.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function createAnthropicDjPlan(
  apiKey: string,
  input: AiDjPlanInput,
  profile?: MusicProfileContext | null,
  options?: { model?: LlmModel | string | null },
): Promise<AiDjPlanOutput> {
  return createAnthropicStructuredOutput({
    apiKey,
    jsonSchema: aiDjPlanJsonSchema,
    maxTokens: 1200,
    model: options?.model,
    outputSchema: aiDjPlanOutputSchema,
    scope: 'PLAN',
    systemPrompt: planningSystemPrompt,
    temperature: 0.4,
    userContext: buildUserContext(input, profile),
  });
}

export function createAnthropicDjCommentary(
  apiKey: string,
  input: AiDjCommentaryInput,
  options?: { model?: LlmModel | string | null },
): Promise<AiDjCommentaryOutput> {
  return createAnthropicStructuredOutput({
    apiKey,
    jsonSchema: aiDjCommentaryJsonSchema,
    maxTokens: input.depth === 'short' ? 350 : 600,
    model: options?.model,
    outputSchema: aiDjCommentaryOutputSchema,
    scope: 'COMMENTARY',
    systemPrompt: commentarySystemPrompt,
    temperature: 0.35,
    userContext: buildCommentaryUserContext(input),
  });
}

export function createAnthropicRadioSegment(
  apiKey: string,
  input: {
    feedback?: RadioTickInput['feedback'];
    playbackState?: RadioTickInput['playbackState'];
    previousSegment?: PreviousRadioSegmentContext | null;
    profile?: MusicProfileContext | null;
    programming: RadioProgrammingContext;
    prompt: string;
  },
  options?: { model?: LlmModel | string | null },
): Promise<RadioSegmentPlanOutput> {
  return createAnthropicStructuredOutput({
    apiKey,
    jsonSchema: radioSegmentJsonSchema,
    maxTokens: 1300,
    model: options?.model,
    outputSchema: radioSegmentPlanOutputSchema,
    scope: 'RADIO',
    systemPrompt: buildJoshuaRadioSystemPrompt(),
    temperature: 0.45,
    userContext: buildRadioUserContext(input),
  });
}

export function createAnthropicMusicAssistantReply(
  apiKey: string,
  input: {
    memory: MusicMemoryContext[];
    message: string;
    profile?: MusicProfileContext | null;
    recentMessages: ConversationMessageContext[];
    spotifyTasteSummary?: SpotifyTasteSummaryContext | null;
  },
  options?: { model?: LlmModel | string | null },
): Promise<MusicAssistantOutput> {
  return createAnthropicStructuredOutput({
    apiKey,
    jsonSchema: musicAssistantJsonSchema,
    maxTokens: 1100,
    model: options?.model,
    outputSchema: musicAssistantOutputSchema,
    scope: 'ASSISTANT',
    systemPrompt: buildAssistantSystemPrompt(),
    temperature: 0.45,
    userContext: buildAssistantUserContext(input),
  });
}
