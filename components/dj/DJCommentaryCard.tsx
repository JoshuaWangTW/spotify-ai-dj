'use client';

import { useRef, useState } from 'react';

import type { AiDjCommentaryOutput } from '../../lib/ai-dj/commentary-schema';
import { speakBrowserText, stopBrowserSpeech } from '../player/browserSpeech';

type CommentaryDepth = 'short' | 'deep';

type DJCommentaryCardProps = {
  artistName: string;
  mode: string;
  trackName: string;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body;
}

export default function DJCommentaryCard({ artistName, mode, trackName }: DJCommentaryCardProps) {
  const [commentary, setCommentary] = useState<AiDjCommentaryOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function loadCommentary(depth: CommentaryDepth) {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-dj/commentary', {
        body: JSON.stringify({
          artistName,
          depth,
          mode,
          trackName,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const body = (await response.json()) as AiDjCommentaryOutput | ApiError;

      if (isApiError(body)) {
        throw new Error(body.error?.message ?? '導聆產生失敗。');
      }

      if (!response.ok) {
        throw new Error('導聆產生失敗。');
      }

      setCommentary(body);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '導聆產生失敗。');
    } finally {
      setIsLoading(false);
    }
  }

  async function playCommentaryTts() {
    if (!commentary?.commentary || isSpeaking) {
      return;
    }

    setErrorMessage(null);
    setIsSpeaking(true);

    try {
      const response = await fetch('/api/ai-dj/commentary/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `${commentary.commentary}\n聆聽重點：${commentary.listeningPoints.join('；')}`,
        }),
      });

      const speechText = `${commentary.commentary}\n聆聽重點：${commentary.listeningPoints.join('；')}`;

      if (response.status === 204) {
        await speakBrowserText(speechText);
        setIsSpeaking(false);
        return;
      }

      if (!response.ok) {
        throw new Error('導讀語音產生失敗。');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        setErrorMessage('導讀語音播放失敗。');
      };
      await audio.play();
    } catch (error) {
      setIsSpeaking(false);
      setErrorMessage(error instanceof Error ? error.message : '導讀語音播放失敗。');
    }
  }

  function stopCommentaryTts() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
    stopBrowserSpeech();
    setIsSpeaking(false);
  }

  return (
    <div className="mt-4 rounded-md border border-sky-200/40 bg-white/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">DJ commentary</p>
        <div className="flex gap-2">
          <button
            className="glass-control rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadCommentary('short')}
            type="button"
          >
            {commentary ? '重新產生' : '生成導聆'}
          </button>
          <button
            className="glass-control rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void loadCommentary('deep')}
            type="button"
          >
            多講一點
          </button>
        </div>
      </div>

      {isLoading ? <p className="mt-3 text-sm text-slate-500">正在產生導聆...</p> : null}

      {commentary ? (
        <div className="mt-3 text-sm leading-6 text-slate-600">
          <p>{commentary.commentary}</p>
          <ul className="mt-3 space-y-1 text-slate-500">
            {commentary.listeningPoints.map((point) => (
              <li key={point}>- {point}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSpeaking}
              onClick={() => void playCommentaryTts()}
              type="button"
            >
              {isSpeaking ? '播放中...' : '播放導讀語音'}
            </button>
            <button
              className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isSpeaking}
              onClick={stopCommentaryTts}
              type="button"
            >
              停止語音
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? <p className="mt-3 text-sm text-amber-300">{errorMessage}</p> : null}
    </div>
  );
}
