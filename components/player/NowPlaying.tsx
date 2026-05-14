'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type PlaybackStatus = 'loading' | 'auth_required' | 'ready' | 'device_inactive' | 'error';

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

export default function NowPlaying() {
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
    <section className="glass-panel min-h-[620px] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">Now Playing</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Spotify Web Playback SDK player.</p>
        </div>
        <span className="rounded-md bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">
          {status === 'ready' ? 'Live' : 'Setup'}
        </span>
      </div>

      <div className="glass-card mt-6 rounded-lg p-5">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white/60">
          {track?.albumImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${track.album} album art`}
              className="h-full w-full object-cover"
              src={track.albumImageUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#c3eaf2_0%,#aee0ec_36%,#f4fafb_36%,#eaf4f7_100%)] text-sm text-slate-500">
              Spotify
            </div>
          )}
        </div>

        {isPlaying ? <div className="wave-dance mt-4" /> : null}

        <div className="mt-5 min-h-[120px]">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">正在播放</p>
          <p className="mt-2 text-2xl font-semibold text-slate-700">
            {track?.title ?? '等待 Spotify 播放狀態'}
          </p>
          <p className="mt-1 text-slate-500">{track?.artist ?? '尚未收到曲目資料'}</p>
          <p className="text-sm text-slate-500">{track?.album ?? 'Spotify Premium required'}</p>
          {spotifyTrackUrl ? (
            <a
              className="mt-3 inline-flex text-xs font-medium text-cyan-700 hover:text-cyan-600"
              href={spotifyTrackUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open in Spotify
            </a>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-cyan-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-slate-500">
            <span>{formatDuration(track?.positionMs ?? 0)}</span>
            <span>{formatDuration(track?.durationMs ?? 0)}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-100/80 px-3 py-2 text-sm leading-6 text-amber-800">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            className="liquid-control rounded-md px-3 py-3 text-sm hover:border-cyan-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
            onClick={() => void runPlayerCommand('previous')}
            type="button"
          >
            上一首
          </button>
          <button
            className="rounded-md bg-cyan-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
            onClick={() => void runPlayerCommand('toggle')}
            type="button"
          >
            {isPlaying ? '暫停' : '播放'}
          </button>
          <button
            className="liquid-control rounded-md px-3 py-3 text-sm hover:border-cyan-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!playerRef.current}
            onClick={() => void runPlayerCommand('next')}
            type="button"
          >
            下一首
          </button>
        </div>

        {deviceId ? (
          <p className="mt-4 break-all text-xs leading-5 text-slate-500">Device ID: {deviceId}</p>
        ) : null}
      </div>
    </section>
  );
}
