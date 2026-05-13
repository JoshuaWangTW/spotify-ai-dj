'use client';

import { useState } from 'react';

import type { AiDjPlanOutput } from '../../lib/ai-dj/plan-schema';
import type { SpotifyTrackCandidate } from '../../lib/spotify-types';
import ChatPanel from './ChatPanel';
import NowPlaying from '../player/NowPlaying';
import QueueList from '../queue/QueueList';

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

export default function AiDjWorkspace() {
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
      const planBody = (await planResponse.json()) as AiDjPlanOutput | ApiError;

      if (!planResponse.ok || isApiError(planBody)) {
        throw new Error(getApiErrorMessage(planBody, 'AI DJ plan 產生失敗。'));
      }

      setPlan(planBody);

      const searchResponse = await fetch('/api/spotify/search', {
        body: JSON.stringify({
          queries: planBody.spotifySearchQueries,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const searchBody = (await searchResponse.json()) as
        | { tracks: SpotifyTrackCandidate[] }
        | ApiError;

      if (!searchResponse.ok || isApiError(searchBody)) {
        throw new Error(getApiErrorMessage(searchBody, 'Spotify search 失敗。'));
      }

      setTracks(searchBody.tracks);
    } catch (error) {
      setTracks([]);
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(300px,0.9fr)_minmax(320px,1fr)]">
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
      <NowPlaying />
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
  );
}
