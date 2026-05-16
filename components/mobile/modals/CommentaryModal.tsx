// components/mobile/modals/CommentaryModal.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiDjCommentaryOutput } from '../../../lib/ai-dj/commentary-schema';
import { readStoredLlmSelection } from '../../llm/useLlmModelPreference';
import type { TrackState } from '../../player/useSpotifyWebPlayback';
import { useRadio } from '../RadioContext';
import { findMode } from '../modes';
import { IconChevronLeft, IconPause, IconPlay, IconSpark, IconThumbsUp } from '../icons';

type ApiError = { error?: { message?: string } };
function isApiError(b: unknown): b is ApiError {
  return !!b && typeof b === 'object' && 'error' in b;
}

type Props = {
  onClose: () => void;
  track: TrackState | null;
};

export default function CommentaryModal({ onClose, track }: Props) {
  const { segment, ttsVoice } = useRadio();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Source of truth for what we ask AI about: real SDK track first,
  // then segment's lead track.
  const fallback = segment?.tracks[0];
  const trackName = track?.title ?? fallback?.title ?? '';
  const artistName = track?.artist ?? fallback?.artist ?? '';
  const mode = segment?.plan.mode ?? 'jazz_intro';
  const modeMeta = findMode(mode);

  const [depth, setDepth] = useState<'short' | 'deep'>('short');
  const [commentary, setCommentary] = useState<AiDjCommentaryOutput | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [likeStatus, setLikeStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const currentTrackUri = track?.trackUri ?? fallback?.spotifyUri ?? null;
  // Reset like status when the track changes so the user can like the next one.
  useEffect(() => {
    setLikeStatus('idle');
  }, [currentTrackUri]);

  const fetchCommentary = useCallback(
    async (d: 'short' | 'deep') => {
      if (!trackName || !artistName) {
        setError('沒有可導聆的曲目 — 請先 Start 一個 session 並開始播放。');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const llmSelection = readStoredLlmSelection();
        const r = await fetch('/api/ai-dj/commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackName,
            artistName,
            mode,
            depth: d,
            llmModel: llmSelection.llmModel,
            llmProvider: llmSelection.llmProvider,
          }),
        });
        const body = (await r.json()) as AiDjCommentaryOutput | ApiError;
        if (!r.ok || isApiError(body)) {
          throw new Error((body as ApiError).error?.message ?? '導聆產生失敗。');
        }
        setCommentary(body);
        setDepth(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : '導聆產生失敗。');
      } finally {
        setLoading(false);
      }
    },
    [trackName, artistName, mode],
  );

  // Auto-load short commentary when modal opens
  useEffect(() => {
    void fetchCommentary('short');
    // intentionally only on mount; user can re-trigger via the depth toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup TTS on unmount
  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    },
    [],
  );

  async function toggleTts() {
    if (speaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      setSpeaking(false);
      return;
    }
    if (!commentary) return;
    setSpeaking(true);
    setError(null);
    try {
      const r = await fetch('/api/ai-dj/commentary/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${commentary.commentary}\n聆聽重點：${commentary.listeningPoints.join('；')}`,
          voice: ttsVoice,
        }),
      });
      if (!r.ok) throw new Error('TTS 產生失敗');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioUrlRef.current = url;
      audioRef.current = audio;
      const clearAudio = () => {
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        audioRef.current = null;
        setSpeaking(false);
      };
      audio.onended = clearAudio;
      audio.onerror = () => {
        clearAudio();
        setError('TTS 播放失敗');
      };
      await audio.play();
    } catch (e) {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      audioRef.current = null;
      setSpeaking(false);
      setError(e instanceof Error ? e.message : 'TTS 失敗');
    }
  }

  async function handleLike() {
    if (likeStatus === 'sending' || likeStatus === 'sent') return;
    if (!currentTrackUri) {
      setError('沒有可回饋的曲目 — 請先開始播放。');
      return;
    }
    const spotifyTrackId = currentTrackUri.split(':').pop();
    if (!spotifyTrackId) {
      setError('曲目 ID 格式錯誤。');
      return;
    }
    setLikeStatus('sending');
    try {
      const r = await fetch('/api/feedback/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: artistName || undefined,
          feedbackType: 'like',
          spotifyTrackId,
          trackName: trackName || undefined,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.error?.message ?? '送出回饋失敗。');
      }
      setLikeStatus('sent');
    } catch (e) {
      setLikeStatus('failed');
      setError(e instanceof Error ? e.message : '送出回饋失敗。');
    }
  }

  const cover = track?.albumImageUrl ?? fallback?.albumImageUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto"
      style={{
        background: 'linear-gradient(170deg, #e9f4fa 0%, #dceaf2 60%, #d2e2ec 100%)',
        animation: 'cm-slide-up 320ms cubic-bezier(0.32, 0.72, 0.24, 1)',
      }}
    >
      <style jsx global>{`
        @keyframes cm-slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),44px)] pb-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
          aria-label="Back"
        >
          <IconChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-800">AI Commentary</span>
        <span style={{ width: 36 }} />
      </div>

      {/* Depth toggle */}
      <div className="px-5 pt-1 pb-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/50 p-1">
          {[
            { id: 'short' as const, label: '簡短導聆' },
            { id: 'deep' as const, label: '多講一點' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void fetchCommentary(t.id)}
              disabled={isLoading}
              className={`rounded-[11px] py-2.5 text-[13px] font-semibold transition-colors ${
                depth === t.id ? 'bg-white text-sky-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Track card */}
      <div className="px-5 pb-4">
        <div className="glass-panel flex items-center gap-3.5 rounded-3xl p-4">
          <div
            className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-2xl"
            style={{ background: 'linear-gradient(160deg, #e8eef3 0%, #c2cfd9 100%)' }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-800">
              {trackName || '—'}
            </div>
            <div className="truncate text-[13px] text-slate-500">{artistName}</div>
            {modeMeta ? (
              <div className="mt-1 inline-block rounded-full bg-sky-200/50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-sky-900">
                {modeMeta.label}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Commentary card */}
      <div className="px-5 pb-4">
        <div className="glass-panel rounded-3xl p-5">
          <div className="text-base font-bold text-sky-900">Why this track</div>
          {isLoading ? (
            <p className="mt-3 text-sm text-slate-500">正在產生導聆…</p>
          ) : commentary ? (
            <>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">
                {commentary.commentary}
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  聆聽重點
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0 text-[13px] text-slate-600">
                  {commentary.listeningPoints.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-sky-500">·</span>
                      <span className="flex-1">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">點上方按鈕產生導聆。</p>
          )}
          {error ? (
            <div className="mt-3 rounded-md border border-rose-300/50 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-5 pb-4">
        <button
          type="button"
          onClick={() => void toggleTts()}
          disabled={!commentary || isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-semibold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 3px 10px rgba(125,211,252,0.3)',
          }}
        >
          {speaking ? <IconPause size={16} /> : <IconPlay size={16} />}
          {speaking ? '停止語音' : '播放語音'}
        </button>
        <button
          type="button"
          onClick={() => void handleLike()}
          disabled={!currentTrackUri || likeStatus === 'sending' || likeStatus === 'sent'}
          className={`glass-card flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-semibold disabled:opacity-60 ${
            likeStatus === 'sent' ? 'text-emerald-700' : 'text-slate-700'
          }`}
          aria-label="Like this track"
        >
          <IconThumbsUp size={16} />
          {likeStatus === 'sent' ? '已送出' : likeStatus === 'sending' ? '送出中…' : 'Like'}
        </button>
      </div>

      {/* Footer hint */}
      <div className="px-5 pb-10 text-center text-[11.5px] text-slate-400">
        <IconSpark size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Commentary 由
        目前選擇的 AI 模型即時生成
      </div>
    </div>
  );
}
