'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AiDjMode,
  RadioSegmentResponse,
  RadioStartOutput,
  RadioTickOutput,
  RadioStopOutput,
} from '../../lib/radio/schema';
import type { SpotifyTrackCandidate } from '../../lib/spotify-types';
import LlmModelPicker from '../llm/LlmModelPicker';
import { readStoredLlmSelection } from '../llm/useLlmModelPreference';
import { speakBrowserText, stopBrowserSpeech } from '../player/browserSpeech';
import NowPlaying from '../player/NowPlaying';
import QueueList from '../queue/QueueList';

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type QueueStatus = 'idle' | 'adding' | 'added' | 'error';
type FeedbackStatus = 'idle' | 'saving' | 'saved' | 'error';
type FeedbackType = 'like' | 'dislike' | 'too_loud' | 'no_vocals' | 'work_focus' | 'more_detail';

type PendingFeedback = {
  feedbackType: FeedbackType;
  spotifyTrackId: string;
  trackName: string;
};

const modeOptions: Array<{ label: string; value: AiDjMode }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'Jazz', value: 'jazz_intro' },
  { label: 'Classical', value: 'classical_intro' },
  { label: 'Focus', value: 'work_focus' },
  { label: 'Coffee', value: 'coffee_roasting' },
  { label: 'Store', value: 'dinner_store_background' },
];

const AUTO_TICK_INTERVAL_MS = 30_000;
const AUTO_TICK_QUEUE_THRESHOLD = 1;
const ASSISTANT_RADIO_PROMPT_EVENT = 'music-assistant:radio-prompt';

type AssistantRadioPromptEventDetail = {
  autoStart?: boolean;
  prompt: string;
};

type DjIntroAudioState = {
  audio: HTMLAudioElement;
  objectUrl: string;
};

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body;
}

function getApiErrorMessage(body: unknown, fallback: string): string {
  const parsed = body as ApiError;

  return parsed.error?.message ?? fallback;
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function buildQueueStatus(segment: RadioSegmentResponse): Record<string, QueueStatus> {
  const queued = new Set(segment.queuedTrackUris);

  return Object.fromEntries(
    segment.tracks.map((track) => [
      track.spotifyUri,
      queued.has(track.spotifyUri) ? 'added' : 'idle',
    ]),
  );
}

export default function RadioConsole() {
  const autoTickStateRef = useRef({
    autoplayQueue: true,
    pendingFeedback: [] as PendingFeedback[],
    segmentTrackCount: 0,
    sessionId: null as string | null,
    sessionStatus: null as RadioStartOutput['session']['status'] | null,
  });
  const autoTickInFlightRef = useRef(false);
  const djIntroAudioRef = useRef<DjIntroAudioState | null>(null);
  const ttsEnabledRef = useRef(true);
  const [autoplayQueue, setAutoplayQueue] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackStatusByKey, setFeedbackStatusByKey] = useState<Record<string, FeedbackStatus>>(
    {},
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isTicking, setIsTicking] = useState(false);
  const [mode, setMode] = useState<AiDjMode>('auto');
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback[]>([]);
  const [prompt, setPrompt] = useState('今晚想聽爵士，像電台一樣慢慢接，不要太吵。');
  const [queueStatusByUri, setQueueStatusByUri] = useState<Record<string, QueueStatus>>({});
  const [segment, setSegment] = useState<RadioSegmentResponse | null>(null);
  const [session, setSession] = useState<RadioStartOutput['session'] | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrackCandidate[]>([]);

  const isBusy = isStarting || isTicking || isStopping;
  const currentMode = segment?.plan.mode ?? session?.mode ?? 'jazz_intro';

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  const stopDjIntroTts = useCallback(() => {
    const current = djIntroAudioRef.current;

    if (!current) {
      return;
    }

    current.audio.pause();
    current.audio.onended = null;
    current.audio.onerror = null;
    URL.revokeObjectURL(current.objectUrl);
    djIntroAudioRef.current = null;
    stopBrowserSpeech();
  }, []);

  useEffect(() => stopDjIntroTts, [stopDjIntroTts]);

  const playDjIntroTts = useCallback(
    async (text: string) => {
      if (!ttsEnabledRef.current) {
        return;
      }

      stopDjIntroTts();

      try {
        const response = await fetch('/api/ai-dj/commentary/tts', {
          body: JSON.stringify({ text }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
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
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        const audioState = { audio, objectUrl: audioUrl };
        djIntroAudioRef.current = audioState;

        const clearAudioState = () => {
          if (djIntroAudioRef.current === audioState) {
            URL.revokeObjectURL(audioUrl);
            djIntroAudioRef.current = null;
          }
        };

        audio.onended = clearAudioState;
        audio.onerror = clearAudioState;

        await audio.play();
      } catch {
        stopDjIntroTts();
        // TTS 失敗不中斷主流程
      }
    },
    [stopDjIntroTts],
  );

  const applyTickResult = useCallback(
    (body: RadioTickOutput) => {
      setSession((current) => (current ? { ...current, mode: body.session.mode } : current));
      setSegment(body.segment);
      setTracks(body.segment.tracks);
      setQueueStatusByUri(buildQueueStatus(body.segment));
      setPendingFeedback([]);
      setErrorMessage(body.queueWarning?.message ?? null);

      if (body.segment.plan.djIntro) {
        void playDjIntroTts(body.segment.plan.djIntro);
      }
    },
    [playDjIntroTts],
  );

  const requestNextSegment = useCallback(
    async (input: { feedback: PendingFeedback[]; sessionId: string }): Promise<RadioTickOutput> => {
      const llmSelection = readStoredLlmSelection();
      const response = await fetch('/api/radio/tick', {
        body: JSON.stringify({
          autoplayQueue: autoTickStateRef.current.autoplayQueue,
          clientTimeIso: new Date().toISOString(),
          feedback: input.feedback,
          llmModel: llmSelection.llmModel,
          llmProvider: llmSelection.llmProvider,
          sessionId: input.sessionId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body = await readJsonResponse<RadioTickOutput | ApiError>(
        response,
        'Radio tick 回傳格式錯誤。',
      );

      if (!response.ok || isApiError(body)) {
        throw new Error(getApiErrorMessage(body, 'Radio tick 失敗。'));
      }

      return body;
    },
    [],
  );

  const autoTickIfQueueIsLow = useCallback(async () => {
    const state = autoTickStateRef.current;

    if (
      autoTickInFlightRef.current ||
      !state.autoplayQueue ||
      state.segmentTrackCount === 0 ||
      !state.sessionId ||
      state.sessionStatus !== 'active'
    ) {
      return;
    }

    autoTickInFlightRef.current = true;

    try {
      const queueResponse = await fetch('/api/spotify/queue-status', { cache: 'no-store' });

      if (!queueResponse.ok) {
        return;
      }

      const queueBody = (await queueResponse.json()) as { queueCount?: unknown };
      const queueCount =
        typeof queueBody.queueCount === 'number' ? queueBody.queueCount : Number.POSITIVE_INFINITY;

      if (queueCount > AUTO_TICK_QUEUE_THRESHOLD) {
        return;
      }

      const body = await requestNextSegment({
        feedback: state.pendingFeedback,
        sessionId: state.sessionId,
      });

      applyTickResult(body);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '自動補歌失敗。');
    } finally {
      autoTickInFlightRef.current = false;
    }
  }, [applyTickResult, requestNextSegment]);

  useEffect(() => {
    autoTickStateRef.current = {
      autoplayQueue,
      pendingFeedback,
      segmentTrackCount: segment?.tracks.length ?? 0,
      sessionId: session?.id ?? null,
      sessionStatus: session?.status ?? null,
    };
  }, [autoplayQueue, pendingFeedback, segment?.tracks.length, session?.id, session?.status]);

  useEffect(() => {
    if (session?.status !== 'active' || !autoplayQueue) {
      return;
    }

    const interval = window.setInterval(() => {
      void autoTickIfQueueIsLow();
    }, AUTO_TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [autoTickIfQueueIsLow, autoplayQueue, session?.status]);

  const startSession = useCallback(
    async (promptOverride?: string, modeOverride?: AiDjMode) => {
      const promptToUse = (promptOverride ?? prompt).trim();

      if (!promptToUse) {
        return;
      }

      setErrorMessage(null);
      setIsStarting(true);
      setPendingFeedback([]);
      setFeedbackStatusByKey({});

      try {
        const llmSelection = readStoredLlmSelection();
        const response = await fetch('/api/radio/start', {
          body: JSON.stringify({
            autoplayQueue,
            clientTimeIso: new Date().toISOString(),
            llmModel: llmSelection.llmModel,
            llmProvider: llmSelection.llmProvider,
            mode: modeOverride ?? mode,
            prompt: promptToUse,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const body = await readJsonResponse<RadioStartOutput | ApiError>(
          response,
          'Radio start 回傳格式錯誤。',
        );

        if (!response.ok || isApiError(body)) {
          throw new Error(getApiErrorMessage(body, 'Radio session 建立失敗。'));
        }

        setSession(body.session);
        setSegment(body.segment);
        setTracks(body.segment.tracks);
        setQueueStatusByUri(buildQueueStatus(body.segment));
        setPrompt(promptToUse);
        setErrorMessage(body.queueWarning?.message ?? null);

        if (body.segment.plan.djIntro) {
          void playDjIntroTts(body.segment.plan.djIntro);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Radio session 建立失敗。');
      } finally {
        setIsStarting(false);
      }
    },
    [autoplayQueue, mode, prompt, playDjIntroTts],
  );

  useEffect(() => {
    function handleAssistantRadioPrompt(event: Event) {
      const detail = (event as CustomEvent<AssistantRadioPromptEventDetail>).detail;
      const nextPrompt = detail?.prompt?.trim();

      if (!nextPrompt) {
        return;
      }

      if (session?.status === 'active') {
        setErrorMessage('目前已有 Radio Session。請先 Stop，再套用助手建議。');
        return;
      }

      setPrompt(nextPrompt);
      setMode('auto');
      setErrorMessage(
        detail.autoStart ? null : '已套用音樂助手建議。確認 Spotify 裝置後按 Start 建立播放規劃。',
      );

      if (detail.autoStart) {
        void startSession(nextPrompt, 'auto');
      }
    }

    window.addEventListener(ASSISTANT_RADIO_PROMPT_EVENT, handleAssistantRadioPrompt);

    return () =>
      window.removeEventListener(ASSISTANT_RADIO_PROMPT_EVENT, handleAssistantRadioPrompt);
  }, [session?.status, startSession]);

  async function tickSession() {
    if (!session) {
      return;
    }

    setErrorMessage(null);
    setIsTicking(true);

    try {
      applyTickResult(
        await requestNextSegment({ feedback: pendingFeedback, sessionId: session.id }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Radio tick 失敗。');
    } finally {
      setIsTicking(false);
    }
  }

  async function stopSession() {
    if (!session) {
      return;
    }

    setErrorMessage(null);
    setIsStopping(true);

    try {
      const response = await fetch('/api/radio/stop', {
        body: JSON.stringify({ sessionId: session.id }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body = await readJsonResponse<RadioStopOutput | ApiError>(
        response,
        'Radio stop 回傳格式錯誤。',
      );

      if (!response.ok || isApiError(body)) {
        throw new Error(getApiErrorMessage(body, 'Radio stop 失敗。'));
      }

      setSession((current) => (current ? { ...current, status: body.session.status } : current));
      stopDjIntroTts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Radio stop 失敗。');
    } finally {
      setIsStopping(false);
    }
  }

  async function addToQueue(track: SpotifyTrackCandidate) {
    setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'adding' }));

    try {
      const response = await fetch('/api/spotify/queue', {
        body: JSON.stringify({ spotifyUris: [track.spotifyUri] }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      setQueueStatusByUri((current) => ({
        ...current,
        [track.spotifyUri]: response.ok ? 'added' : 'error',
      }));
    } catch {
      setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'error' }));
    }
  }

  function recordFeedback(track: SpotifyTrackCandidate, feedbackType: FeedbackType) {
    const feedbackKey = `${track.spotifyUri}:${feedbackType}`;
    const spotifyTrackId = track.spotifyUri.split(':')[2] ?? track.spotifyUri;

    setFeedbackStatusByKey((current) => ({ ...current, [feedbackKey]: 'saved' }));
    setPendingFeedback((current) => [
      ...current,
      {
        feedbackType,
        spotifyTrackId,
        trackName: track.title,
      },
    ]);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <section className="glass-panel rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Joshua Radio</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {session?.status === 'active'
                ? `Session ${session.id.slice(0, 8)} · segment ${segment?.index ?? 0}`
                : '建立一段可持續 tick 的 AI radio session。'}
            </p>
          </div>
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
              session?.status === 'active'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-400 bg-white text-slate-700'
            }`}
          >
            {session?.status === 'active' ? 'On Air' : 'Standby'}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-md border px-3 py-2 text-sm ${
                mode === option.value
                  ? 'border-sky-700 bg-sky-700 text-white shadow-sm'
                  : 'border-slate-300/70 bg-white/70 text-slate-700 hover:border-sky-500 hover:bg-sky-50 hover:text-sky-800'
              }`}
              disabled={session?.status === 'active'}
              onClick={() => setMode(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="radio-prompt">
          Session prompt
        </label>
        <textarea
          className="glass-control mt-2 h-36 w-full resize-none rounded-md px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400/60"
          disabled={session?.status === 'active'}
          id="radio-prompt"
          maxLength={500}
          onChange={(event) => setPrompt(event.target.value)}
          value={prompt}
        />

        <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200/70 bg-white/40 px-3 py-2">
          <span className="text-sm text-slate-600">自動加入 Spotify queue</span>
          <button
            aria-checked={autoplayQueue}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
              autoplayQueue ? 'bg-sky-500' : 'bg-slate-200'
            }`}
            onClick={() => setAutoplayQueue((current) => !current)}
            role="switch"
            type="button"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                autoplayQueue ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-md border border-slate-200/70 bg-white/40 px-3 py-2">
          <span className="text-sm text-slate-600">DJ 語音導聆</span>
          <button
            aria-checked={ttsEnabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
              ttsEnabled ? 'bg-sky-500' : 'bg-slate-200'
            }`}
            onClick={() => {
              if (ttsEnabled) {
                stopDjIntroTts();
              }
              setTtsEnabled((current) => !current);
            }}
            role="switch"
            type="button"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                ttsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="mt-2 rounded-md border border-slate-200/70 bg-white/40 px-3 py-3">
          <LlmModelPicker compact />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <button
            className="rounded-md border border-sky-700 bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
            disabled={isBusy || prompt.trim().length === 0 || session?.status === 'active'}
            onClick={() => void startSession()}
            type="button"
          >
            {isStarting ? '啟動中...' : 'Start'}
          </button>
          <button
            className="rounded-md border border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:border-sky-600 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={isBusy || session?.status !== 'active'}
            onClick={() => void tickSession()}
            type="button"
          >
            {isTicking ? '產生下一段...' : 'Tick'}
          </button>
          <button
            className="rounded-md border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm hover:border-rose-600 hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={isBusy || session?.status !== 'active'}
            onClick={() => void stopSession()}
            type="button"
          >
            {isStopping ? '結束中...' : 'Stop'}
          </button>
        </div>

        {segment ? (
          <div className="mt-5 rounded-lg border border-sky-200/50 bg-sky-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              {segment.plan.segmentTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{segment.plan.djIntro}</p>
            <p className="mt-3 border-l-2 border-sky-400/60 pl-3 text-sm leading-6 text-slate-600">
              {segment.plan.transitionNote}
            </p>
          </div>
        ) : null}

        {pendingFeedback.length > 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {pendingFeedback.length} 筆回饋會在下一次 tick 帶入。
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]">
        <NowPlaying
          djMode={currentMode}
          djSchedulerEnabled={session?.status === 'active' && ttsEnabled}
        />
        <QueueList
          feedbackStatusByKey={feedbackStatusByKey}
          isLoading={isStarting || isTicking}
          onAddToQueue={(track) => void addToQueue(track)}
          onFeedback={recordFeedback}
          plan={segment?.plan ?? null}
          queueStatusByUri={queueStatusByUri}
          tracks={tracks}
        />
      </div>
    </div>
  );
}
