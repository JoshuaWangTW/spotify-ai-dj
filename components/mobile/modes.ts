// components/mobile/modes.ts
// Shared metadata for the five DJ modes. Cover paths point at files you
// dropped into public/covers/.
import type { AiDjMode } from '../../lib/radio/schema';
import type { AlbumArtKind } from './AlbumArtwork';

export type DjMode = {
  /** Maps directly to RadioStartInput.mode */
  id: AiDjMode;
  /** Short noun for chips / cards */
  shortLabel: string;
  /** Long-form label for headers */
  label: string;
  /** One-liner shown on Explore detail */
  hint: string;
  /** Painterly SVG fallback when coverSquareSrc is missing */
  art: AlbumArtKind;
  /** 1500×1500 cover image in public/covers/ */
  coverSquareSrc: string;
  /** 1400×1000 cover image in public/covers/ — for hero / detail cards */
  coverWideSrc: string;
  /** Default Chinese prompt suggestion shown on Mode Detail */
  defaultPrompt: string;
};

export const ASSISTANT_CUSTOM_MODE: DjMode = {
  id: 'auto',
  shortLabel: 'Custom',
  label: 'Choose Category',
  hint: '選擇既有分類，或建立一個新的聆聽分類',
  art: 'orb',
  coverSquareSrc: '/covers/focus-square.png',
  coverWideSrc: '/covers/focus-wide.png',
  defaultPrompt: '依照 Music Assistant 的建議建立一段新的 radio session。',
};

export const MODES: ReadonlyArray<DjMode> = [
  {
    id: 'jazz_intro',
    shortLabel: 'Jazz',
    label: 'Jazz Intro',
    hint: '導聆爵士入門到深度',
    art: 'sax',
    coverSquareSrc: '/covers/jazz-square.png',
    coverWideSrc: '/covers/jazz-wide.png',
    defaultPrompt: '今晚想聽爵士，像電台一樣慢慢接，不要太吵。',
  },
  {
    id: 'classical_intro',
    shortLabel: 'Classical',
    label: 'Classical Focus',
    hint: '古典樂導聆 + 樂章背景',
    art: 'violin',
    coverSquareSrc: '/covers/classical-square.png',
    coverWideSrc: '/covers/classical-wide.png',
    defaultPrompt: '想聽古典，幫我從小品慢慢進入，有點導聆。',
  },
  {
    id: 'work_focus',
    shortLabel: 'Focus',
    label: 'Work Focus',
    hint: '深度工作低干擾配樂',
    art: 'orb',
    coverSquareSrc: '/covers/focus-square.png',
    coverWideSrc: '/covers/focus-wide.png',
    defaultPrompt: '深度工作，最好沒有人聲，節奏穩定。',
  },
  {
    id: 'coffee_roasting',
    shortLabel: 'Coffee',
    label: 'Coffee Roasting',
    hint: '咖啡店 / 烘豆背景樂',
    art: 'desert',
    coverSquareSrc: '/covers/coffee-square.png',
    coverWideSrc: '/covers/coffee-wide.png',
    defaultPrompt: '烘豆中，需要中等節奏不要分心的背景樂。',
  },
  {
    id: 'dinner_store_background',
    shortLabel: 'Store',
    label: 'Dinner & Store',
    hint: '營業時段平靜背景',
    art: 'sunset',
    coverSquareSrc: '/covers/dinner-square.png',
    coverWideSrc: '/covers/dinner-wide.png',
    defaultPrompt: '營業時段，平靜不搶風頭的背景樂。',
  },
];

export function findMode(id: AiDjMode): DjMode | undefined {
  if (id === 'auto') return ASSISTANT_CUSTOM_MODE;
  return MODES.find((m) => m.id === id);
}
