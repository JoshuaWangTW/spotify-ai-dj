// components/mobile/screens/ProfileScreen.tsx
'use client';

import { useState } from 'react';
import { IconBell, IconCheck, IconChevronRight, IconSpark } from '../icons';
import type { SessionUser } from '../MobileShell';

type Props = {
  sessionUser: SessionUser | null;
};

export default function ProfileScreen({ sessionUser }: Props) {
  const [tts, setTts] = useState(true);
  const [autoQueue, setAutoQueue] = useState(true);

  const name = sessionUser?.displayName ?? 'Guest';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="px-0">
      <div className="px-5 pt-2 pb-2">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-slate-900">Profile</h1>
      </div>

      {/* User card */}
      <div className="px-5 pb-5">
        <div className="glass-panel flex items-center gap-3.5 rounded-3xl p-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-sky-900"
            style={{ background: 'linear-gradient(135deg, #bae6fd, #7dd3fc)' }}
          >
            {initial}
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold text-slate-800">{name}</div>
            <div className="text-[12.5px] text-slate-500">
              {sessionUser?.spotifyConnected ? 'Spotify connected' : 'Not signed in'}
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl bg-sky-200/60 px-3 py-1.5 text-xs font-semibold text-sky-900"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Spotify connection */}
      <div className="px-5 pb-5">
        <div className="glass-card flex items-center gap-3 rounded-2xl p-3.5">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              sessionUser?.spotifyConnected
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}
            style={{
              background: sessionUser?.spotifyConnected
                ? 'linear-gradient(135deg, #dcfce7, #86efac)'
                : 'linear-gradient(135deg, #fef3c7, #fde68a)',
            }}
          >
            <IconCheck size={22} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">
              {sessionUser?.spotifyConnected ? 'Spotify connected' : 'Connect Spotify'}
            </div>
            <div className="text-xs text-slate-500">
              {sessionUser?.spotifyConnected ? 'Premium account' : 'Required for AI DJ playback'}
            </div>
          </div>
          {sessionUser?.spotifyConnected ? (
            <IconChevronRight size={18} />
          ) : (
            <a
              href="/api/auth/spotify/login"
              className="aqua-button rounded-md px-3 py-2 text-xs font-semibold"
            >
              Connect
            </a>
          )}
        </div>
      </div>

      <SectionHeader title="DJ Settings" />
      <div className="flex flex-col gap-2 px-5 pb-5">
        <SettingsRow
          icon={<IconSpark size={18} />}
          label="DJ voice intro"
          subtitle="Speak each track's intro out loud"
          control={<Switch on={tts} onChange={() => setTts((v) => !v)} />}
        />
        <SettingsRow
          icon={<IconBell size={18} />}
          label="Auto-queue tracks"
          subtitle="AI fills your Spotify queue as you listen"
          control={<Switch on={autoQueue} onChange={() => setAutoQueue((v) => !v)} />}
        />
      </div>

      <SectionHeader title="More" />
      <div className="flex flex-col gap-2 px-5">
        <SettingsRow
          icon={<IconChevronRight size={18} />}
          label="App settings"
          link="/settings"
          control={<IconChevronRight size={18} />}
        />
        <SettingsRow icon={<IconBell size={18} />} label="Notifications" control={<IconChevronRight size={18} />} />
      </div>

      <div className="px-5 pt-6">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="block w-full rounded-2xl bg-rose-100/60 px-4 py-3 text-center text-sm font-semibold text-rose-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 px-5">
      <h3 className="m-0 text-[17px] font-semibold text-slate-700">{title}</h3>
    </div>
  );
}

function SettingsRow({
  icon, label, subtitle, control, link,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  control: React.ReactNode;
  link?: string;
}) {
  const inner = (
    <div className="glass-card flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left">
      <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-sky-200/50 text-sky-900">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
  if (link) {
    return <a href={link}>{inner}</a>;
  }
  return inner;
}

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="relative h-[26px] w-11 rounded-full transition-colors"
      style={{
        background: on ? 'linear-gradient(135deg, #7dd3fc, #0284c7)' : '#cbd5e1',
      }}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]"
        style={{ left: on ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
      />
    </button>
  );
}
