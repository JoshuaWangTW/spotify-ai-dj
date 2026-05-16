// components/mobile/MiniPlayer.tsx
// Shows the currently-playing Spotify track when one is available.
// Falls back to the first track of the active radio segment if the SDK
// hasn't reported a player_state_changed event yet.
'use client';

import { useRadio } from './RadioContext';
import { IconPlay, IconPause } from './icons';
import type { TrackState } from '../player/useSpotifyWebPlayback';

type Props = {
  /** Real playback track from useSpotifyWebPlayback (null when player isn't active) */
  track: TrackState | null;
  playing: boolean;
  onTogglePlay: () => void;
  onExpand: () => void;
};

export default function MiniPlayer({ track, playing, onTogglePlay, onExpand }: Props) {
  const { segment } = useRadio();

  // Pick what to show: real SDK track first, otherwise the lead track of the
  // current segment, otherwise nothing.
  const display = track
    ? {
        title: track.title,
        artist: track.artist,
        cover: track.albumImageUrl ?? null,
      }
    : segment?.tracks[0]
      ? {
          title: segment.tracks[0].title,
          artist: segment.tracks[0].artist,
          cover: segment.tracks[0].albumImageUrl ?? null,
        }
      : null;

  if (!display) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-3 bottom-[88px] z-20 mx-auto max-w-md sm:bottom-[92px]">
      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onExpand();
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/95 p-2 pl-2 text-left backdrop-blur-xl"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.95), rgba(225,239,247,0.85))',
          boxShadow: '0 8px 28px rgba(100,116,139,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
        }}
      >
        <div className="h-[42px] w-[42px] flex-shrink-0 overflow-hidden rounded-[10px]">
          {display.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={display.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-slate-800">{display.title}</div>
          <div className="flex items-center gap-1.5">
            <MiniEq playing={playing} />
            <span className="truncate text-[11.5px] text-slate-500">{display.artist}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sky-900"
          style={{
            background: 'linear-gradient(135deg, #e0f2fe, #7dd3fc)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 6px rgba(125,211,252,0.3)',
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
      </div>
    </div>
  );
}

function MiniEq({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-3.5 items-end gap-[2px]">
      {[0, 0.15, 0.3].map((d, i) => (
        <span
          key={i}
          className={playing ? 'mp-eq-bar' : ''}
          style={{
            width: 2.5,
            height: 5,
            background: '#0284c7',
            borderRadius: 1,
            animationDelay: `-${d}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes mp-eq {
          0%,
          100% {
            height: 5px;
          }
          50% {
            height: 14px;
          }
        }
        .mp-eq-bar {
          animation: mp-eq 0.9s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
