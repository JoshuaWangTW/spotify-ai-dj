import { cookies } from 'next/headers';
import SettingsClient from './SettingsClient';

async function getSettingsData() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/settings`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  return res.json() as Promise<{
    spotifyClientId: string | null;
    hasSpotifySecret: boolean;
    hasOpenaiKey: boolean;
  }>;
}

export default async function SettingsPage() {
  const data = await getSettingsData();

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">設定</h1>
            <p className="mt-1 text-sm text-zinc-400">管理你的 API 憑證</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
              返回首頁
            </a>
            <a
              href="/api/auth/logout"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white"
            >
              登出
            </a>
          </div>
        </div>

        <SettingsClient initialData={data} />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">連接 Spotify</h2>
          <p className="text-sm text-zinc-400">
            設定好 Spotify Client ID 與 Secret 後，點擊下方按鈕進行 OAuth 授權。
          </p>
          <a
            href="/api/auth/spotify/login"
            className="inline-block rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Connect Spotify
          </a>
        </div>
      </div>
    </div>
  );
}
