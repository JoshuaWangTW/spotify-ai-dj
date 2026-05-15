import 'server-only';

import { z } from 'zod';

import { buildJoshuaRadioSystemPrompt } from '../ai-dj/persona';
import type { RadioProgrammingContext } from '../radio/programming';
import {
  radioSegmentJsonSchema,
  radioSegmentPlanOutputSchema,
  type RadioSegmentPlanOutput,
  type RadioTickInput,
} from '../radio/schema';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REQUEST_TIMEOUT_MS = 15_000;
const OPENAI_RADIO_MODEL = 'gpt-4o';

const openAiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().nullable().optional(),
        message: z.string().optional(),
        type: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const openAiResponseSchema = z
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
                    refusal: z.string().optional(),
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

export class OpenAiRadioError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'OpenAiRadioError';
    this.code = code;
    this.status = status;
  }
}

function createOpenAiRadioRequestError(
  status: number,
  upstreamError: z.infer<typeof openAiErrorSchema> | null,
): OpenAiRadioError {
  const upstreamCode = upstreamError?.error?.code ?? undefined;

  if (status === 401) {
    return new OpenAiRadioError('OPENAI_RADIO_AUTH_FAILED', 'OpenAI API key is invalid.', 401);
  }

  if (status === 403) {
    return new OpenAiRadioError(
      'OPENAI_RADIO_ACCESS_DENIED',
      'OpenAI project does not have access to this request.',
      403,
    );
  }

  if (status === 404 || upstreamCode === 'model_not_found') {
    return new OpenAiRadioError(
      'OPENAI_RADIO_MODEL_UNAVAILABLE',
      'Configured OpenAI model is unavailable for this API key.',
      502,
    );
  }

  if (status === 429) {
    return new OpenAiRadioError(
      'OPENAI_RADIO_RATE_LIMITED',
      'OpenAI quota or rate limit was reached.',
      429,
    );
  }

  if (status === 400) {
    return new OpenAiRadioError(
      'OPENAI_RADIO_BAD_REQUEST',
      'OpenAI rejected the request format.',
      502,
    );
  }

  return new OpenAiRadioError('OPENAI_RADIO_REQUEST_FAILED', 'OpenAI request failed.', 502);
}

function extractOutputText(response: z.infer<typeof openAiResponseSchema>): string | null {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) {
        throw new OpenAiRadioError('OPENAI_RADIO_REFUSAL', 'OpenAI refused to generate radio.', 422);
      }

      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}

function buildRadioUserContext(input: {
  feedback?: RadioTickInput['feedback'];
  playbackState?: RadioTickInput['playbackState'];
  previousSegment?: PreviousRadioSegmentContext | null;
  profile?: MusicProfileContext | null;
  programming: RadioProgrammingContext;
  prompt: string;
}): string {
  const previousPlan =
    input.previousSegment?.planJson && typeof input.previousSegment.planJson === 'object'
      ? JSON.stringify(input.previousSegment.planJson)
      : '無';

  return [
    '使用者偏好摘要：',
    input.profile?.tasteSummary || '尚未建立偏好摘要。',
    '',
    '使用者避免：',
    input.profile?.avoidSummary || '尚未建立避免摘要。',
    '',
    `古典程度：${input.profile?.classicalLevel || 'beginner'}`,
    `爵士程度：${input.profile?.jazzLevel || 'beginner'}`,
    '',
    '節目 programming：',
    JSON.stringify(input.programming),
    '',
    '使用者本次 radio session 需求：',
    input.prompt,
    '',
    '目前播放狀態：',
    input.playbackState ? JSON.stringify(input.playbackState) : '未提供',
    '',
    '本次 tick feedback：',
    input.feedback && input.feedback.length > 0 ? JSON.stringify(input.feedback) : '無',
    '',
    '上一段節目：',
    previousPlan,
    '',
    '上一段 Spotify search queries：',
    input.previousSegment?.trackQueries.join(' | ') || '無',
    '',
    '請產生下一段 5 到 8 首歌的 radio queue strategy。避免和上一段重複過近，保持自然銜接。',
  ].join('\n');
}

export async function createOpenAiRadioSegment(
  apiKey: string,
  input: {
    feedback?: RadioTickInput['feedback'];
    playbackState?: RadioTickInput['playbackState'];
    previousSegment?: PreviousRadioSegmentContext | null;
    profile?: MusicProfileContext | null;
    programming: RadioProgrammingContext;
    prompt: string;
  },
): Promise<RadioSegmentPlanOutput> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            content: buildJoshuaRadioSystemPrompt(),
            role: 'system',
          },
          {
            content: buildRadioUserContext(input),
            role: 'user',
          },
        ],
        max_output_tokens: 1300,
        model: OPENAI_RADIO_MODEL,
        temperature: 0.45,
        text: {
          format: {
            name: 'radio_segment',
            schema: radioSegmentJsonSchema,
            strict: true,
            type: 'json_schema',
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: abortController.signal,
    });

    const json = (await response.json()) as unknown;

    if (!response.ok) {
      const parsedError = openAiErrorSchema.safeParse(json);
      throw createOpenAiRadioRequestError(
        response.status,
        parsedError.success ? parsedError.data : null,
      );
    }

    const parsedResponse = openAiResponseSchema.safeParse(json);

    if (!parsedResponse.success) {
      throw new OpenAiRadioError(
        'OPENAI_RADIO_RESPONSE_INVALID',
        'OpenAI response envelope was invalid.',
      );
    }

    const outputText = extractOutputText(parsedResponse.data);

    if (!outputText) {
      throw new OpenAiRadioError('OPENAI_RADIO_EMPTY', 'OpenAI response did not include text.');
    }

    const parsedJson = JSON.parse(outputText) as unknown;
    const parsedSegment = radioSegmentPlanOutputSchema.safeParse(parsedJson);

    if (!parsedSegment.success) {
      throw new OpenAiRadioError(
        'OPENAI_RADIO_SCHEMA_INVALID',
        'OpenAI radio segment did not match the expected schema.',
        502,
      );
    }

    return parsedSegment.data;
  } catch (error) {
    if (error instanceof OpenAiRadioError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new OpenAiRadioError('OPENAI_RADIO_JSON_INVALID', 'OpenAI radio was not valid JSON.');
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAiRadioError('OPENAI_RADIO_TIMEOUT', 'OpenAI radio request timed out.', 504);
    }

    throw new OpenAiRadioError('OPENAI_RADIO_REQUEST_FAILED', 'OpenAI radio request failed.');
  } finally {
    clearTimeout(timeout);
  }
}
