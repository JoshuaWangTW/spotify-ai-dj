// components/mobile/RadioContext.tsx
// Centralises radio session state. Wraps the existing /api/radio/* endpoints
// from your repo so the mobile UI can start, tick, and stop sessions without
// duplicating logic.
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readStoredLlmSelection } from '../llm/useLlmModelPreference';
import { speakBrowserText, stopBrowserSpeech } from '../player/browserSpeech';
import {
  DEFAULT_OPENAI_TTS_VOICE,
  openAiTtsVoiceSchema,
  type OpenAiTtsVoice,
} from '../../lib/ai-dj/tts-schema';
import type {
  AiDjMode,
  RadioSegmentResponse,
  RadioStartOutput,
  RadioStopOutput,
  RadioTickOutput,
} from '../../lib/radio/schema';

type ApiError = { error?: { code?: string; message?: string } };
function isApiError(b: unknown): b is ApiError {
  return typeof b === 'object' && b !== null && 'error' in b;
}
function apiErrorMessage(b: unknown, fallback: string): string {
  return (b as ApiError)?.error?.message ?? fallback;
}
async function readJson<T>(r: Response, fb: string): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch {
    throw new Error(fb);
  }
}

type Session = RadioStartOutput['session'];

export type RadioContextValue = {
  // State
  session: Session | null;
  segment: RadioSegmentResponse | null;
  /** transient UI state */
  isStarting: boolean;
  isTicking: boolean;
  isStopping: boolean;
  errorMessage: string | null;
  /** Suggested prompt drafted by the Music Assistant. Auto-populates the
   *  Start sheet when set. */
  draftPrompt: string;
  setDraftPrompt: (p: string) => void;
  /** Whether the DJ intro is read aloud automatically after each
   *  successful start/tick. Persisted in localStorage. */
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;
  ttsVoice: OpenAiTtsVoice;
  setTtsVoice: (voice: OpenAiTtsVoice) => void;
  /** Register the current Web Playback SDK device id so /api/radio/*
   *  can start playback on the browser player directly. */
  setActiveDeviceId: (id: string | null) => void;
  /** Register a function that unlocks the Web Playback SDK audio element
   *  (must be called from a user gesture). RadioContext invokes it at the
   *  start of every startSession() call. */
  setPlayerActivator: (fn: (() => Promise<void>) | null) => void;
  // Actions
  startSession: (args: {
    prompt: string;
    mode: AiDjMode;
    autoplayQueue?: boolean;
  }) => Promise<RadioStartOutput | null>;
  tickSession: () => Promise<RadioTickOutput | null>;
  stopSession: () => Promise<RadioStopOutput | null>;
  clearError: () => void;
};

const TTS_ENABLED_STORAGE_KEY = 'spotify-ai-dj:tts-enabled';
const TTS_VOICE_STORAGE_KEY = 'spotify-ai-dj:tts-voice';

function readStoredTtsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(TTS_ENABLED_STORAGE_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

function persistTtsEnabled(v: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TTS_ENABLED_STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function readStoredTtsVoice(): OpenAiTtsVoice {
  if (typeof window === 'undefined') return DEFAULT_OPENAI_TTS_VOICE;
  try {
    const parsed = openAiTtsVoiceSchema.safeParse(
      window.localStorage.getItem(TTS_VOICE_STORAGE_KEY),
    );

    return parsed.success ? parsed.data : DEFAULT_OPENAI_TTS_VOICE;
  } catch {
    return DEFAULT_OPENAI_TTS_VOICE;
  }
}

function persistTtsVoice(voice: OpenAiTtsVoice) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TTS_VOICE_STORAGE_KEY, voice);
  } catch {
    /* ignore */
  }
}

const RadioContext = createContext<RadioContextValue | null>(null);

export function useRadio(): RadioContextValue {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside <RadioProvider>');
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
};

export function RadioProvider({ children }: ProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [segment, setSegment] = useState<RadioSegmentResponse | null>(null);
  const [isStarting, setStarting] = useState(false);
  const [isTicking, setTicking] = useState(false);
  const [isStopping, setStopping] = useState(false);
  const [errorMessage, setError] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [ttsEnabled, setTtsEnabledState] = useState<boolean>(true);
  const [ttsVoice, setTtsVoiceState] = useState<OpenAiTtsVoice>(DEFAULT_OPENAI_TTS_VOICE);

  // Latest session id without re-creating callbacks
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.id ?? null;

  // Latest Web Playback SDK device id (set by MobileShell when SDK ready)
  const deviceIdRef = useRef<string | null>(null);
  const setActiveDeviceId = useCallback((id: string | null) => {
    deviceIdRef.current = id;
  }, []);

  // SDK audio-element activator registered by MobileShell.
  const playerActivatorRef = useRef<(() => Promise<void>) | null>(null);
  const setPlayerActivator = useCallback((fn: (() => Promise<void>) | null) => {
    playerActivatorRef.current = fn;
  }, []);

  // Wait up to `timeoutMs` for the SDK to register a deviceId.
  async function waitForDeviceId(timeoutMs: number): Promise<string | null> {
    if (deviceIdRef.current) return deviceIdRef.current;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      if (deviceIdRef.current) return deviceIdRef.current;
    }
    return deviceIdRef.current;
  }

  // TTS state — keep a ref so the callback always reads the latest value
  const ttsEnabledRef = useRef<boolean>(true);
  const ttsVoiceRef = useRef<OpenAiTtsVoice>(DEFAULT_OPENAI_TTS_VOICE);
  const djIntroAudioRef = useRef<HTMLAudioElement | null>(null);
  const djIntroAudioUrlRef = useRef<string | null>(null);

  // Hydrate the toggle from localStorage on mount (avoid SSR mismatch).
  useEffect(() => {
    const stored = readStoredTtsEnabled();
    const storedVoice = readStoredTtsVoice();
    setTtsEnabledState(stored);
    setTtsVoiceState(storedVoice);
    ttsEnabledRef.current = stored;
    ttsVoiceRef.current = storedVoice;
  }, []);

  const setTtsEnabled = useCallback((v: boolean) => {
    setTtsEnabledState(v);
    ttsEnabledRef.current = v;
    persistTtsEnabled(v);
    if (!v && djIntroAudioRef.current) {
      djIntroAudioRef.current.pause();
      djIntroAudioRef.current = null;
      if (djIntroAudioUrlRef.current) {
        URL.revokeObjectURL(djIntroAudioUrlRef.current);
        djIntroAudioUrlRef.current = null;
      }
    }
    if (!v) {
      stopBrowserSpeech();
    }
  }, []);

  const setTtsVoice = useCallback((voice: OpenAiTtsVoice) => {
    setTtsVoiceState(voice);
    ttsVoiceRef.current = voice;
    persistTtsVoice(voice);
  }, []);

  useEffect(
    () => () => {
      if (djIntroAudioRef.current) {
        djIntroAudioRef.current.pause();
        djIntroAudioRef.current = null;
      }
      if (djIntroAudioUrlRef.current) {
        URL.revokeObjectURL(djIntroAudioUrlRef.current);
        djIntroAudioUrlRef.current = null;
      }
      stopBrowserSpeech();
    },
    [],
  );

  const playDjIntroTts = useCallback(async (text: string) => {
    if (!ttsEnabledRef.current || !text || typeof window === 'undefined') return;

    if (djIntroAudioRef.current) {
      djIntroAudioRef.current.pause();
      djIntroAudioRef.current = null;
    }
    if (djIntroAudioUrlRef.current) {
      URL.revokeObjectURL(djIntroAudioUrlRef.current);
      djIntroAudioUrlRef.current = null;
    }

    try {
      const response = await fetch('/api/ai-dj/commentary/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: ttsVoiceRef.current }),
      });
      if (response.status === 204) {
        await speakBrowserText(text);
        return;
      }

      if (!response.ok) {
        await speakBrowserText(text);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      djIntroAudioRef.current = audio;
      djIntroAudioUrlRef.current = url;

      const cleanup = () => {
        if (djIntroAudioRef.current === audio) {
          djIntroAudioRef.current = null;
        }
        if (djIntroAudioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          djIntroAudioUrlRef.current = null;
        }
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch {
      /* TTS is best-effort */
    }
  }, []);

  const startSession = useCallback(
    async ({
      prompt,
      mode,
      autoplayQueue = true,
    }: {
      prompt: string;
      mode: AiDjMode;
      autoplayQueue?: boolean;
    }) => {
      const trimmed = prompt.trim();
      if (!trimmed) return null;
      setStarting(true);
      setError(null);

      // 1. Unlock the SDK audio element while we still have the user
      //    gesture from the Start Session click. Browser autoplay policies
      //    require this for the first remote play.
      try {
        await playerActivatorRef.current?.();
      } catch {
        /* non-fatal */
      }

      // 2. Make sure we actually have a browser deviceId to play on.
      //    Without it, /api/radio/start falls back to the queue endpoint
      //    which silently fails to start playback. Wait up to 3s for SDK.
      const deviceId = await waitForDeviceId(3000);
      if (!deviceId) {
        setError('瀏覽器播放器尚未就緒，請等 1–2 秒再試一次。');
        setStarting(false);
        return null;
      }

      try {
        const llmSelection = readStoredLlmSelection();
        const r = await fetch('/api/radio/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autoplayQueue,
            clientTimeIso: new Date().toISOString(),
            deviceId,
            llmModel: llmSelection.llmModel,
            llmProvider: llmSelection.llmProvider,
            mode,
            prompt: trimmed,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        const body = await readJson<RadioStartOutput | ApiError>(r, 'Radio start 回傳格式錯誤。');
        if (!r.ok || isApiError(body)) {
          throw new Error(apiErrorMessage(body, 'Radio session 建立失敗。'));
        }
        if (body.segment.tracks.length === 0) {
          setError(body.queueWarning?.message ?? 'Spotify 沒有找到可播放的曲目，請稍後再試。');
          return null;
        }
        setSession(body.session);
        setSegment(body.segment);
        setError(body.queueWarning?.message ?? null);

        // Fire-and-forget DJ intro narration.
        if (body.segment.plan.djIntro) {
          void playDjIntroTts(body.segment.plan.djIntro);
        }

        return body;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Radio session 建立失敗。');
        return null;
      } finally {
        setStarting(false);
      }
    },
    [playDjIntroTts],
  );

  const tickSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return null;
    setTicking(true);
    setError(null);
    try {
      const llmSelection = readStoredLlmSelection();
      const r = await fetch('/api/radio/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoplayQueue: true,
          clientTimeIso: new Date().toISOString(),
          deviceId: deviceIdRef.current ?? undefined,
          feedback: [],
          llmModel: llmSelection.llmModel,
          llmProvider: llmSelection.llmProvider,
          sessionId: id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await readJson<RadioTickOutput | ApiError>(r, 'Radio tick 回傳格式錯誤。');
      if (!r.ok || isApiError(body)) {
        throw new Error(apiErrorMessage(body, 'Radio tick 失敗。'));
      }
      if (body.segment.tracks.length === 0) {
        setError(body.queueWarning?.message ?? 'Spotify 暫時無法排入下一段曲目，將自動重試。');
        return null;
      }
      setSession((cur) => (cur ? { ...cur, mode: body.session.mode } : cur));
      setSegment(body.segment);
      setError(body.queueWarning?.message ?? null);

      // Speak the new segment's DJ intro between mixes.
      if (body.segment.plan.djIntro) {
        void playDjIntroTts(body.segment.plan.djIntro);
      }

      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio tick 失敗。');
      return null;
    } finally {
      setTicking(false);
    }
  }, [playDjIntroTts]);

  const stopSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id) return null;
    setStopping(true);
    setError(null);
    try {
      const r = await fetch('/api/radio/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      });
      const body = await readJson<RadioStopOutput | ApiError>(r, 'Radio stop 回傳格式錯誤。');
      if (!r.ok || isApiError(body)) {
        throw new Error(apiErrorMessage(body, 'Radio stop 失敗。'));
      }
      setSession((cur) => (cur ? { ...cur, status: body.session.status } : cur));
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio stop 失敗。');
      return null;
    } finally {
      setStopping(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<RadioContextValue>(
    () => ({
      session,
      segment,
      isStarting,
      isTicking,
      isStopping,
      errorMessage,
      draftPrompt,
      setDraftPrompt,
      ttsEnabled,
      setTtsEnabled,
      ttsVoice,
      setTtsVoice,
      setActiveDeviceId,
      setPlayerActivator,
      startSession,
      tickSession,
      stopSession,
      clearError,
    }),
    [
      session,
      segment,
      isStarting,
      isTicking,
      isStopping,
      errorMessage,
      draftPrompt,
      ttsEnabled,
      setTtsEnabled,
      ttsVoice,
      setTtsVoice,
      setActiveDeviceId,
      setPlayerActivator,
      startSession,
      tickSession,
      stopSession,
      clearError,
    ],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}
