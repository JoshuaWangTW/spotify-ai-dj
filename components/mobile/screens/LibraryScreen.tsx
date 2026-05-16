// components/mobile/screens/LibraryScreen.tsx
'use client';

import { useEffect, useState } from 'react';

import AlbumArtwork from '../AlbumArtwork';
import { useRadio } from '../RadioContext';
import { findMode } from '../modes';
import { IconChevronRight } from '../icons';

type Props = {
  onOpenNowPlaying: () => void;
};

type LibTab = 'sessions' | 'liked' | 'queue';

type RadioSessionSummary = {
  id: string;
  status: 'active' | 'stopped';
  mode: string;
  userPrompt: string;
  startedAt: string;
  endedAt: string | null;
  segmentCount: number;
};

const TABS: { id: LibTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'liked', label: 'Liked' },
  { id: 'queue', label: 'Queue' },
];

export default function LibraryScreen({ onOpenNowPlaying }: Props) {
  const [tab, setTab] = useState<LibTab>('sessions');

  return (
    <div className="px-0">
      <div className="px-5 pt-2 pb-4">
        <p className="text-sm text-slate-500">Your stuff</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-slate-900">Library</h1>
      </div>

      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-[9px] px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                tab === t.id ? 'bg-white text-sky-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'sessions' && <SessionList onOpenNowPlaying={onOpenNowPlaying} />}
      {tab === 'liked' && <LikedPlaceholder />}
      {tab === 'queue' && <QueueList />}
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

function SessionList({ onOpenNowPlaying }: { onOpenNowPlaying: () => void }) {
  const { session } = useRadio();
  const [sessions, setSessions] = useState<RadioSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch('/api/radio/sessions');
        if (!r.ok) throw new Error('讀取失敗');
        const body = (await r.json()) as { ok: true; sessions: RadioSessionSummary[] };
        if (!cancelled) setSessions(body.sessions);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '讀取失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch when an active session id changes — captures newly-created sessions
  }, [session?.id]);

  if (loading) {
    return (
      <div className="px-5">
        <div className="glass-card rounded-2xl p-4 text-center text-sm text-slate-500">
          載入 sessions…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5">
        <div className="rounded-md border border-rose-300/50 bg-rose-50 px-3 py-3 text-center text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="px-5">
        <div className="glass-card rounded-2xl p-4 text-center text-sm text-slate-500">
          還沒有 sessions — 從 For You 或 Explore 開一段試試。
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 px-5">
      {sessions.map((s) => {
        const mode = findMode(s.mode as Parameters<typeof findMode>[0]);
        const isActive = s.status === 'active';
        return (
          <button
            key={s.id}
            type="button"
            onClick={isActive ? onOpenNowPlaying : undefined}
            className="glass-card flex w-full items-center gap-3 rounded-2xl p-2.5 text-left"
          >
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
              <AlbumArtwork
                kind={mode?.art ?? 'mountains'}
                src={mode?.coverSquareSrc}
                size={56}
                radius={12}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-slate-800">
                  {mode?.label ?? s.mode}
                </div>
                {isActive && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Live
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{s.userPrompt}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {s.segmentCount} segment{s.segmentCount === 1 ? '' : 's'} ·{' '}
                {relativeTime(s.startedAt)}
              </div>
            </div>
            <IconChevronRight size={18} />
          </button>
        );
      })}
    </div>
  );
}

function LikedPlaceholder() {
  return (
    <div className="px-5">
      <div className="glass-card rounded-2xl p-4 text-center text-sm text-slate-500">
        Liked tracks API 串接還沒做 — 看 <code className="font-mono">/api/feedback/track</code> 已有
        endpoint，但目前沒有列表 endpoint。下一步可加 GET。
      </div>
    </div>
  );
}

function QueueList() {
  const { segment } = useRadio();
  if (!segment || segment.tracks.length === 0) {
    return (
      <div className="px-5">
        <div className="glass-card rounded-2xl p-4 text-center text-sm text-slate-500">
          Start a session to see your AI-curated queue here.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 px-5">
      {segment.tracks.map((t) => (
        <div key={t.spotifyUri} className="flex items-center gap-3 p-2">
          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-slate-200">
            {t.albumImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.albumImageUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-800">{t.title}</div>
            <div className="truncate text-xs text-slate-500">{t.artist}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
