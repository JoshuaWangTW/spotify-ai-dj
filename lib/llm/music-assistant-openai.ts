import 'server-only';

import { z } from 'zod';

import {
  musicAssistantJsonSchema,
  musicAssistantOutputSchema,
  type MusicAssistantOutput,
} from '../music-assistant/schema';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REQUEST_TIMEOUT_MS = 15_000;
const OPENAI_ASSISTANT_MODEL = 'gpt-4o';

const openAiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().nullable().optional(),
        message: z.string().optional(),
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

type ConversationMessageContext = {
  content: string;
  role: string;
};

type MusicMemoryContext = {
  content: string;
  confidence: number;
  type: string;
};

export class OpenAiMusicAssistantError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'OpenAiMusicAssistantError';
    this.code = code;
    this.status = status;
  }
}

function createOpenAiRequestError(
  status: number,
  upstreamError: z.infer<typeof openAiErrorSchema> | null,
): OpenAiMusicAssistantError {
  const upstreamCode = upstreamError?.error?.code ?? undefined;

  if (status === 401) {
    return new OpenAiMusicAssistantError(
      'OPENAI_ASSISTANT_AUTH_FAILED',
      'OpenAI API key is invalid.',
      401,
    );
  }

  if (status === 403) {
    return new OpenAiMusicAssistantError(
      'OPENAI_ASSISTANT_ACCESS_DENIED',
      'OpenAI project does not have access to this request.',
      403,
    );
  }

  if (status === 404 || upstreamCode === 'model_not_found') {
    return new OpenAiMusicAssistantError(
      'OPENAI_ASSISTANT_MODEL_UNAVAILABLE',
      'Configured OpenAI model is unavailable for this API key.',
    );
  }

  if (status === 429) {
    return new OpenAiMusicAssistantError(
      'OPENAI_ASSISTANT_RATE_LIMITED',
      'OpenAI quota or rate limit was reached.',
      429,
    );
  }

  return new OpenAiMusicAssistantError(
    'OPENAI_ASSISTANT_REQUEST_FAILED',
    'OpenAI assistant request failed.',
  );
}

function extractOutputText(response: z.infer<typeof openAiResponseSchema>): string | null {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) {
        throw new OpenAiMusicAssistantError(
          'OPENAI_ASSISTANT_REFUSAL',
          'OpenAI refused to answer.',
          422,
        );
      }

      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}

function buildAssistantSystemPrompt(): string {
  return [
    '你是 Spotify AI DJ 的音樂助手，像 Hermes-style assistant：會透過對話理解使用者，但記憶必須可審計、可修正、不可神秘化。',
    '你的任務是陪使用者聊音樂、釐清偏好、學習目標、避免項與使用情境，並產生可供日後推薦使用的 memory candidates。',
    '不要宣稱你能直接讀取 Spotify 歷史歌單。沒有資料時，就透過問題慢慢建立偏好。',
    '不要輸出歌詞，不要下載、代理、轉存 Spotify 音檔。',
    '不要把 Spotify content 用於模型訓練或 fine-tuning。',
    '記憶只能來自使用者明確說出的偏好或本次對話中高度可信的結論。',
    '如果資訊不明確，少量追問，不要硬塞記憶。',
    'reply 使用繁體中文，語氣自然、簡潔、像懂音樂的助理。',
    '輸出必須符合指定 JSON schema。',
  ].join('\n');
}

function buildAssistantUserContext(input: {
  memory: MusicMemoryContext[];
  message: string;
  profile?: MusicProfileContext | null;
  recentMessages: ConversationMessageContext[];
}): string {
  return [
    'MusicProfile：',
    JSON.stringify({
      avoidSummary: input.profile?.avoidSummary ?? '',
      classicalLevel: input.profile?.classicalLevel ?? 'beginner',
      jazzLevel: input.profile?.jazzLevel ?? 'beginner',
      tasteSummary: input.profile?.tasteSummary ?? '',
    }),
    '',
    '既有記憶：',
    input.memory.length > 0 ? JSON.stringify(input.memory) : '[]',
    '',
    '最近對話：',
    input.recentMessages.length > 0 ? JSON.stringify(input.recentMessages) : '[]',
    '',
    '使用者新訊息：',
    input.message,
  ].join('\n');
}

export async function createOpenAiMusicAssistantReply(
  apiKey: string,
  input: {
    memory: MusicMemoryContext[];
    message: string;
    profile?: MusicProfileContext | null;
    recentMessages: ConversationMessageContext[];
  },
): Promise<MusicAssistantOutput> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            content: buildAssistantSystemPrompt(),
            role: 'system',
          },
          {
            content: buildAssistantUserContext(input),
            role: 'user',
          },
        ],
        max_output_tokens: 1100,
        model: OPENAI_ASSISTANT_MODEL,
        temperature: 0.45,
        text: {
          format: {
            name: 'music_assistant_reply',
            schema: musicAssistantJsonSchema,
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
      throw createOpenAiRequestError(
        response.status,
        parsedError.success ? parsedError.data : null,
      );
    }

    const parsedResponse = openAiResponseSchema.safeParse(json);

    if (!parsedResponse.success) {
      throw new OpenAiMusicAssistantError(
        'OPENAI_ASSISTANT_RESPONSE_INVALID',
        'OpenAI response envelope was invalid.',
      );
    }

    const outputText = extractOutputText(parsedResponse.data);

    if (!outputText) {
      throw new OpenAiMusicAssistantError(
        'OPENAI_ASSISTANT_EMPTY',
        'OpenAI response did not include text.',
      );
    }

    const parsedJson = JSON.parse(outputText) as unknown;
    const parsedOutput = musicAssistantOutputSchema.safeParse(parsedJson);

    if (!parsedOutput.success) {
      throw new OpenAiMusicAssistantError(
        'OPENAI_ASSISTANT_SCHEMA_INVALID',
        'OpenAI assistant output did not match the expected schema.',
      );
    }

    return parsedOutput.data;
  } catch (error) {
    if (error instanceof OpenAiMusicAssistantError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new OpenAiMusicAssistantError(
        'OPENAI_ASSISTANT_JSON_INVALID',
        'OpenAI assistant output was not valid JSON.',
      );
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenAiMusicAssistantError(
        'OPENAI_ASSISTANT_TIMEOUT',
        'OpenAI assistant request timed out.',
        504,
      );
    }

    throw new OpenAiMusicAssistantError(
      'OPENAI_ASSISTANT_REQUEST_FAILED',
      'OpenAI assistant request failed.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
