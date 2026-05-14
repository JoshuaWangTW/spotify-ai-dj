'use client';

type SettingsData = {
  issueCount: number;
  llmProvider: 'openai' | 'anthropic' | null;
  ok: boolean;
  openAiConfigured: boolean;
  spotifyConfigured: boolean;
} | null;

function StatusRow({
  configured,
  label,
}: {
  configured: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-500/20 bg-slate-950/20 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span
        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
          configured
            ? 'border-sky-200/30 bg-sky-200/10 text-sky-100'
            : 'border-rose-300/30 bg-rose-400/10 text-rose-100'
        }`}
      >
        {configured ? '已設定' : '未設定'}
      </span>
    </div>
  );
}

export default function SettingsClient({ initialData }: { initialData: SettingsData }) {
  const hasEnvIssues = !initialData?.ok;

  return (
    <div className="glass-panel space-y-5 rounded-lg p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">Server environment</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Spotify 與 LLM secret 只能由 server environment variables 提供。
        </p>
      </div>

      <div className="space-y-3">
        <StatusRow
          configured={Boolean(initialData?.spotifyConfigured)}
          label="Spotify Client ID / Client Secret / Redirect URI"
        />
        <StatusRow configured={Boolean(initialData?.openAiConfigured)} label="OpenAI API key" />
      </div>

      <div className="rounded-lg border border-slate-500/20 bg-slate-950/20 px-4 py-3 text-sm leading-6 text-slate-400">
        <p>LLM provider：{initialData?.llmProvider ?? '未設定'}</p>
        {hasEnvIssues ? (
          <p className="mt-1 text-rose-200">
            目前 server environment 有 {initialData?.issueCount ?? 1} 個缺漏或無效設定。
          </p>
        ) : null}
      </div>
    </div>
  );
}
