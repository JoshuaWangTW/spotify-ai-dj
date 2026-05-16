// components/mobile/screens/ForYouScreen.tsx
'use client';

import AlbumArtwork, { type AlbumArtKind } from '../AlbumArtwork';
import { useRadio } from '../RadioContext';
import { MODES, type DjMode } from '../modes';
import { IconBell, IconChevronRight, IconMenu, IconPlay } from '../icons';
import type { SessionUser } from '../MobileShell';

type Props = {
  sessionUser: SessionUser | null;
  onPickMode: (mode: DjMode) => void;
  onOpenNowPlaying: () => void;
};

export default function ForYouScreen({ sessionUser, onPickMode, onOpenNowPlaying }: Props) {
  const { session, segment } = useRadio();
  const greeting = sessionUser?.displayName ?? 'there';
  const hasActiveSession = session?.status === 'active';

  return (
    <div className="px-0">
      <div className="flex items-center justify-between px-5 pt-2 pb-1">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
        >
          <IconMenu size={20} />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-600"
        >
          <IconBell size={20} />
        </button>
      </div>

      <div className="px-5 pt-2 pb-4">
        <p className="text-sm text-slate-500">Good evening, {greeting}</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-slate-900">For You</h1>
      </div>

      {/* Hero card */}
      <div className="px-5 pb-6">
        {hasActiveSession && segment ? (
          // Active session: surface its segment title + first track and let
          // the user resume in NowPlaying.
          <button
            type="button"
            onClick={onOpenNowPlaying}
            className="relative w-full overflow-hidden rounded-3xl border border-white/90 px-5 py-5 text-left"
            style={{
              minHeight: 138,
              background:
                'radial-gradient(120% 80% at 75% 50%, rgba(186, 230, 253, 0.95) 0%, rgba(207, 234, 247, 0.5) 60%, transparent 90%),' +
                'linear-gradient(135deg, #f0f7fb 0%, #dcecf5 60%, #c9e3f0 100%)',
              boxShadow: '0 10px 30px rgba(125,211,252,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
            }}
          >
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  On Air
                </span>
                <h2 className="mt-2 truncate text-[20px] font-bold text-sky-900">
                  {segment.plan.segmentTitle}
                </h2>
                <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-600">
                  {segment.plan.djIntro}
                </p>
              </div>
              <span
                className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full border border-white/95 text-sky-600"
                style={{
                  background: 'linear-gradient(135deg, #ffffff, #e0f2fe)',
                  boxShadow: '0 6px 18px rgba(125,211,252,0.4)',
                }}
              >
                <IconPlay size={22} />
              </span>
            </div>
          </button>
        ) : (
          // No session: invite to start one. Picking the first mode is a
          // sensible default — the next sheet lets the user change it.
          <button
            type="button"
            onClick={() => onPickMode(MODES[0])}
            className="relative w-full overflow-hidden rounded-3xl border border-white/90 px-6 py-6 text-left"
            style={{
              minHeight: 138,
              background:
                'radial-gradient(120% 80% at 75% 50%, rgba(186, 230, 253, 0.95) 0%, rgba(207, 234, 247, 0.5) 60%, transparent 90%),' +
                'linear-gradient(135deg, #f0f7fb 0%, #dcecf5 60%, #c9e3f0 100%)',
              boxShadow: '0 10px 30px rgba(125,211,252,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
            }}
          >
            <svg
              aria-hidden
              className="pointer-events-none absolute right-[-10px] top-0 h-full"
              width="220"
              viewBox="0 0 220 140"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 80 Q 60 30 110 70 T 220 70"
                stroke="rgba(125,211,252,0.6)"
                strokeWidth="2.5"
              />
              <path
                d="M0 95 Q 60 50 110 90 T 220 90"
                stroke="rgba(186,230,253,0.7)"
                strokeWidth="2"
              />
              <path
                d="M0 110 Q 60 80 110 105 T 220 105"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.8"
              />
            </svg>
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-[22px] font-bold text-sky-900">Start AI DJ</h2>
                <p className="mt-2 max-w-[200px] text-[13.5px] leading-snug text-slate-600">
                  Tell me a vibe — I&apos;ll plan the set and intro every track.
                </p>
              </div>
              <span
                className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full border border-white/95 text-sky-600"
                style={{
                  background: 'linear-gradient(135deg, #ffffff, #e0f2fe)',
                  boxShadow:
                    '0 6px 18px rgba(125,211,252,0.4), inset 0 1px 0 rgba(255,255,255,0.95)',
                }}
              >
                <IconPlay size={22} />
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Your Modes */}
      <SectionHeader title="Your Modes" action="See all" />
      <div className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPickMode(m)}
            className="glass-card flex w-[120px] flex-shrink-0 flex-col overflow-hidden rounded-2xl text-left"
          >
            <div className="h-[120px] w-[120px]">
              <AlbumArtwork kind={m.art} src={m.coverSquareSrc} size={120} radius={0} />
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold text-slate-800">{m.shortLabel}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">AI DJ Mix</div>
            </div>
          </button>
        ))}
      </div>

      {/* Current segment tracks (when active) — replaces the mock Recent Sessions list */}
      {hasActiveSession && segment && segment.tracks.length > 0 ? (
        <>
          <SectionHeader title="Now Playing Queue" />
          <div className="flex flex-col gap-2 px-5">
            {segment.tracks.slice(0, 6).map((t, i) => (
              <div
                key={t.spotifyUri}
                className="flex items-center gap-3 rounded-2xl bg-white/60 p-2.5"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-200">
                  {t.albumImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.albumImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-slate-800">
                    {t.title}
                  </div>
                  <div className="truncate text-xs text-slate-500">{t.artist}</div>
                </div>
                <span className="text-[12px] tabular-nums text-slate-400">{i + 1}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionHeader title="Recent Sessions" action="History" />
          <div className="flex flex-col gap-2.5 px-5">
            {[
              {
                title: 'Late Night Jazz',
                subtitle: '12 tracks · Jazz Intro',
                when: '2h ago',
                art: 'sax' as AlbumArtKind,
              },
              {
                title: 'Beethoven Symphonies',
                subtitle: '8 tracks · Classical',
                when: 'Yesterday',
                art: 'violin' as AlbumArtKind,
              },
              {
                title: 'Roasting Session',
                subtitle: '6 tracks · Coffee',
                when: '2d ago',
                art: 'desert' as AlbumArtKind,
              },
            ].map((s) => (
              <div key={s.title} className="glass-card flex items-center gap-3 rounded-2xl p-2.5">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
                  <AlbumArtwork kind={s.art} size={56} radius={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{s.subtitle}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{s.when}</div>
                </div>
                <IconChevronRight size={18} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between px-5">
      <h3 className="m-0 text-[17px] font-semibold text-slate-700">{title}</h3>
      {action && (
        <button type="button" className="flex items-center gap-0.5 text-[13px] text-slate-500">
          <span>{action}</span>
          <IconChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
