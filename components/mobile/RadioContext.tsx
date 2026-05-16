// components/mobile/RadioContext.tsx
// Centralises radio session state. Wraps the existing /api/radio/* endpoints
// from your repo so the mobile UI can start, tick, and stop sessions without
// duplicating logic.
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { readStoredLlmSelection } from '../llm/useLlmModelPreference';
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

  // Latest session id without re-creating callbacks
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.id ?? null;

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
      try {
        const llmSelection = readStoredLlmSelection();
        const r = await fetch('/api/radio/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autoplayQueue,
            clientTimeIso: new Date().toISOString(),
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
        // If Spotify returned no tracks (e.g. rate-limited), treat as a
        // failed start so the caller does NOT open NowPlayingModal.
        if (body.segment.tracks.length === 0) {
          setError(body.queueWarning?.message ?? 'Spotify 沒有找到可播放的曲目，請稍後再試。');
          return null;
        }
        setSession(body.session);
        setSegment(body.segment);
        setError(body.queueWarning?.message ?? null);
        return body;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Radio session 建立失敗。');
        return null;
      } finally {
        setStarting(false);
      }
    },
    [],
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
      // If tick returned no tracks, keep the current segment and warn.
      // Don't replace segment with an empty one — existing queue keeps playing.
      if (body.segment.tracks.length === 0) {
        setError(body.queueWarning?.message ?? 'Spotify 暫時無法排入下一段曲目，將自動重試。');
        return null;
      }
      setSession((cur) => (cur ? { ...cur, mode: body.session.mode } : cur));
      setSegment(body.segment);
      setError(body.queueWarning?.message ?? null);
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio tick 失敗。');
      return null;
    } finally {
      setTicking(false);
    }
  }, []);

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
      startSession,
      tickSession,
      stopSession,
      clearError,
    ],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}
