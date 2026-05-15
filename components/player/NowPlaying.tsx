'use client';

import DJCommentaryCard from '../dj/DJCommentaryCard';
import { useSpotifyWebPlayback } from './useSpotifyWebPlayback';

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSpotifyWebUrl(uri: string): string | null {
  const [, type, id] = uri.split(':');

  if (!type || !id) {
    return null;
  }

  return `https://open.spotify.com/${type}/${id}`;
}

type NowPlayingProps = {
  djMode?: string;
};

export default function NowPlaying({ djMode = 'jazz_intro' }: NowPlayingProps) {
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
  } = useSpotifyWebPlayback();
  const spotifyTrackUrl = track ? getSpotifyWebUrl(track.trackUri) : null;
  const noticeClassName =
    notice?.tone === 'success'
      ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700'
      : notice?.tone === 'info'
        ? 'border-sky-200/50 bg-sky-50 text-sky-700'
        : 'border-rose-300/50 bg-rose-50 text-rose-700';

  return (
    <section className="glass-panel min-h-[620px] rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Now Playing</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Spotify Web Playback SDK player.</p>
        </div>
        <span className="rounded-md border border-sky-200/50 bg-sky-100/70 px-2.5 py-1 text-xs font-medium text-sky-700">
          {status === 'ready' ? 'Live' : 'Setup'}
        </span>
      </div>

      <div className="glass-card mt-6 rounded-lg p-5">
        <div className="flex gap-4">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-100/60 bg-white/30">
            {track?.albumImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${track.album} album art`}
                className="h-full w-full object-cover opacity-95"
                src={track.albumImageUrl}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(186,230,253,0.5)_0%,rgba(224,242,254,0.7)_42%,rgba(241,245,249,0.8)_100%)] text-xs text-slate-500">
                AI DJ
              </div>
            )}
            {isPlaying ? (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-1">
                <div className="sound-wave scale-50 rounded-full border border-slate-200/60 bg-white/60 px-3 py-2 backdrop-blur-md">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              正在播放
            </p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-800">
              {track?.title ?? '等待 Spotify 播放狀態'}
            </p>
            <p className="truncate text-sm text-slate-500">{track?.artist ?? '尚未收到曲目資料'}</p>
            <p className="truncate text-xs text-slate-400">
              {track?.album ?? 'Spotify Premium required'}
            </p>
            {spotifyTrackUrl ? (
              <a
                className="aqua-link mt-1 inline-flex text-xs font-medium"
                href={spotifyTrackUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open in Spotify
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-sky-100/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 via-sky-400 to-cyan-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-slate-400">
            <span>{formatDuration(track?.positionMs ?? 0)}</span>
            <span>{formatDuration(track?.durationMs ?? 0)}</span>
          </div>
        </div>

        {status === 'device_inactive' && deviceId ? (
          <button
            className="aqua-button mt-5 w-full rounded-md px-4 py-3 text-sm font-semibold"
            onClick={() => void activateBrowserDevice()}
            type="button"
          >
            啟動瀏覽器播放
          </button>
        ) : null}

        {status === 'activating' ? (
          <div className="mt-5 rounded-md border border-sky-200/50 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            正在啟動瀏覽器播放器...
          </div>
        ) : null}

        {notice ? (
          <div className={`mt-5 rounded-md border px-3 py-2 text-sm leading-6 ${noticeClassName}`}>
            {notice.message}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            className="glass-control rounded-md px-3 py-3 text-sm text-slate-700 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerReady}
            onClick={() => void runPlayerCommand('previous')}
            type="button"
          >
            上一首
          </button>
          <button
            className="aqua-button rounded-md px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerReady}
            onClick={() => void runPlayerCommand('toggle')}
            type="button"
          >
            {isPlaying ? '暫停' : '播放'}
          </button>
          <button
            className="glass-control rounded-md px-3 py-3 text-sm text-slate-700 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerReady}
            onClick={() => void runPlayerCommand('next')}
            type="button"
          >
            下一首
          </button>
        </div>

        {track ? (
          <DJCommentaryCard
            key={track.trackUri}
            artistName={track.artist}
            mode={djMode}
            trackName={track.title}
          />
        ) : null}

        {deviceId ? (
          <p className="mt-4 break-all text-xs leading-5 text-slate-500">Device ID: {deviceId}</p>
        ) : null}
      </div>
    </section>
  );
}
