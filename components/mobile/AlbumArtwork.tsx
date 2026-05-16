// components/mobile/AlbumArtwork.tsx
// Painterly album cover placeholder. Pass `src` once you have real cover images
// (placed under public/covers/) and the SVG fallback is replaced.
'use client';

import { useId } from 'react';

export type AlbumArtKind =
  | 'mountains'
  | 'sax'
  | 'violin'
  | 'orb'
  | 'piano'
  | 'sunset'
  | 'forest'
  | 'blues'
  | 'desert';

type Props = {
  kind?: AlbumArtKind;
  /** Real cover image URL (e.g. `/covers/jazz-square.png`). When set, replaces the SVG. */
  src?: string | null;
  size?: number;
  /** Border radius in px */
  radius?: number;
  /** Use the wide variant of the real image for non-square layouts */
  variant?: 'square' | 'wide';
  alt?: string;
};

export default function AlbumArtwork({
  kind = 'mountains',
  src,
  size = 200,
  radius = 24,
  alt = '',
}: Props) {
  const id = useId().replace(/:/g, '_');

  // Real image takes priority
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          display: 'block',
          objectFit: 'cover',
        }}
      />
    );
  }

  const palettes: Record<
    AlbumArtKind,
    { sky: [string, string]; land: [string, string]; sun: string }
  > = {
    mountains: { sky: ['#dde9f1', '#b2cadc'], land: ['#7d9fb8', '#5d7e96'], sun: '#e6eff5' },
    sax: { sky: ['#e6ddc8', '#caaf86'], land: ['#8e6f4b', '#705339'], sun: '#f0e1bf' },
    violin: { sky: ['#e0dbe6', '#b9aec6'], land: ['#7a6d8d', '#5b4e6b'], sun: '#ebe4ef' },
    orb: { sky: ['#dceaf1', '#a8c3d8'], land: ['#6f8da3', '#4b6678'], sun: '#f1f7fa' },
    piano: { sky: ['#dde0e3', '#a8aeb6'], land: ['#5c6066', '#36383d'], sun: '#e7e9ec' },
    sunset: { sky: ['#f0d2cf', '#d09a99'], land: ['#7d5a6e', '#54394a'], sun: '#f7e0d8' },
    forest: { sky: ['#dde6da', '#a9c0a6'], land: ['#52704f', '#33493a'], sun: '#e9efe4' },
    blues: { sky: ['#dde7ee', '#a6bccb'], land: ['#4e7187', '#2e4a5c'], sun: '#e9f1f6' },
    desert: { sky: ['#ead7c1', '#cbb18b'], land: ['#9a7d54', '#6c553a'], sun: '#f1dfc4' },
  };
  const c = palettes[kind];
  const rx = radius * (200 / size);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ borderRadius: radius, display: 'block' }}
    >
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="200">
          <stop offset="0" stopColor={c.sky[0]} />
          <stop offset="1" stopColor={c.sky[1]} />
        </linearGradient>
        <linearGradient id={`land-${id}`} x1="0" y1="60" x2="0" y2="200">
          <stop offset="0" stopColor={c.land[0]} />
          <stop offset="1" stopColor={c.land[1]} />
        </linearGradient>
        <radialGradient id={`sun-${id}`} cx="50%" cy="40%" r="50%">
          <stop offset="0" stopColor={c.sun} stopOpacity="0.95" />
          <stop offset="0.5" stopColor={c.sun} stopOpacity="0.35" />
          <stop offset="1" stopColor={c.sun} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`mist-${id}`} cx="50%" cy="65%" r="65%">
          <stop offset="0" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id={`clip-${id}`}>
          <rect x="0" y="0" width="200" height="200" rx={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${id})`}>
        <rect width="200" height="200" fill={`url(#sky-${id})`} />
        <rect width="200" height="200" fill={`url(#sun-${id})`} />
        <ellipse cx="100" cy="105" rx="120" ry="20" fill="rgba(255,255,255,0.35)" />

        {kind === 'mountains' && (
          <>
            <path
              d="M0 130 L25 105 L55 125 L85 95 L120 120 L155 100 L200 115 L200 200 L0 200 Z"
              fill={c.land[0]}
              opacity="0.5"
            />
            <path
              d="M0 150 L30 125 L60 145 L95 110 L130 140 L165 120 L200 135 L200 200 L0 200 Z"
              fill={`url(#land-${id})`}
            />
            <rect x="0" y="160" width="200" height="40" fill={c.land[1]} opacity="0.45" />
            <circle cx="140" cy="68" r="14" fill={c.sun} opacity="0.85" />
            <circle cx="140" cy="68" r="22" fill={c.sun} opacity="0.25" />
          </>
        )}
        {kind === 'orb' && (
          <>
            <rect x="0" y="120" width="200" height="80" fill={c.land[0]} opacity="0.55" />
            <ellipse cx="100" cy="120" rx="120" ry="10" fill="rgba(255,255,255,0.55)" />
            <circle cx="100" cy="100" r="46" fill={c.sky[1]} opacity="0.7" />
            <circle cx="100" cy="100" r="46" fill={`url(#mist-${id})`} />
            <ellipse
              cx="85"
              cy="84"
              rx="22"
              ry="12"
              fill="rgba(255,255,255,0.75)"
              transform="rotate(-22 85 84)"
            />
            <circle
              cx="100"
              cy="100"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.8"
            />
          </>
        )}
        {kind === 'violin' && (
          <>
            <ellipse cx="100" cy="115" rx="80" ry="50" fill={c.sky[1]} opacity="0.35" />
            <g transform="translate(100 110) rotate(-12)">
              <path
                d="M0 -54 C 10 -54 14 -42 14 -32 C 14 -22 8 -18 8 -8 C 8 4 30 12 30 32 C 30 50 16 60 0 60 C -16 60 -30 50 -30 32 C -30 12 -8 4 -8 -8 C -8 -18 -14 -22 -14 -32 C -14 -42 -10 -54 0 -54 Z"
                fill={c.land[0]}
                opacity="0.85"
              />
              <rect x="-3" y="-50" width="6" height="78" fill={c.land[1]} opacity="0.45" />
              <line x1="-6" y1="26" x2="6" y2="26" stroke={c.land[1]} strokeWidth="1" />
            </g>
          </>
        )}
        {kind === 'sax' && (
          <>
            <circle cx="100" cy="100" r="80" fill={c.sun} opacity="0.4" />
            <g transform="translate(100 100)">
              <path
                d="M-32 -50 C -28 -56 -16 -56 -10 -48 L -6 -38"
                stroke={c.land[0]}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M-6 -38 L 2 28 C 4 44 18 50 32 46"
                stroke={c.land[0]}
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />
              <ellipse
                cx="40"
                cy="44"
                rx="14"
                ry="8"
                fill={c.land[0]}
                transform="rotate(-10 40 44)"
              />
              <ellipse
                cx="40"
                cy="44"
                rx="9"
                ry="4.5"
                fill={c.land[1]}
                transform="rotate(-10 40 44)"
              />
            </g>
          </>
        )}
        {kind === 'sunset' && (
          <>
            <circle cx="100" cy="125" r="38" fill={c.sun} opacity="0.7" />
            <circle cx="100" cy="125" r="50" fill={c.sun} opacity="0.3" />
            <path
              d="M0 140 Q 50 120 100 140 Q 150 160 200 140 L 200 200 L 0 200 Z"
              fill={c.land[0]}
              opacity="0.75"
            />
            <path
              d="M0 165 Q 60 155 100 165 Q 140 175 200 165 L 200 200 L 0 200 Z"
              fill={c.land[1]}
              opacity="0.8"
            />
          </>
        )}
        {kind === 'desert' && (
          <>
            <circle cx="150" cy="60" r="22" fill={c.sun} opacity="0.9" />
            <path
              d="M0 140 Q 60 110 110 130 Q 160 150 200 125 L 200 200 L 0 200 Z"
              fill={c.land[0]}
            />
            <path
              d="M0 165 Q 50 140 100 160 Q 150 180 200 155 L 200 200 L 0 200 Z"
              fill={c.land[1]}
              opacity="0.85"
            />
          </>
        )}
        {kind === 'piano' && (
          <>
            <rect x="0" y="60" width="200" height="120" fill={c.land[0]} opacity="0.4" />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x={12 + i * 22}
                y="70"
                width="20"
                height="110"
                fill={c.sun}
                opacity={0.92}
                stroke={c.land[1]}
                strokeWidth="0.5"
              />
            ))}
          </>
        )}
        {kind === 'forest' && (
          <>
            <rect x="0" y="120" width="200" height="80" fill={c.land[0]} opacity="0.5" />
            {[
              { x: 40, h: 80 },
              { x: 75, h: 110 },
              { x: 105, h: 95 },
              { x: 138, h: 120 },
              { x: 170, h: 90 },
            ].map((t, i) => (
              <path
                key={i}
                d={`M${t.x - 16} 170 L${t.x} ${170 - t.h} L${t.x + 16} 170 Z`}
                fill={c.land[1]}
                opacity={0.7 + (i % 2) * 0.2}
              />
            ))}
          </>
        )}
        {kind === 'blues' && (
          <>
            {[60, 90, 120, 150, 180].map((y, i) => (
              <path
                key={i}
                d={`M-10 ${y} Q 50 ${y - 16} 100 ${y} T 210 ${y}`}
                stroke={c.land[i % 2]}
                strokeWidth={2 - i * 0.2}
                fill="none"
                opacity={0.7 - i * 0.08}
              />
            ))}
          </>
        )}
        <rect width="200" height="200" fill={`url(#mist-${id})`} opacity="0.5" />
      </g>
    </svg>
  );
}
