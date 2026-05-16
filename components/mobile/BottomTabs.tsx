// components/mobile/BottomTabs.tsx
'use client';

import type { ComponentType } from 'react';
import { IconHome, IconHomeFilled, IconCompass, IconLibrary, IconUser } from './icons';

export type TabId = 'foryou' | 'explore' | 'library' | 'profile';

type IconCmp = ComponentType<{ size?: number; strokeWidth?: number }>;

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: IconCmp; iconActive?: IconCmp }> = [
  { id: 'foryou', label: 'For You', icon: IconHome, iconActive: IconHomeFilled },
  { id: 'explore', label: 'Explore', icon: IconCompass },
  { id: 'library', label: 'Library', icon: IconLibrary },
  { id: 'profile', label: 'Profile', icon: IconUser },
];

type Props = {
  active: TabId;
  onSelect: (id: TabId) => void;
};

export default function BottomTabs({ active, onSelect }: Props) {
  return (
    <nav
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 pt-2 pb-[max(env(safe-area-inset-bottom),16px)]"
      style={{
        background:
          'linear-gradient(to top, rgba(245,250,253,0.96) 50%, rgba(245,250,253,0.7) 80%, rgba(245,250,253,0))',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-1.5">
        {TABS.map((t) => {
          const isActive = active === t.id;
          const Ico = isActive && t.iconActive ? t.iconActive : t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3.5 py-1.5 transition-colors ${
                isActive ? 'bg-sky-200/50 text-sky-700' : 'text-slate-400'
              }`}
            >
              <Ico size={22} strokeWidth={isActive ? 2 : 1.8} />
              <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
