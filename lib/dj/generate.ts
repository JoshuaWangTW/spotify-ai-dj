import 'server-only';

import { z } from 'zod';

import type { ServerEnv } from '../config/env';
import { resolveLlmModel } from '../llm/model-options';
import type { DjPersona } from './personas';
import type { PrefetchTrack } from './prefetch';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DJ_SCRIPT_TIMEOUT_MS = 8_000;

const djScriptOutputSchema = z
  .object({
    script: z.string().trim().min(20).max(140),
  })
  .strict();

const openAiTextResponseSchema = z
  .object({
    output_text: z.string().optional(),
    output: z
      .array(
        z
          .object({
            content: z
              .array(
                z
                  .object({
                    text: z.string().optional(),
                    type: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
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
  })
  .passthrough();

export class DjScriptGenerationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DjScriptGenerationError';
    this.code = code;
  }
}

function buildDjScriptUserContext(input: {
  nextTrack: PrefetchTrack;
  prevTrack: PrefetchTrack;
  recentScripts: string[];
}): string {
  return [
    `剛播完：${input.prevTrack.title} / ${input.prevTrack.artist}`,
    `即將播放：${input.nextTrack.title} / ${input.nextTrack.artist}`,
    '',
    '最近說過的話，請避免重複句型、意象與話題：',
    input.recentScripts.length > 0 ? input.recentScripts.join('\n---\n') : '尚無。',
    '',
    '請只輸出 JSON：{"script":"..."}',
  ].join('\n');
}

function extractOpenAiText(response: z.infer<typeof openAiTextResponseSchema>): string | null {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}

function normalizeScript(script: string): string {
  const normalized = script.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  const truncated = normalized.slice(0, 120);
  const lastSentenceBreak = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
  );

  return lastSentenceBreak >= 40 ? truncated.slice(0, lastSentenceBreak + 1) : truncated;
}

function parseGeneratedScript(raw: string): string {
  const parsed = djScriptOutputSchema.safeParse(JSON.parse(raw) as unknown);

  if (!parsed.success) {
    throw new DjScriptGenerationError('DJ_SCRIPT_SCHEMA_INVALID', 'DJ script output was invalid.');
  }

  return normalizeScript(parsed.data.script);
}

async function createOpenAiDjScript(input: {
  apiKey: string;
  env: ServerEnv;
  nextTrack: PrefetchTrack;
  persona: DjPersona;
  prevTrack: PrefetchTrack;
  recentScripts: string[];
}): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), DJ_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            content: input.persona.systemPrompt,
            role: 'system',
          },
          {
            content: buildDjScriptUserContext(input),
            role: 'user',
          },
        ],
        max_output_tokens: 200,
        model: resolveLlmModel(input.env.OPENAI_MODEL, 'openai'),
        temperature: 0.55,
        text: {
          format: {
            name: 'dj_script',
            schema: {
              additionalProperties: false,
              properties: {
                script: {
                  type: 'string',
                },
              },
              required: ['script'],
              type: 'object',
            },
            strict: true,
            type: 'json_schema',
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new DjScriptGenerationError('OPENAI_DJ_SCRIPT_FAILED', 'OpenAI DJ script failed.');
    }

    const parsed = openAiTextResponseSchema.safeParse((await response.json()) as unknown);

    if (!parsed.success) {
      throw new DjScriptGenerationError(
        'OPENAI_DJ_SCRIPT_RESPONSE_INVALID',
        'OpenAI DJ script response was invalid.',
      );
    }

    const text = extractOpenAiText(parsed.data);

    if (!text) {
      throw new DjScriptGenerationError('OPENAI_DJ_SCRIPT_EMPTY', 'OpenAI DJ script was empty.');
    }

    return parseGeneratedScript(text);
  } catch (error) {
    if (error instanceof DjScriptGenerationError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new DjScriptGenerationError('OPENAI_DJ_SCRIPT_TIMEOUT', 'OpenAI DJ script timed out.');
    }

    throw new DjScriptGenerationError('OPENAI_DJ_SCRIPT_FAILED', 'OpenAI DJ script failed.');
  } finally {
    clearTimeout(timeout);
  }
}

async function createAnthropicDjScript(input: {
  apiKey: string;
  env: ServerEnv;
  nextTrack: PrefetchTrack;
  persona: DjPersona;
  prevTrack: PrefetchTrack;
  recentScripts: string[];
}): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), DJ_SCRIPT_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      body: JSON.stringify({
        max_tokens: 200,
        messages: [
          {
            content: buildDjScriptUserContext(input),
            role: 'user',
          },
        ],
        model: resolveLlmModel(input.env.ANTHROPIC_MODEL, 'anthropic'),
        system: [
          {
            cache_control: { type: 'ephemeral' },
            text: input.persona.systemPrompt,
            type: 'text',
          },
          {
            cache_control: { type: 'ephemeral' },
            text: `最近說過的話：\n${input.recentScripts.join('\n---\n') || '尚無。'}`,
            type: 'text',
          },
        ],
        temperature: 0.55,
      }),
      headers: {
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
      },
      method: 'POST',
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new DjScriptGenerationError(
        'ANTHROPIC_DJ_SCRIPT_FAILED',
        'Anthropic DJ script failed.',
      );
    }

    const parsed = anthropicMessageSchema.safeParse((await response.json()) as unknown);

    if (!parsed.success) {
      throw new DjScriptGenerationError(
        'ANTHROPIC_DJ_SCRIPT_RESPONSE_INVALID',
        'Anthropic DJ script response was invalid.',
      );
    }

    const text = parsed.data.content.find(
      (content) => content.type === 'text' && content.text,
    )?.text;

    if (!text) {
      throw new DjScriptGenerationError(
        'ANTHROPIC_DJ_SCRIPT_EMPTY',
        'Anthropic DJ script was empty.',
      );
    }

    return parseGeneratedScript(text);
  } catch (error) {
    if (error instanceof DjScriptGenerationError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new DjScriptGenerationError(
        'ANTHROPIC_DJ_SCRIPT_TIMEOUT',
        'Anthropic DJ script timed out.',
      );
    }

    throw new DjScriptGenerationError('ANTHROPIC_DJ_SCRIPT_FAILED', 'Anthropic DJ script failed.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateDjScript(input: {
  env: ServerEnv;
  nextTrack: PrefetchTrack;
  persona: DjPersona;
  prevTrack: PrefetchTrack;
  recentScripts: string[];
}): Promise<string> {
  if (input.env.LLM_PROVIDER === 'anthropic' && input.env.ANTHROPIC_API_KEY) {
    return createAnthropicDjScript({
      ...input,
      apiKey: input.env.ANTHROPIC_API_KEY,
    });
  }

  if (input.env.OPENAI_API_KEY) {
    return createOpenAiDjScript({
      ...input,
      apiKey: input.env.OPENAI_API_KEY,
    });
  }

  throw new DjScriptGenerationError(
    'DJ_SCRIPT_LLM_UNCONFIGURED',
    'No DJ script LLM is configured.',
  );
}
