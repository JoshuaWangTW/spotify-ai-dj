'use client';

import { useState } from 'react';

import type { AiDjPlanOutput } from '../../lib/ai-dj/plan-schema';
import type { SpotifyTrackCandidate } from '../../lib/spotify-types';
import ChatPanel from './ChatPanel';
import NowPlaying from '../player/NowPlaying';
import QueueList from '../queue/QueueList';

type WorkspacePanel = 'chat' | 'player' | 'queue';

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
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

export default function AiDjWorkspace() {
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('chat');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<AiDjPlanOutput | null>(null);
  const [prompt, setPrompt] = useState('我想聽爵士，想學一點，不要太硬。');
  const [queueStatusByUri, setQueueStatusByUri] = useState<
    Record<string, 'idle' | 'adding' | 'added' | 'error'>
  >({});
  const [feedbackStatusByKey, setFeedbackStatusByKey] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({});
  const [selectedMode, setSelectedMode] = useState('auto');
  const [tracks, setTracks] = useState<SpotifyTrackCandidate[]>([]);

  async function handleSubmit() {
    let planCreated = false;

    setErrorMessage(null);
    setIsLoading(true);
    setFeedbackStatusByKey({});
    setQueueStatusByUri({});

    try {
      const planResponse = await fetch('/api/ai-dj/plan', {
        body: JSON.stringify({
          mode: selectedMode,
          prompt,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const planBody = await readJsonResponse<AiDjPlanOutput | ApiError>(
        planResponse,
        'AI DJ plan 回傳格式錯誤。',
      );

      if (!planResponse.ok || isApiError(planBody)) {
        throw new Error(getApiErrorMessage(planBody, 'AI DJ plan 產生失敗。'));
      }

      setPlan(planBody);
      planCreated = true;
      setActivePanel('queue');

      const searchResponse = await fetch('/api/spotify/search', {
        body: JSON.stringify({
          queries: planBody.spotifySearchQueries,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const searchBody = await readJsonResponse<{ tracks: SpotifyTrackCandidate[] } | ApiError>(
        searchResponse,
        'Spotify search 回傳格式錯誤。',
      );

      if (!searchResponse.ok || isApiError(searchBody)) {
        throw new Error(getApiErrorMessage(searchBody, 'Spotify search 失敗。'));
      }

      setTracks(searchBody.tracks);
    } catch (error) {
      if (!planCreated) {
        setTracks([]);
        setActivePanel('chat');
      }

      setErrorMessage(error instanceof Error ? error.message : '產生推薦時發生錯誤。');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddToQueue(track: SpotifyTrackCandidate) {
    setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'adding' }));

    try {
      const response = await fetch('/api/spotify/queue', {
        body: JSON.stringify({
          spotifyUris: [track.spotifyUri],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'error' }));
        return;
      }

      setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'added' }));
    } catch {
      setQueueStatusByUri((current) => ({ ...current, [track.spotifyUri]: 'error' }));
    }
  }

  async function handleFeedback(
    track: SpotifyTrackCandidate,
    feedbackType: 'like' | 'dislike' | 'too_loud' | 'no_vocals' | 'work_focus' | 'more_detail',
  ) {
    const feedbackKey = `${track.spotifyUri}:${feedbackType}`;
    const spotifyTrackId = track.spotifyUri.split(':')[2];

    setFeedbackStatusByKey((current) => ({ ...current, [feedbackKey]: 'saving' }));

    try {
      const response = await fetch('/api/feedback/track', {
        body: JSON.stringify({
          artistName: track.artist,
          context: plan?.mode,
          feedbackType,
          spotifyTrackId,
          trackName: track.title,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      setFeedbackStatusByKey((current) => ({
        ...current,
        [feedbackKey]: response.ok ? 'saved' : 'error',
      }));
    } catch {
      setFeedbackStatusByKey((current) => ({ ...current, [feedbackKey]: 'error' }));
    }
  }

  const panelTabs: Array<{
    helper: string;
    id: WorkspacePanel;
    label: string;
    meta: string;
  }> = [
    {
      helper: (plan?.mode ?? selectedMode).replace(/_/g, ' '),
      id: 'chat',
      label: 'AI DJ',
      meta: isLoading ? '產生中' : '規劃',
    },
    {
      helper: 'Spotify Web Playback SDK',
      id: 'player',
      label: '播放器',
      meta: '播放',
    },
    {
      helper: tracks.length > 0 ? `${tracks.length} 首候選曲` : '等待搜尋結果',
      id: 'queue',
      label: '推薦清單',
      meta: `${tracks.length}`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-lg p-2">
        <div
          aria-label="AI DJ workspace panels"
          className="grid gap-2 md:grid-cols-3"
          role="tablist"
        >
          {panelTabs.map((tab) => {
            const isActive = activePanel === tab.id;

            return (
              <button
                key={tab.id}
                aria-controls={`workspace-panel-${tab.id}`}
                aria-selected={isActive}
                className={`rounded-md border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-sky-400/60 bg-sky-100/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
                    : 'border-slate-200/80 bg-white/40 text-slate-600 hover:border-sky-400/40 hover:text-white'
                }`}
                id={`workspace-tab-${tab.id}`}
                onClick={() => setActivePanel(tab.id)}
                role="tab"
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span className="rounded-md border border-slate-200/60 bg-slate-100/60 px-2 py-0.5 text-xs text-slate-600">
                    {tab.meta}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-400">{tab.helper}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div
          aria-labelledby="workspace-tab-chat"
          className={activePanel === 'chat' ? 'block' : 'hidden'}
          id="workspace-panel-chat"
          role="tabpanel"
        >
          <ChatPanel
            errorMessage={errorMessage}
            isLoading={isLoading}
            onModeChange={setSelectedMode}
            onPromptChange={setPrompt}
            onSubmit={() => void handleSubmit()}
            plan={plan}
            prompt={prompt}
            selectedMode={selectedMode}
          />
        </div>

        <div
          aria-labelledby="workspace-tab-player"
          className={activePanel === 'player' ? 'block' : 'hidden'}
          id="workspace-panel-player"
          role="tabpanel"
        >
          <NowPlaying />
        </div>

        <div
          aria-labelledby="workspace-tab-queue"
          className={activePanel === 'queue' ? 'block' : 'hidden'}
          id="workspace-panel-queue"
          role="tabpanel"
        >
          <QueueList
            feedbackStatusByKey={feedbackStatusByKey}
            isLoading={isLoading}
            onAddToQueue={(track) => void handleAddToQueue(track)}
            onFeedback={(track, feedbackType) => void handleFeedback(track, feedbackType)}
            plan={plan}
            queueStatusByUri={queueStatusByUri}
            tracks={tracks}
          />
        </div>
      </div>
    </div>
  );
}
