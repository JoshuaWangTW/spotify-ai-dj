'use client';

import type { AiDjPlanOutput } from '../../lib/ai-dj/plan-schema';
import type { SpotifyTrackCandidate } from '../../lib/spotify-types';
import DJCommentaryCard from '../dj/DJCommentaryCard';

type QueueListProps = {
  feedbackStatusByKey: Record<string, 'idle' | 'saving' | 'saved' | 'error'>;
  isLoading: boolean;
  onAddToQueue(track: SpotifyTrackCandidate): void;
  onFeedback(
    track: SpotifyTrackCandidate,
    feedbackType: 'like' | 'dislike' | 'too_loud' | 'no_vocals' | 'work_focus' | 'more_detail',
  ): void;
  plan: AiDjPlanOutput | null;
  queueStatusByUri: Record<string, 'idle' | 'adding' | 'added' | 'error'>;
  tracks: SpotifyTrackCandidate[];
};

export default function QueueList({
  feedbackStatusByKey,
  isLoading,
  onAddToQueue,
  onFeedback,
  plan,
  queueStatusByUri,
  tracks,
}: QueueListProps) {
  return (
    <section className="glass-panel min-h-[620px] rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Queue / Recommendations</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            AI plan 的 Spotify 候選曲與推薦理由。
          </p>
        </div>
        <span className="rounded-md border border-sky-200/20 bg-sky-200/10 px-2.5 py-1 text-xs font-medium text-sky-100">
          {tracks.length} tracks
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="glass-card rounded-lg p-4 text-sm text-slate-400">
            正在搜尋 Spotify 候選曲...
          </div>
        ) : null}

        {!isLoading && tracks.length === 0 ? (
          <div className="glass-card rounded-lg p-4 text-sm leading-6 text-slate-400">
            右側會顯示 Spotify Search 的候選曲。請先在左側送出需求。
          </div>
        ) : null}

        {tracks.map((track, index) => {
          const status = queueStatusByUri[track.spotifyUri] ?? 'idle';
          const reasoningIndex =
            plan?.spotifySearchQueries.findIndex((query) => query === track.query) ?? -1;
          const queueReasoning =
            reasoningIndex >= 0 ? plan?.queueReasoning[reasoningIndex] : undefined;

          return (
            <article key={`${track.spotifyUri}-${index}`} className="glass-card rounded-lg p-4">
              <div className="flex items-start gap-3">
                {track.albumImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`${track.album} album art`}
                    className="h-16 w-16 rounded-md border border-white/10 object-cover"
                    src={track.albumImageUrl}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border border-white/10 bg-slate-800/50" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-50">{track.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-400">{track.artist}</p>
                      <p className="truncate text-sm text-slate-500">{track.album}</p>
                    </div>
                    <span className="rounded-md border border-slate-500/30 bg-slate-900/20 px-2 py-1 text-xs text-slate-400">
                      {track.explicit ? 'Explicit' : 'Clean'}
                    </span>
                  </div>

                  <p className="mt-3 border-l-2 border-sky-200/70 pl-3 text-sm leading-6 text-slate-300">
                    {queueReasoning ?? `搜尋策略：${track.query}`}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      className="aqua-button rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={status === 'adding' || status === 'added'}
                      onClick={() => onAddToQueue(track)}
                      type="button"
                    >
                      {status === 'adding'
                        ? '加入中...'
                        : status === 'added'
                          ? '已加入'
                          : '加入 queue'}
                    </button>
                    <a
                      className="aqua-link text-sm font-medium"
                      href={track.spotifyUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open in Spotify
                    </a>
                    {status === 'error' ? (
                      <span className="text-sm text-amber-300">
                        加入失敗，請確認 active device。
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ['like', '喜歡'],
                      ['dislike', '不喜歡'],
                      ['too_loud', '太吵'],
                      ['no_vocals', '不要人聲'],
                      ['work_focus', '適合工作'],
                      ['more_detail', '多講一點'],
                    ].map(([feedbackType, label]) => {
                      const feedbackKey = `${track.spotifyUri}:${feedbackType}`;
                      const feedbackStatus = feedbackStatusByKey[feedbackKey] ?? 'idle';

                      return (
                        <button
                          key={feedbackType}
                          className="glass-control rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-200/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={feedbackStatus === 'saving' || feedbackStatus === 'saved'}
                          onClick={() =>
                            onFeedback(
                              track,
                              feedbackType as
                                | 'like'
                                | 'dislike'
                                | 'too_loud'
                                | 'no_vocals'
                                | 'work_focus'
                                | 'more_detail',
                            )
                          }
                          type="button"
                        >
                          {feedbackStatus === 'saving'
                            ? '儲存中'
                            : feedbackStatus === 'saved'
                              ? '已記錄'
                              : label}
                        </button>
                      );
                    })}
                  </div>

                  <DJCommentaryCard
                    artistName={track.artist}
                    mode={plan?.mode ?? 'jazz_intro'}
                    trackName={track.title}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
