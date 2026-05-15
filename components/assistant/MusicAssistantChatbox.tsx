'use client';

import { useState } from 'react';

import type { MusicAssistantChatOutput } from '../../lib/music-assistant/schema';

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ChatMessage = {
  content: string;
  role: 'assistant' | 'user';
};

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body;
}

function getApiErrorMessage(body: unknown, fallback: string): string {
  const parsed = body as ApiError;

  return parsed.error?.message ?? fallback;
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export default function MusicAssistantChatbox() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [input, setInput] = useState('我沒有很多歷史歌單，想從對話開始建立我的音樂偏好。');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      content:
        '你可以直接跟我聊最近想聽什麼、哪些音樂會讓你分心、想學爵士或古典的哪一塊。我會把明確偏好整理成可用的記憶。',
      role: 'assistant',
    },
  ]);
  const [lastResult, setLastResult] = useState<MusicAssistantChatOutput | null>(null);

  async function sendMessage() {
    const message = input.trim();

    if (!message) {
      return;
    }

    setErrorMessage(null);
    setIsSending(true);
    setMessages((current) => [...current, { content: message, role: 'user' }]);
    setInput('');

    try {
      const response = await fetch('/api/music-assistant/chat', {
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          message,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body = await readJsonResponse<MusicAssistantChatOutput | ApiError>(
        response,
        '音樂助手回傳格式錯誤。',
      );

      if (!response.ok || isApiError(body)) {
        throw new Error(getApiErrorMessage(body, '音樂助手暫時無法回覆。'));
      }

      setConversationId(body.conversationId);
      setLastResult(body);
      setMessages((current) => [...current, { content: body.reply, role: 'assistant' }]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '音樂助手暫時無法回覆。');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="glass-panel rounded-lg p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Music Assistant Memory</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            用對話建立偏好記憶，讓 Joshua Radio 越來越懂你的聆聽情境。
          </p>
        </div>
        <span className="self-start rounded-md border border-violet-700 bg-violet-700 px-2.5 py-1 text-xs font-semibold text-white">
          Memory Layer
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <div className="rounded-lg border border-slate-200 bg-white/60 p-3">
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-md border px-3 py-2 text-sm leading-6 ${
                  message.role === 'assistant'
                    ? 'border-sky-200 bg-sky-50 text-slate-700'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {message.role === 'assistant' ? 'assistant' : 'you'}
                </p>
                {message.content}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <textarea
              className="min-h-24 flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-600"
              maxLength={1200}
              onChange={(event) => setInput(event.target.value)}
              placeholder="跟我聊你的音樂偏好、想避開的東西、工作/晚上/烘豆時需要的氛圍..."
              value={input}
            />
            <button
              className="rounded-md border border-violet-700 bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              disabled={isSending || input.trim().length === 0}
              onClick={() => void sendMessage()}
              type="button"
            >
              {isSending ? '整理中...' : 'Send'}
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white/60 p-4">
          <p className="text-sm font-semibold text-slate-800">New Memory</p>
          <div className="mt-3 space-y-2">
            {lastResult?.memoryCandidates.length ? (
              lastResult.memoryCandidates.map((memory, index) => (
                <div
                  key={`${memory.type}-${index}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{memory.type}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        memory.saved
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {memory.saved ? 'saved' : 'observed'}
                    </span>
                  </div>
                  <p className="mt-2 leading-6 text-slate-600">{memory.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                對話中出現明確偏好時，會在這裡顯示並寫入資料庫。
              </p>
            )}
          </div>

          {lastResult?.suggestedRadioPrompt ? (
            <div className="mt-4 rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-500">
                radio prompt
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {lastResult.suggestedRadioPrompt}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
