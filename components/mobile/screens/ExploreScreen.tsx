// components/mobile/screens/ExploreScreen.tsx
'use client';

import AlbumArtwork from '../AlbumArtwork';
import { MODES, type DjMode } from '../modes';
import { IconChevronRight, IconSearch, IconSpark } from '../icons';

type Props = {
  onPickMode: (mode: DjMode) => void;
  onOpenChat: (initialPrompt?: string) => void;
};

const PRESETS = ['想聽爵士，想學一點，不要太硬', '今晚開店，平靜古典背景樂', '深度工作，沒有人聲'];

export default function ExploreScreen({ onPickMode, onOpenChat }: Props) {
  return (
    <div className="px-0">
      <div className="px-5 pt-2 pb-4">
        <p className="text-sm text-slate-500">Discover</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-slate-900">Explore</h1>
      </div>

      {/* Search bar — opens chat */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => onOpenChat()}
          className="glass-card flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-sm text-slate-500"
        >
          <IconSearch size={18} />
          <span>Ask the Music Assistant…</span>
        </button>
      </div>

      {/* AI Assistant hero card */}
      <div className="px-5 pb-6">
        <button
          type="button"
          onClick={() => onOpenChat()}
          className="glass-panel relative w-full overflow-hidden rounded-3xl p-5 text-left"
        >
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sky-900"
              style={{
                background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 3px 10px rgba(125,211,252,0.35)',
              }}
            >
              <IconSpark size={22} />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-sky-900">Music Assistant</div>
              <div className="mt-1 text-[13px] leading-snug text-slate-500">
                Chat in natural language. I&apos;ll suggest a vibe, build a queue, and explain every
                pick.
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <span
                key={p}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChat(p);
                }}
                className="rounded-full border border-sky-200/70 bg-white/70 px-2.5 py-1.5 text-[12px] text-sky-900"
              >
                {p}
              </span>
            ))}
          </div>
        </button>
      </div>

      <h3 className="mb-3 px-5 text-[17px] font-semibold text-slate-700">Modes</h3>
      <div className="grid grid-cols-2 gap-3 px-5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPickMode(m)}
            className="glass-card flex flex-col overflow-hidden rounded-3xl text-left"
          >
            <div className="aspect-[1.4/1] w-full">
              <AlbumArtwork kind={m.art} src={m.coverWideSrc} size={300} radius={0} />
            </div>
            <div className="flex items-center justify-between px-3.5 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{m.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{m.hint}</div>
              </div>
              <IconChevronRight size={18} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
