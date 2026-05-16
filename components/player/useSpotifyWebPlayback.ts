'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildRuleBasedDjCue,
  DjScheduler,
  type DjCue,
  type DjSchedulerTrack,
} from '../../lib/dj/scheduler';

type PlaybackStatus =
  | 'loading'
  | 'auth_required'
  | 'ready'
  | 'device_active'
  | 'device_inactive'
  | 'error'
  | 'activating';

type PlayerCommand = 'previous' | 'toggle' | 'next';

type PlayerNotice = {
  message: string;
  tone: 'error' | 'info' | 'success';
};

type UseSpotifyWebPlaybackOptions = {
  djPrefetchTriggerRatio?: number;
  djSchedulerEnabled?: boolean;
};

export type TrackState = {
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

function getTokenErrorMessage(code: string): string {
  if (code === 'SPOTIFY_SESSION_REQUIRED') {
    return '請先登入 Spotify，播放器才能取得播放權限。';
  }

  if (code === 'SPOTIFY_TOKEN_REFRESH_FAILED') {
    return 'Spotify 登入已過期，請重新登入後再試。';
  }

  return '無法取得 Spotify 播放權限，請稍後再試。';
}

function isTokenResponse(body: unknown): body is TokenResponse {
  if (!body || typeof body !== 'object') {
    return false;
  }

  if ('error' in body) {
    const error = (body as { error?: unknown }).error;

    return (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string'
    );
  }

  return typeof (body as { accessToken?: unknown }).accessToken === 'string';
}

async function fetchSpotifyAccessToken(): Promise<TokenResponse> {
  const response = await fetch('/api/auth/spotify/token', { cache: 'no-store' });
  const body = (await response.json()) as unknown;

  if (!isTokenResponse(body)) {
    return {
      error: {
        code: 'SPOTIFY_TOKEN_RESPONSE_INVALID',
        message: 'Spotify token endpoint returned an invalid response.',
      },
    };
  }

  if (!response.ok && !('error' in body)) {
    return {
      error: {
        code: 'SPOTIFY_TOKEN_REQUEST_FAILED',
        message: 'Spotify token endpoint failed.',
      },
    };
  }

  return body;
}

function playAudioElement(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('DJ cue audio playback failed.'));

    audio.play().catch(reject);
  });
}

function speakBrowserText(text: string): Promise<void> {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playBrowserDjCue(cue: DjCue): Promise<void> {
  if (cue.audioUrl) {
    await playAudioElement(new Audio(cue.audioUrl));
    return;
  }

  await speakBrowserText(cue.script);
}

function serializeDjTrack(track: DjSchedulerTrack) {
  return {
    artist: track.artist || 'Unknown artist',
    artistUris: track.artistUris,
    id: track.id,
    title: track.title,
    uri: track.uri,
  };
}

async function prefetchBrowserDjCue(input: {
  currentTrack: DjSchedulerTrack;
  nextTrack: DjSchedulerTrack;
}): Promise<DjCue> {
  const fallbackCue = buildRuleBasedDjCue(input);

  try {
    const response = await fetch('/api/dj/prefetch', {
      body: JSON.stringify({
        hour: new Date().getHours(),
        nextTrack: serializeDjTrack(input.nextTrack),
        prevTrack: serializeDjTrack(input.currentTrack),
        voiceId: 'browser-speech',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      return fallbackCue;
    }

    const body = (await response.json()) as {
      audioUrl?: unknown;
      script?: unknown;
    };

    if (typeof body.script !== 'string' || !body.script.trim()) {
      return fallbackCue;
    }

    return {
      audioUrl: typeof body.audioUrl === 'string' ? body.audioUrl : null,
      script: body.script,
      trackId: input.nextTrack.id,
    };
  } catch {
    return fallbackCue;
  }
}

export function useSpotifyWebPlayback(options: UseSpotifyWebPlaybackOptions = {}) {
  const browserDeviceActivatedRef = useRef(false);
  const djPrefetchTriggerRatioRef = useRef(options.djPrefetchTriggerRatio);
  const djSchedulerEnabledRef = useRef(Boolean(options.djSchedulerEnabled));
  const djSchedulerRef = useRef<DjScheduler | null>(null);
  const mountedRef = useRef(false);
  const playerRef = useRef<SpotifyWebPlaybackPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notice, setNotice] = useState<PlayerNotice | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>('loading');
  const [track, setTrack] = useState<TrackState | null>(null);

  const progressPercent = useMemo(() => {
    if (!track || track.durationMs <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (track.positionMs / track.durationMs) * 100));
  }, [track]);

  useEffect(() => {
    djSchedulerEnabledRef.current = Boolean(options.djSchedulerEnabled);
  }, [options.djSchedulerEnabled]);

  useEffect(() => {
    djPrefetchTriggerRatioRef.current = options.djPrefetchTriggerRatio;
  }, [options.djPrefetchTriggerRatio]);

  const updateNotice = useCallback((nextNotice: PlayerNotice | null) => {
    if (mountedRef.current) {
      setNotice(nextNotice);
    }
  }, []);

  const updateStatus = useCallback((nextStatus: PlaybackStatus) => {
    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const applyPlaybackState = useCallback((state: SpotifyWebPlaybackState | null): boolean => {
    if (!mountedRef.current || !state) {
      return false;
    }

    setTrack(getTrackState(state));
    setIsPlaying(!state.paused);
    browserDeviceActivatedRef.current = true;
    setStatus('ready');
    setNotice(null);

    return true;
  }, []);

  const syncCurrentPlayerState = useCallback(async (): Promise<boolean> => {
    const player = playerRef.current;

    if (!player) {
      return false;
    }

    try {
      return applyPlaybackState(await player.getCurrentState());
    } catch {
      return false;
    }
  }, [applyPlaybackState]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (window.Spotify) {
      setSdkReady(true);
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (mountedRef.current) {
        setSdkReady(true);
      }
    };

    if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => {
      updateStatus('error');
      updateNotice({ message: '無法載入 Spotify Web Playback SDK。', tone: 'error' });
    };
    document.body.appendChild(script);
  }, [updateNotice, updateStatus]);

  useEffect(() => {
    if (!sdkReady || !window.Spotify || playerRef.current) {
      return;
    }

    const player = new window.Spotify.Player({
      getOAuthToken: (callback) => {
        fetchSpotifyAccessToken()
          .then((body) => {
            if (!mountedRef.current) {
              return;
            }

            if ('error' in body) {
              setStatus('auth_required');
              setNotice({ message: getTokenErrorMessage(body.error.code), tone: 'error' });
              return;
            }

            callback(body.accessToken);
          })
          .catch(() => {
            if (!mountedRef.current) {
              return;
            }

            setStatus('error');
            setNotice({ message: '無法連線到 Spotify token endpoint。', tone: 'error' });
          });
      },
      name: 'Spotify AI DJ Web Player',
      volume: 0.75,
    });

    player.addListener('ready', ({ device_id }) => {
      browserDeviceActivatedRef.current = false;
      setDeviceId(device_id);
      setPlayerReady(true);
      setStatus('device_inactive');
      setNotice({
        message: '播放器已就緒。請在 Spotify 裡選擇這個裝置，或按播放後再試。',
        tone: 'info',
      });
    });

    player.addListener('not_ready', () => {
      browserDeviceActivatedRef.current = false;
      setDeviceId(null);
      setPlayerReady(false);
      setStatus('device_inactive');
      setNotice({ message: 'Spotify 播放裝置已離線，請重新整理或重新登入。', tone: 'error' });
    });

    player.addListener('initialization_error', ({ message }) => {
      setStatus('error');
      setNotice({ message: message || 'Spotify Web Playback SDK 初始化失敗。', tone: 'error' });
    });

    player.addListener('authentication_error', ({ message }) => {
      setStatus('auth_required');
      setNotice({ message: message || 'Spotify 認證失敗，請重新登入。', tone: 'error' });
    });

    player.addListener('account_error', ({ message }) => {
      setStatus('error');
      setNotice({
        message: message || 'Spotify Premium 帳號才能使用 Web Playback SDK。',
        tone: 'error',
      });
    });

    player.addListener('playback_error', ({ message }) => {
      setStatus('error');
      setNotice({ message: message || 'Spotify 播放發生錯誤。', tone: 'error' });
    });

    const djScheduler = new DjScheduler({
      isEnabled: () => djSchedulerEnabledRef.current,
      onPlaybackError: () => {
        // DJ cue playback is best-effort; never block Spotify playback.
      },
      onPrefetchError: () => {
        // Missing a cue is acceptable. The next track should keep playing.
      },
      pauseSpotify: () => player.pause(),
      playCue: playBrowserDjCue,
      prefetchCue: prefetchBrowserDjCue,
      prefetchTriggerRatio: djPrefetchTriggerRatioRef.current,
      resumeSpotify: () => player.resume(),
    });

    djSchedulerRef.current = djScheduler;

    player.addListener('player_state_changed', (state) => {
      if (!state) {
        if (browserDeviceActivatedRef.current) {
          setStatus('device_active');
          setNotice({
            message: '瀏覽器播放器已啟動，等待 Spotify 回傳目前曲目。',
            tone: 'success',
          });
          return;
        }

        setStatus('device_inactive');
        setNotice({
          message: '沒有 active playback device。請在 Spotify 中選擇 AI DJ Web Player。',
          tone: 'error',
        });
        return;
      }

      applyPlaybackState(state);
      djScheduler.onStateChange(state);
    });

    playerRef.current = player;

    player.connect().then((connected) => {
      if (!mountedRef.current) {
        return;
      }

      if (!connected) {
        setPlayerReady(false);
        setStatus('error');
        setNotice({ message: '無法連接 Spotify Web Playback SDK。', tone: 'error' });
      }
    });

    return () => {
      djScheduler.dispose();
      djSchedulerRef.current = null;
      player.disconnect();
      playerRef.current = null;
    };
  }, [applyPlaybackState, sdkReady]);

  const activateBrowserDevice = useCallback(async () => {
    if (!deviceId) {
      return;
    }

    setStatus('activating');
    setNotice(null);

    try {
      const response = await fetch('/api/spotify/transfer-playback', {
        body: JSON.stringify({ deviceId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (response.ok) {
        browserDeviceActivatedRef.current = true;
        setStatus('device_active');
        setNotice({
          message: '瀏覽器播放器已設為 active device，現在可以加入 queue 並播放。',
          tone: 'success',
        });
        await syncCurrentPlayerState();
        return;
      }

      setStatus('device_inactive');
      setNotice({
        message: '啟動失敗，請確認 Spotify 帳號已登入且有 Premium。',
        tone: 'error',
      });
    } catch {
      setStatus('device_inactive');
      setNotice({ message: '網路錯誤，請稍後再試。', tone: 'error' });
    }
  }, [deviceId, syncCurrentPlayerState]);

  const runPlayerCommand = useCallback(
    async (command: PlayerCommand) => {
      const player = playerRef.current;

      if (!player) {
        setStatus('error');
        setNotice({ message: 'Spotify player 尚未初始化。', tone: 'error' });
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

        await syncCurrentPlayerState();
      } catch {
        setStatus('error');
        setNotice({
          message: 'Spotify 播放控制失敗，請確認已有 active playback device。',
          tone: 'error',
        });
      }
    },
    [syncCurrentPlayerState],
  );

  // Unlock the SDK's audio element. Must be called inside a user gesture
  // (e.g. button onClick) before the first remote play so the browser
  // doesn't block playback under its autoplay policy.
  const activateElement = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.activateElement();
    } catch {
      /* harmless */
    }
  }, []);

  return {
    activateBrowserDevice,
    activateElement,
    deviceId,
    isPlaying,
    notice,
    playerReady,
    progressPercent,
    runPlayerCommand,
    status,
    track,
  };
}

export type SpotifyPlaybackController = ReturnType<typeof useSpotifyWebPlayback>;
