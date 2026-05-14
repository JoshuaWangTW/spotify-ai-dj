'use client';

import type { FormEvent } from 'react';

import type { AiDjPlanOutput } from '../../lib/ai-dj/plan-schema';

const modeOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'Jazz Intro', value: 'jazz_intro' },
  { label: 'Classical Intro', value: 'classical_intro' },
  { label: 'Work Focus', value: 'work_focus' },
];

type ChatPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  onModeChange(mode: string): void;
  onPromptChange(prompt: string): void;
  onSubmit(): void;
  plan: AiDjPlanOutput | null;
  prompt: string;
  selectedMode: string;
};

export default function ChatPanel({
  errorMessage,
  isLoading,
  onModeChange,
  onPromptChange,
  onSubmit,
  plan,
  prompt,
  selectedMode,
}: ChatPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="glass-panel min-h-[620px] rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">AI DJ Chat</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            輸入情境後產生搜尋策略、播放邏輯與導聆方向。
          </p>
        </div>
        <span className="rounded-md border border-sky-200/20 bg-sky-200/10 px-2.5 py-1 text-xs font-medium text-sky-100">
          Live
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {modeOptions.map((mode) => (
          <button
            key={mode.value}
            className={`rounded-md border px-3 py-2 text-sm ${
              selectedMode === mode.value
                ? 'border-sky-200/70 bg-sky-200/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                : 'border-slate-500/30 text-slate-300 hover:border-sky-200/60 hover:text-white'
            }`}
            onClick={() => onModeChange(mode.value)}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div className="glass-card rounded-lg p-4 text-slate-200">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">user</p>
          <p className="mt-2 leading-7">{prompt || '我想聽爵士，想學一點，不要太硬。'}</p>
        </div>

        <div className="rounded-lg border border-sky-200/20 bg-sky-200/10 p-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            assistant
          </p>
          <p className="mt-2 leading-7">
            {plan?.djIntro ??
              '送出需求後，我會產生 Spotify search queries，並把候選曲放到右側清單。'}
          </p>
        </div>
      </div>

      {plan ? (
        <div className="glass-card mt-5 rounded-lg p-4">
          <p className="text-sm font-semibold text-slate-50">Search strategy</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {plan.spotifySearchQueries.map((query, index) => (
              <p key={query}>
                <span className="text-slate-500">{index + 1}.</span> {query}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-md border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <form className="glass-card mt-6 flex flex-col gap-3 rounded-lg p-4" onSubmit={handleSubmit}>
        <textarea
          className="glass-control h-32 w-full resize-none rounded-md px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-200/70"
          maxLength={500}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="請輸入你的音樂需求..."
          value={prompt}
        />
        <button
          className="aqua-button rounded-md px-5 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading || prompt.trim().length === 0}
          type="submit"
        >
          {isLoading ? '產生中...' : '送出需求'}
        </button>
      </form>
    </section>
  );
}
