import SettingsClient from './SettingsClient';
import { validateServerEnv } from '../../lib/config/env';

export const dynamic = 'force-dynamic';

function getSettingsData():
  | {
      issueCount: number;
      llmProvider: 'openai' | 'anthropic' | null;
      ok: boolean;
      openAiConfigured: boolean;
      spotifyConfigured: boolean;
    }
  | null {
  const env = validateServerEnv();

  if (!env.success) {
    return {
      issueCount: env.issues.length,
      llmProvider: null,
      ok: false,
      openAiConfigured: false,
      spotifyConfigured: false,
    };
  }

  return {
    issueCount: 0,
    llmProvider: env.data.LLM_PROVIDER,
    ok: true,
    openAiConfigured: Boolean(env.data.OPENAI_API_KEY),
    spotifyConfigured: Boolean(
      env.data.SPOTIFY_CLIENT_ID &&
        env.data.SPOTIFY_CLIENT_SECRET &&
        env.data.SPOTIFY_REDIRECT_URI,
    ),
  };
}

export default function SettingsPage() {
  const data = getSettingsData();

  return (
    <div className="liquid-shell min-h-screen px-4 py-8 text-slate-700">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="glass-panel flex items-center justify-between rounded-lg px-5 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">設定</h1>
            <p className="mt-1 text-sm text-slate-500">檢查 server environment 狀態</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="aqua-link text-sm">
              返回首頁
            </a>
            <form action="/api/auth/logout" method="post">
              <button
                className="glass-control rounded-md px-3 py-1.5 text-sm text-slate-600 hover:border-sky-400/50 hover:text-white"
                type="submit"
              >
                登出
              </button>
            </form>
          </div>
        </div>

        <SettingsClient initialData={data} />

        <div className="glass-panel space-y-3 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800">連接 Spotify</h2>
          <p className="text-sm text-slate-500">
            確認 server environment 已設定 Spotify 憑證後，點擊下方按鈕進行 OAuth 授權。
          </p>
          <a
            href="/api/auth/spotify/login"
            className="aqua-button inline-block rounded-md px-4 py-2 text-sm font-semibold transition"
          >
            Connect Spotify
          </a>
        </div>
      </div>
    </div>
  );
}
