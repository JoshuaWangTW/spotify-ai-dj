// components/mobile/modals/StartSessionSheet.tsx
// Bottom sheet that lets the user customise the prompt before starting a
// radio session. Pre-fills with each mode's default Chinese prompt.
'use client';

import { useState, useEffect } from 'react';

import AlbumArtwork from '../AlbumArtwork';
import { useRadio } from '../RadioContext';
import type { DjMode } from '../modes';
import { IconChevronLeft, IconPlay } from '../icons';

type Props = {
  mode: DjMode;
  onClose: () => void;
  onStarted: () => void;
};

export default function StartSessionSheet({ mode, onClose, onStarted }: Props) {
  const { draftPrompt, setDraftPrompt, startSession, isStarting, errorMessage } = useRadio();
  const [prompt, setPrompt] = useState(draftPrompt || mode.defaultPrompt);
  const [autoQueue, setAutoQueue] = useState(true);

  // If user opens another mode, refresh the prompt
  useEffect(() => {
    if (!draftPrompt) setPrompt(mode.defaultPrompt);
  }, [mode.id, draftPrompt, mode.defaultPrompt]);

  async function handleStart() {
    const ok = await startSession({ prompt, mode: mode.id, autoplayQueue: autoQueue });
    if (ok) {
      setDraftPrompt('');
      onStarted();
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto pb-8"
      style={{
        background: 'linear-gradient(170deg, #e9f4fa 0%, #dceaf2 100%)',
        animation: 'sheet-up 320ms cubic-bezier(0.32, 0.72, 0.24, 1)',
      }}
    >
      <style jsx global>{`
        @keyframes sheet-up {
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
          aria-label="Back"
        >
          <IconChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-800">{mode.label}</span>
        <span style={{ width: 36 }} />
      </div>

      <div className="px-5">
        <div
          className="overflow-hidden rounded-3xl"
          style={{
            aspectRatio: '1.4 / 1',
            boxShadow: '0 8px 24px rgba(70,110,140,0.18)',
          }}
        >
          <AlbumArtwork kind={mode.art} src={mode.coverWideSrc} size={400} radius={0} />
        </div>
      </div>

      <div className="px-5 pt-5">
        <h2 className="m-0 text-[26px] font-bold tracking-tight text-slate-900">{mode.label}</h2>
        <p className="mt-1.5 text-sm leading-snug text-slate-500">{mode.hint}</p>
      </div>

      <div className="px-5 pt-4">
        <div className="glass-panel rounded-2xl p-4">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
            Session prompt
          </div>
          <textarea
            rows={3}
            maxLength={500}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-slate-800 outline-none"
            placeholder="Describe the vibe…"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">{prompt.length} / 500</div>
        </div>
      </div>

      <div className="px-5 pt-3">
        <div className="glass-card flex items-center justify-between rounded-2xl px-4 py-3">
          <div>
            <div className="text-[13.5px] font-medium text-slate-800">Auto-queue tracks</div>
            <div className="text-[11.5px] text-slate-500">
              AI fills your Spotify queue as you listen
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoQueue}
            onClick={() => setAutoQueue((v) => !v)}
            className="relative h-[26px] w-11 rounded-full transition-colors"
            style={{
              background: autoQueue ? 'linear-gradient(135deg, #7dd3fc, #0284c7)' : '#cbd5e1',
            }}
          >
            <span
              className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]"
              style={{ left: autoQueue ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            />
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-5 mt-3 rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={isStarting || prompt.trim().length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #7dd3fc, #0284c7)',
            boxShadow: '0 10px 24px rgba(125,211,252,0.45)',
          }}
        >
          <IconPlay size={18} />
          {isStarting ? '建立中…' : 'Start Session'}
        </button>
      </div>
    </div>
  );
}
