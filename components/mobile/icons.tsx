// components/mobile/icons.tsx
// Shared SVG icon set for the mobile shell. Keep stroke-based & inheritable.
'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Icon {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" /></Icon>
);
export const IconHomeFilled = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="currentColor"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z" strokeLinejoin="round" /></Icon>
);
export const IconCompass = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16 8 13 14 8 16 11 10 16 8" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconLibrary = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="6" height="18" rx="1" />
    <rect x="11" y="6" width="5" height="15" rx="1" />
    <path d="M18 7l3 13" />
  </Icon>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </Icon>
);
export const IconPlay = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></Icon>
);
export const IconPause = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </Icon>
);
export const IconPrev = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <polygon points="19 4 9 12 19 20 19 4" />
    <rect x="5" y="4" width="2.5" height="16" rx="1" />
  </Icon>
);
export const IconNext = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <polygon points="5 4 15 12 5 20 5 4" />
    <rect x="16.5" y="4" width="2.5" height="16" rx="1" />
  </Icon>
);
export const IconShuffle = (p: IconProps) => (
  <Icon {...p}>
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </Icon>
);
export const IconRepeat = (p: IconProps) => (
  <Icon {...p}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
);
export const IconHeart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Icon>
);
export const IconHeartFilled = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="currentColor">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>
);
export const IconMenu = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Icon>
);
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Icon>
);
export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3.5" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>
);
export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);
export const IconSpeaker = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <circle cx="12" cy="15" r="3" />
    <circle cx="12" cy="7" r="0.8" fill="currentColor" />
  </Icon>
);
export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconThumbsUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 22V10M2 13v7a2 2 0 0 0 2 2h13.5a2 2 0 0 0 2-1.7l1.4-7a2 2 0 0 0-2-2.3H14V5a3 3 0 0 0-3-3l-4 8v12" />
  </Icon>
);
