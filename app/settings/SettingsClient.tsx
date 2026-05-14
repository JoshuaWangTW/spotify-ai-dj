'use client';

import { useState } from 'react';

type SettingsData = {
  spotifyClientId: string | null;
  hasSpotifySecret: boolean;
  hasOpenaiKey: boolean;
} | null;

export default function SettingsClient({ initialData }: { initialData: SettingsData }) {
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [openaiStatus, setOpenaiStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveSpotify(e: React.FormEvent) {
    e.preventDefault();
    setSpotifyStatus(null);
    setLoading(true);

    try {
      const body: Record<string, string> = {};
      if (spotifyClientId) body.spotifyClientId = spotifyClientId;
      if (spotifyClientSecret) body.spotifyClientSecret = spotifyClientSecret;

      if (Object.keys(body).length === 0) {
        setSpotifyStatus('請輸入至少一個欄位');
        return;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSpotifyStatus(data.error ?? '儲存失敗');
      } else {
        setSpotifyStatus('已儲存');
        setSpotifyClientId('');
        setSpotifyClientSecret('');
      }
    } catch {
      setSpotifyStatus('網路錯誤');
    } finally {
      setLoading(false);
    }
  }

  async function saveOpenai(e: React.FormEvent) {
    e.preventDefault();
    setOpenaiStatus(null);
    setLoading(true);

    try {
      if (!openaiApiKey) {
        setOpenaiStatus('請輸入 API Key');
        return;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiApiKey }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setOpenaiStatus(data.error ?? '儲存失敗');
      } else {
        setOpenaiStatus('已儲存');
        setOpenaiApiKey('');
      }
    } catch {
      setOpenaiStatus('網路錯誤');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveSpotify} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Spotify 憑證</h2>
        {initialData?.spotifyClientId && (
          <p className="text-xs text-zinc-500">
            目前 Client ID：<span className="font-mono">{initialData.spotifyClientId}</span>
          </p>
        )}
        {initialData?.hasSpotifySecret && (
          <p className="text-xs text-zinc-500">Spotify Client Secret：已設定</p>
        )}
        <div className="space-y-1">
          <label htmlFor="spotifyClientId" className="block text-sm font-medium text-zinc-300">
            Spotify Client ID
          </label>
          <input
            id="spotifyClientId"
            type="text"
            value={spotifyClientId}
            onChange={(e) => setSpotifyClientId(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="留空則不更新"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="spotifyClientSecret" className="block text-sm font-medium text-zinc-300">
            Spotify Client Secret
          </label>
          <input
            id="spotifyClientSecret"
            type="password"
            value={spotifyClientSecret}
            onChange={(e) => setSpotifyClientSecret(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="留空則不更新"
          />
        </div>
        {spotifyStatus && (
          <p className={`text-sm ${spotifyStatus === '已儲存' ? 'text-emerald-400' : 'text-red-400'}`}>
            {spotifyStatus}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          儲存 Spotify 憑證
        </button>
      </form>

      <form onSubmit={saveOpenai} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">OpenAI API Key</h2>
        {initialData?.hasOpenaiKey && (
          <p className="text-xs text-zinc-500">OpenAI API Key：已設定</p>
        )}
        <div className="space-y-1">
          <label htmlFor="openaiApiKey" className="block text-sm font-medium text-zinc-300">
            API Key
          </label>
          <input
            id="openaiApiKey"
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="sk-..."
          />
        </div>
        {openaiStatus && (
          <p className={`text-sm ${openaiStatus === '已儲存' ? 'text-emerald-400' : 'text-red-400'}`}>
            {openaiStatus}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          儲存 OpenAI Key
        </button>
      </form>
    </div>
  );
}
