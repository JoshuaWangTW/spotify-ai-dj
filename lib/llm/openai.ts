import 'server-only';

import { z } from 'zod';

import {
  aiDjCommentaryJsonSchema,
  aiDjCommentaryOutputSchema,
  type AiDjCommentaryInput,
  type AiDjCommentaryOutput,
} from '../ai-dj/commentary-schema';
import {
  aiDjPlanJsonSchema,
  aiDjPlanOutputSchema,
  type AiDjPlanInput,
  type AiDjPlanOutput,
} from '../ai-dj/plan-schema';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REQUEST_TIMEOUT_MS = 15_000;
const OPENAI_PLANNING_MODEL = 'gpt-4o';

const planningSystemPrompt = [
  '你是一個音樂播放策略引擎，專長是古典樂與爵士樂導聆。',
  '你不能假裝自己可以直接存取 Spotify 曲庫。',
  '你只能輸出 Spotify Search 可用的搜尋策略、播放邏輯與導聆方向。',
  '不要輸出歌詞。',
  '不要宣稱你訓練過 Spotify 資料。',
  '輸出必須符合指定 JSON schema。',
  '推薦要考慮：使用情境、能量、人聲比例、學習難度、曲目銜接。',
  '請產生 8 到 10 個 Spotify search queries 與對應 queue reasoning。',
].join('\n');

const commentarySystemPrompt = [
  '你是古典與爵士導聆 DJ。',
  '請針對目前曲目產生中文導聆。',
  '不要講歌詞。',
  '不要編造錄音細節；不知道版本時只講作品或風格。',
  '給 2 到 3 個聆聽重點。',
  '輸出必須符合指定 JSON schema。',
].join('\n');

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
                    text: z.string().optional(),
                    type: z.string().optional(),
                    refusal: z.string().optional(),
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

export class OpenAiPlanError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'OpenAiPlanError';
    this.code = code;
    this.status = status;
  }
}

export class OpenAiCommentaryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'OpenAiCommentaryError';
    this.code = code;
    this.status = status;
  }
}

function createOpenAiRequestError(
  scope: 'PLAN' | 'COMMENTARY',
  status: number,
  upstreamError: z.infer<typeof openAiErrorSchema> | null,
): OpenAiPlanError | OpenAiCommentaryError {
  const prefix = scope === 'PLAN' ? 'OPENAI_PLAN' : 'OPENAI_COMMENTARY';
  const ErrorClass = scope === 'PLAN' ? OpenAiPlanError : OpenAiCommentaryError;
  const upstreamCode = upstreamError?.error?.code ?? undefined;

  if (status === 401) {
    return new ErrorClass(
      `${prefix}_AUTH_FAILED`,
      'OpenAI API key is invalid or not authorized.',
      401,
    );
  }

  if (status === 403) {
    return new ErrorClass(
      `${prefix}_ACCESS_DENIED`,
      'OpenAI project does not have access to this request.',
      403,
    );
  }

  if (status === 404 || upstreamCode === 'model_not_found') {
    return new ErrorClass(
      `${prefix}_MODEL_UNAVAILABLE`,
      'Configured OpenAI model is unavailable for this API key.',
      502,
    );
  }

  if (status === 429) {
    return new ErrorClass(
      `${prefix}_RATE_LIMITED`,
      'OpenAI quota or rate limit was reached.',
      429,
    );
  }

  if (status === 400) {
    return new ErrorClass(
      `${prefix}_BAD_REQUEST`,
      'OpenAI rejected the request format.',
      502,
    );
  }

  return new ErrorClass(`${prefix}_REQUEST_FAILED`, 'OpenAI request failed.', 502);
}

function buildUserContext(input: AiDjPlanInput, profile?: MusicProfileContext | null): string {
  return [
    '使用者偏好摘要：',
    profile?.tasteSummary || '尚未建立偏好摘要。',
    '',
    '使用者避免：',
    profile?.avoidSummary || '尚未建立避免摘要。',
    '',
    `古典程度：${profile?.classicalLevel || 'beginner'}`,
    `爵士程度：${profile?.jazzLevel || 'beginner'}`,
    '',
    `模式：${input.mode}`,
    '',
    '本次需求：',
    input.prompt,
  ].join('\n');
}

function extractOutputText(response: z.infer<typeof openAiResponseSchema>): string | null {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) {
        throw new OpenAiPlanError('OPENAI_REFUSAL', 'OpenAI refused to generate a plan.', 422);
      }

      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}

function buildCommentaryUserContext(input: AiDjCommentaryInput): string {
  return [
    `曲目：${input.trackName}`,
    `演出者：${input.artistName}`,
    `模式：${input.mode}`,
    `深度：${input.depth}`,
    input.depth === 'short'
      ? '限制：commentary 請控制在 80 到 150 中文字。'
      : '限制：commentary 可以較深入，但請控制在 160 到 220 中文字。',
  ].join('\n');
}

export async function createOpenAiDjPlan(
  apiKey: string,
  input: AiDjPlanInput,
  profile?: MusicProfileContext | null,
): Promise<AiDjPlanOutput> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        model: OPENAI_PLANNING_MODEL,
        input: [
          {
            role: 'system',
            content: planningSystemPrompt,
          },
          {
            role: 'user',
            content: buildUserContext(input, profile),
          },
        ],
        max_output_tokens: 1200,
        temperature: 0.4,
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_dj_plan',
            strict: true,
            schema: aiDjPlanJsonSchema,
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
      throw createOpenAiRequestError(
        'PLAN',
        response.status,
        parsedError.success ? parsedError.data : null,
      );
    }

    const parsedResponse = openAiResponseSchema.safeParse(json);

    if (!parsedResponse.success) {
      throw new OpenAiPlanError(
        'OPENAI_PLAN_RESPONSE_INVALID',
        'OpenAI response envelope was invalid.',
      );
    }

    const outputText = extractOutputText(parsedResponse.data);

    if (!outputText) {
      throw new OpenAiPlanError('OPENAI_PLAN_EMPTY', 'OpenAI response did not include text.');
    }

    const parsedJson = JSON.parse(outputText) as unknown;
    const parsedPlan = aiDjPlanOutputSchema.safeParse(parsedJson);

    if (!parsedPlan.success) {
      throw new OpenAiPlanError(
        'OPENAI_PLAN_SCHEMA_INVALID',
        'OpenAI plan did not match the expected schema.',
        502,
      );
    }

    return parsedPlan.data;
  } catch (error) {
    if (error instanceof OpenAiPlanError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new OpenAiPlanError('OPENAI_PLAN_JSON_INVALID', 'OpenAI plan was not valid JSON.');
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAiPlanError('OPENAI_PLAN_TIMEOUT', 'OpenAI plan request timed out.', 504);
    }

    throw new OpenAiPlanError('OPENAI_PLAN_REQUEST_FAILED', 'OpenAI plan request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function createOpenAiDjCommentary(
  apiKey: string,
  input: AiDjCommentaryInput,
): Promise<AiDjCommentaryOutput> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        model: OPENAI_PLANNING_MODEL,
        input: [
          {
            role: 'system',
            content: commentarySystemPrompt,
          },
          {
            role: 'user',
            content: buildCommentaryUserContext(input),
          },
        ],
        max_output_tokens: input.depth === 'short' ? 350 : 600,
        temperature: 0.35,
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_dj_commentary',
            strict: true,
            schema: aiDjCommentaryJsonSchema,
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
      throw createOpenAiRequestError(
        'COMMENTARY',
        response.status,
        parsedError.success ? parsedError.data : null,
      );
    }

    const parsedResponse = openAiResponseSchema.safeParse(json);

    if (!parsedResponse.success) {
      throw new OpenAiCommentaryError(
        'OPENAI_COMMENTARY_RESPONSE_INVALID',
        'OpenAI response envelope was invalid.',
      );
    }

    const outputText = extractOutputText(parsedResponse.data);

    if (!outputText) {
      throw new OpenAiCommentaryError(
        'OPENAI_COMMENTARY_EMPTY',
        'OpenAI response did not include text.',
      );
    }

    const parsedJson = JSON.parse(outputText) as unknown;
    const parsedCommentary = aiDjCommentaryOutputSchema.safeParse(parsedJson);

    if (!parsedCommentary.success) {
      throw new OpenAiCommentaryError(
        'OPENAI_COMMENTARY_SCHEMA_INVALID',
        'OpenAI commentary did not match the expected schema.',
        502,
      );
    }

    return parsedCommentary.data;
  } catch (error) {
    if (error instanceof OpenAiCommentaryError) {
      throw error;
    }

    if (error instanceof OpenAiPlanError) {
      throw new OpenAiCommentaryError(error.code, error.message, error.status);
    }

    if (error instanceof SyntaxError) {
      throw new OpenAiCommentaryError(
        'OPENAI_COMMENTARY_JSON_INVALID',
        'OpenAI commentary was not valid JSON.',
      );
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAiCommentaryError(
        'OPENAI_COMMENTARY_TIMEOUT',
        'OpenAI commentary request timed out.',
        504,
      );
    }

    throw new OpenAiCommentaryError(
      'OPENAI_COMMENTARY_REQUEST_FAILED',
      'OpenAI commentary request failed.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
