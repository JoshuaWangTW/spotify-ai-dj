// components/mobile/modals/NowPlayingModal.tsx
'use client';

import { useState } from 'react';

import type { SpotifyPlaybackController } from '../../player/useSpotifyWebPlayback';
import { useRadio } from '../RadioContext';
import {
  IconChevronDown,
  IconHeart,
  IconHeartFilled,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconSpark,
  IconSpeaker,
  IconList,
} from '../icons';

function fmt(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

type Props = {
  onClose: () => void;
  onOpenCommentary?: () => void;
  playback: SpotifyPlaybackController;
};

export default function NowPlayingModal({ onClose, onOpenCommentary, playback }: Props) {
  const {
    activateBrowserDevice,
    deviceId,
    isPlaying,
    notice,
    playerReady,
    progressPercent,
    runPlayerCommand,
    status,
    track,
  } = playback;
  const { errorMessage, segment, ttsEnabled, setTtsEnabled } = useRadio();
  const [liked, setLiked] = useState(false);

  const cover = track?.albumImageUrl ?? segment?.tracks[0]?.albumImageUrl ?? null;
  const title =
    track?.title ??
    segment?.tracks[0]?.title ??
    segment?.plan.segmentTitle ??
    '等待 Spotify 播放狀態';
  const artist =
    track?.artist ??
    segment?.tracks[0]?.artist ??
    (segment ? 'Spotify queue 暫時尚未排入曲目' : '尚未收到曲目資料');
  const noticeTone =
    notice?.tone === 'success'
      ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700'
      : notice?.tone === 'info'
        ? 'border-sky-200/50 bg-sky-50 text-sky-700'
        : 'border-rose-300/50 bg-rose-50 text-rose-700';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{
        background: 'linear-gradient(170deg, #e9f4fa 0%, #dceaf2 60%, #cee0eb 100%)',
        animation: 'np-slide-up 320ms cubic-bezier(0.32, 0.72, 0.24, 1)',
      }}
    >
      <style jsx global>{`
        @keyframes np-slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),44px)] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
          aria-label="Close"
        >
          <IconChevronDown size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-800">Now Playing</span>
        <span style={{ width: 36 }} />
      </div>

      {/* Cover */}
      <div className="flex items-center justify-center px-5 pt-3 pb-5">
        <div
          className="h-[260px] w-[260px] overflow-hidden rounded-[26px] border border-white/70"
          style={{
            boxShadow: '0 14px 40px rgba(70,110,140,0.25), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)' }}
            />
          )}
        </div>
      </div>

      {/* Title + like */}
      <div className="flex items-start gap-4 px-6 pb-1">
        <div className="flex-1 min-w-0">
          <h2 className="m-0 truncate text-[22px] font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-1.5 truncate text-sm text-slate-500">{artist}</p>
          {segment?.plan.segmentTitle ? (
            <p className="mt-1 truncate text-[12px] text-slate-400">{segment.plan.segmentTitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ${liked ? 'text-rose-500' : 'text-slate-500'}`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
        </button>
      </div>

      {/* Progress */}
      <div className="px-6 pt-4">
        <div className="relative h-1 rounded-full bg-slate-300/60">
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #7dd3fc, #0284c7)',
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{
              left: `${progressPercent}%`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(2,132,199,0.5)',
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-slate-400">
          <span>{fmt(track?.positionMs ?? 0)}</span>
          <span>−{fmt(Math.max(0, (track?.durationMs ?? 0) - (track?.positionMs ?? 0)))}</span>
        </div>
      </div>

      {/* Transport — only the commands the Web Playback SDK actually
          supports (prev / toggle / next). Shuffle & Repeat were removed
          because the SDK doesn't expose them and the buttons were dead. */}
      <div className="flex items-center justify-center gap-10 px-6 py-4">
        <button
          type="button"
          onClick={() => void runPlayerCommand('previous')}
          disabled={!playerReady}
          className="flex h-[52px] w-[52px] items-center justify-center text-slate-800 disabled:text-slate-300"
          aria-label="Previous"
        >
          <IconPrev size={28} />
        </button>
        <button
          type="button"
          onClick={() => void runPlayerCommand('toggle')}
          disabled={!playerReady}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/90 text-sky-900 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #e0f2fe, #7dd3fc 60%, #38bdf8)',
            boxShadow: '0 10px 24px rgba(125,211,252,0.5), inset 0 1px 0 rgba(255,255,255,0.7)',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}
        </button>
        <button
          type="button"
          onClick={() => void runPlayerCommand('next')}
          disabled={!playerReady}
          className="flex h-[52px] w-[52px] items-center justify-center text-slate-800 disabled:text-slate-300"
          aria-label="Next"
        >
          <IconNext size={28} />
        </button>
      </div>

      {/* DJ voice toggle — wired to the global ttsEnabled so the user
          can mute the auto-narration any time. */}
      <div className="px-6 pt-1 pb-2">
        <div className="glass-card flex items-center justify-between rounded-2xl px-4 py-2.5">
          <div>
            <div className="text-[13px] font-medium text-slate-800">DJ 語音導聆</div>
            <div className="text-[11px] text-slate-500">每段切換時自動朗讀 DJ 介紹</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ttsEnabled}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="relative h-[26px] w-11 rounded-full transition-colors"
            style={{
              background: ttsEnabled ? 'linear-gradient(135deg, #7dd3fc, #0284c7)' : '#cbd5e1',
            }}
          >
            <span
              className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]"
              style={{ left: ttsEnabled ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            />
          </button>
        </div>
      </div>

      {/* Device + activate button */}
      <div className="px-6 pb-3">
        {status === 'device_inactive' && deviceId ? (
          <button
            type="button"
            onClick={() => void activateBrowserDevice()}
            className="aqua-button flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
          >
            <IconSpeaker size={18} />
            啟動瀏覽器播放
          </button>
        ) : (
          <button
            type="button"
            className="glass-card flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm text-slate-600"
          >
            <IconSpeaker size={18} />
            <span className="font-medium">
              {status === 'device_active' || status === 'ready'
                ? 'AI DJ Web Player'
                : 'No active device'}
            </span>
          </button>
        )}
      </div>

      {notice ? (
        <div className="px-6 pb-2">
          <div className={`rounded-md border px-3 py-2 text-xs leading-5 ${noticeTone}`}>
            {notice.message}
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="px-6 pb-2">
          <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {errorMessage}
          </div>
        </div>
      ) : null}

      {/* AI Commentary + Up Next entry */}
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <button
          type="button"
          onClick={onOpenCommentary}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-semibold text-sky-900"
          style={{
            background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 3px 10px rgba(125,211,252,0.3)',
          }}
        >
          <IconSpark size={16} /> AI Commentary
        </button>
        <button
          type="button"
          onClick={() => void runPlayerCommand('next')}
          disabled={!playerReady}
          className="glass-card flex items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-semibold text-sky-900 disabled:opacity-50"
        >
          <IconList size={16} /> 下一首
        </button>
      </div>

      {/* Up Next preview from segment */}
      {segment && segment.tracks.length > 1 ? (
        <div className="px-5 pb-10">
          <div className="glass-card rounded-2xl p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Up Next
              </div>
              <span className="text-[11px] text-slate-400">{segment.tracks.length - 1} 首</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {segment.tracks.slice(1, 4).map((t) => (
                <div key={t.spotifyUri} className="flex items-center gap-3">
                  <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[10px] bg-slate-200">
                    {t.albumImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.albumImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-slate-800">
                      {t.title}
                    </div>
                    <div className="truncate text-xs text-slate-500">{t.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
