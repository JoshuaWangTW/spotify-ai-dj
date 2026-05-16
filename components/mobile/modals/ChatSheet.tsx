// components/mobile/modals/ChatSheet.tsx
// Mobile-first Music Assistant chat. Replaces the embedded MusicAssistantChatbox
// on Explore. Hands off to StartSessionSheet via RadioContext.draftPrompt.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { MusicAssistantChatOutput } from '../../../lib/music-assistant/schema';
import { readStoredLlmSelection } from '../../llm/useLlmModelPreference';
import { useRadio } from '../RadioContext';
import { IconClose, IconMore, IconSend, IconSpark } from '../icons';

type ApiError = { error?: { message?: string } };
function isApiError(b: unknown): b is ApiError {
  return !!b && typeof b === 'object' && 'error' in b;
}

type Message =
  | { role: 'assistant'; text: string; suggestedRadioPrompt?: string }
  | { role: 'user'; text: string };

const SUGGESTED = [
  '想聽爵士，想學一點，不要太硬',
  '今晚開店，平靜古典背景樂',
  '深度工作，沒有人聲',
  '咖啡烘豆，需要規律節奏',
];

type Props = {
  onClose: () => void;
  /** Initial prompt to drop into the input box (e.g. when opened from a chip) */
  initialPrompt?: string;
  /** Called after the user taps "Use this prompt" on a suggested radio prompt.
   *  Caller should open the StartSessionSheet. */
  onUseRadioPrompt: (prompt: string) => void;
};

export default function ChatSheet({ onClose, initialPrompt, onUseRadioPrompt }: Props) {
  const { setDraftPrompt } = useRadio();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: '嗨！想聽什麼樣的音樂？告訴我情境、心情，或想學的東西，我可以幫你規劃一段。',
    },
  ]);
  const [input, setInput] = useState(initialPrompt ?? '');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // If parent passes a new initialPrompt, reflect it in the input
  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);

  // Auto-scroll to latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setMessages((m) => [...m, { role: 'user', text: trimmed }]);
      setInput('');
      setSending(true);
      setError(null);
      try {
        const llmSelection = readStoredLlmSelection();
        const r = await fetch('/api/music-assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationId ?? undefined,
            includeSpotifyTaste: false,
            llmModel: llmSelection.llmModel,
            llmProvider: llmSelection.llmProvider,
          }),
        });
        const body = (await r.json()) as MusicAssistantChatOutput | ApiError;
        if (!r.ok || isApiError(body)) {
          throw new Error((body as ApiError).error?.message ?? 'Music Assistant 回應失敗。');
        }
        setConversationId(body.conversationId);
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: body.reply,
            suggestedRadioPrompt: body.suggestedRadioPrompt,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Music Assistant 回應失敗。');
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  const applySuggestion = (prompt: string) => {
    setDraftPrompt(prompt);
    onUseRadioPrompt(prompt);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        background: 'linear-gradient(170deg, #e9f4fa 0%, #f0f7fa 100%)',
        animation: 'cs-slide-up 320ms cubic-bezier(0.32, 0.72, 0.24, 1)',
      }}
    >
      <style jsx global>{`
        @keyframes cs-slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),44px)] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
          aria-label="Close"
        >
          <IconClose size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-800">Music Assistant</span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
        >
          <IconMore size={20} />
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'user' ? (
              <div
                className="max-w-[80%] rounded-3xl rounded-br-md px-3.5 py-2.5 text-[14px] text-sky-900"
                style={{
                  background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                  boxShadow: '0 2px 6px rgba(125,211,252,0.25)',
                }}
              >
                {m.text}
              </div>
            ) : (
              <div className="max-w-[88%]">
                <div className="glass-card rounded-3xl rounded-bl-md px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800 whitespace-pre-line">
                  {m.text}
                </div>
                {m.suggestedRadioPrompt ? (
                  <button
                    type="button"
                    onClick={() => applySuggestion(m.suggestedRadioPrompt!)}
                    className="mt-2 flex items-center gap-2 rounded-2xl border border-sky-300/70 bg-sky-50/80 px-3 py-2 text-left text-[12.5px] font-semibold text-sky-900"
                  >
                    <IconSpark size={14} />
                    <span className="flex-1">
                      套用此 prompt 並 Start session
                      <span className="block font-normal text-slate-500">
                        {m.suggestedRadioPrompt}
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {sending ? (
          <div className="flex justify-start">
            <div className="glass-card rounded-3xl rounded-bl-md px-3.5 py-2.5 text-[14px] text-slate-500">
              <span className="inline-block animate-pulse">思考中…</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {/* Suggested prompts — only show before first user message */}
        {messages.length === 1 && !sending ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Suggested
            </div>
            {SUGGESTED.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void send(p)}
                className="glass-card rounded-2xl px-3.5 py-2.5 text-left text-[13px] text-slate-600"
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div
        className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]"
        style={{
          background: 'linear-gradient(to top, rgba(245,250,253,0.98), rgba(245,250,253,0))',
        }}
      >
        <div className="glass-panel flex items-center gap-2 rounded-[22px] py-1.5 pl-4 pr-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Describe your vibe…"
            disabled={sending}
            className="flex-1 border-0 bg-transparent py-2 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={sending || input.trim().length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #7dd3fc, #0284c7)',
              boxShadow: '0 2px 8px rgba(125,211,252,0.4)',
            }}
            aria-label="Send"
          >
            <IconSend size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
