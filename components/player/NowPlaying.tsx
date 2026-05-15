'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import DJCommentaryCard from '../dj/DJCommentaryCard';

type PlaybackStatus = 'loading' | 'auth_required' | 'ready' | 'device_inactive' | 'error' | 'activating';

type TrackState = {
  album: string;
  albumImageUrl?: string;
  artist: string;
  durationMs: number;
  positionMs: number;
  title: string;
  trackUri: string;
};

type TokenResponse =
  | {
      accessToken: string;
      expiresAt: number;
      tokenType: string;
    }
  | {
      error: {
        code: string;
        message: string;
      };
    };

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTrackState(state: SpotifyWebPlaybackState): TrackState {
  const track = state.track_window.current_track;

  return {
    album: track.album.name,
    albumImageUrl: track.album.images[0]?.url,
    artist: track.artists.map((artist) => artist.name).join(', '),
    durationMs: state.duration,
    positionMs: state.position,
    title: track.name,
    trackUri: track.uri,
  };
}

function getSpotifyWebUrl(uri: string): string | null {
  const [, type, id] = uri.split(':');

  if (!type || !id) {
    return null;
  }

  return `https://open.spotify.com/${type}/${id}`;
}

function getErrorMessage(code: string): string {
  if (code === 'SPOTIFY_SESSION_REQUIRED') {
    return '請先登入 Spotify，播放器才能取得播放權限。';
  }

  if (code === 'SPOTIFY_TOKEN_REFRESH_FAILED') {
    return 'Spotify 登入已過期，請重新登入後再試。';
  }

  return '無法取得 Spotify 播放權限，請稍後再試。';
}

type NowPlayingProps = {
  djMode?: string;
};

export default function NowPlaying({ djMode = 'jazz_intro' }: NowPlayingProps) {
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>('loading');
  const [track, setTrack] = useState<TrackState | null>(null);

  const progressPercent = useMemo(() => {
    if (!track || track.durationMs <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (track.positionMs / track.durationMs) * 100));
  }, [track]);

  const spotifyTrackUrl = track ? getSpotifyWebUrl(track.trackUri) : null;

  useEffect(() => {
    if (window.Spotify) {
      setSdkReady(true);
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => setSdkReady(true);

    if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => {
      setStatus('error');
      setErrorMessage('無法載入 Spotify Web Playback SDK。');
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkReady || !window.Spotify || playerRef.current) {
      return;
    }

    const player = new window.Spotify.Player({
      getOAuthToken: (callback) => {
        fetch('/api/auth/spotify/token', { cache: 'no-store' })
          .then(async (response) => {
            const body = (await response.json()) as TokenResponse;

            if (!response.ok || 'error' in body) {
              setStatus('auth_required');
              setErrorMessage(
                'error' in body ? getErrorMessage(body.error.code) : '請先登入 Spotify。',
              );
              return;
            }

            callback(body.accessToken);
          })
          .catch(() => {
            setStatus('error');
            setErrorMessage('無法連線到 Spotify token endpoint。');
          });
      },
      name: 'Spotify AI DJ Web Player',
      volume: 0.75,
    });

    player.addListener('ready', ({ device_id }) => {
      setDeviceId(device_id);
      setStatus('device_inactive');
      setErrorMessage('播放器已就緒。請在 Spotify 裡選擇這個裝置，或按播放後再試。');
    });

    player.addListener('not_ready', () => {
      setDeviceId(null);
      setStatus('device_inactive');
      setErrorMessage('Spotify 播放裝置已離線，請重新整理或重新登入。');
    });

    player.addListener('initialization_error', ({ message }) => {
      setStatus('error');
      setErrorMessage(message || 'Spotify Web Playback SDK 初始化失敗。');
    });

    player.addListener('authentication_error', ({ message }) => {
      setStatus('auth_required');
      setErrorMessage(message || 'Spotify 認證失敗，請重新登入。');
    });

    player.addListener('account_error', ({ message }) => {
      setStatus('error');
      setErrorMessage(message || 'Spotify Premium 帳號才能使用 Web Playback SDK。');
    });

    player.addListener('playback_error', ({ message }) => {
      setStatus('error');
      setErrorMessage(message || 'Spotify 播放發生錯誤。');
    });

    player.addListener('player_state_changed', (state) => {
      if (!state) {
        setStatus('device_inactive');
        setErrorMessage('沒有 active playback device。請在 Spotify 中選擇 AI DJ Web Player。');
        return;
      }

      setTrack(getTrackState(state));
      setIsPlaying(!state.paused);
      setStatus('ready');
      setErrorMessage(null);
    });

    playerRef.current = player;

    player.connect().then((connected) => {
      if (!connected) {
        setStatus('error');
        setErrorMessage('無法連接 Spotify Web Playback SDK。');
      }
    });

    return () => {
      player.disconnect();
      playerRef.current = null;
    };
  }, [sdkReady]);

  async function activateBrowserDevice() {
    if (!deviceId) return;
    setStatus('activating');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/spotify/transfer-playback', {
        body: JSON.stringify({ deviceId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        setStatus('device_inactive');
        setErrorMessage('啟動失敗，請確認 Spotify 帳號已登入且有 Premium。');
      } else {
        setStatus('device_inactive');
        setErrorMessage('瀏覽器播放器已設為 active device！現在可以加入 queue 並播放。');
      }
    } catch {
      setStatus('device_inactive');
      setErrorMessage('網路錯誤，請稍後再試。');
    }
  }

  async function runPlayerCommand(command: 'previous' | 'toggle' | 'next') {
    const player = playerRef.current;

    if (!player) {
      setStatus('error');
      setErrorMessage('Spotify player 尚未初始化。');
      return;
    }

    try {
      await player.activateElement();

      if (command === 'previous') {
        await player.previousTrack();
      } else if (command === 'next') {
        await player.nextTrack();
      } else {
        await player.togglePlay();
      }
    } catch {
      setStatus('error');
      setErrorMessage('Spotify 播放控制失敗，請確認已有 active playback device。');
    }
  }

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
        {/* 水平排列：小專輯圖 + 曲目資訊 */}
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
                  <span /><span /><span /><span /><span />
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">正在播放</p>
            <p className="mt-1 truncate text-lg font-semibold text-slate-800">
              {track?.title ?? '等待 Spotify 播放狀態'}
            </p>
            <p className="truncate text-sm text-slate-500">{track?.artist ?? '尚未收到曲目資料'}</p>
            <p className="truncate text-xs text-slate-400">{track?.album ?? 'Spotify Premium required'}</p>
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

        {errorMessage ? (
          <div className={`mt-5 rounded-md border px-3 py-2 text-sm leading-6 ${
            errorMessage.includes('已設為')
              ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700'
              : 'border-rose-300/50 bg-rose-50 text-rose-700'
          }`}>
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            className="glass-control rounded-md px-3 py-3 text-sm text-slate-700 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
            onClick={() => void runPlayerCommand('previous')}
            type="button"
          >
            上一首
          </button>
          <button
            className="aqua-button rounded-md px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
            onClick={() => void runPlayerCommand('toggle')}
            type="button"
          >
            {isPlaying ? '暫停' : '播放'}
          </button>
          <button
            className="glass-control rounded-md px-3 py-3 text-sm text-slate-700 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
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
