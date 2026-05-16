'use client';

import { useEffect, useState } from 'react';

import LlmModelPicker from '../../components/llm/LlmModelPicker';
import type { ANTHROPIC_MODEL_OPTIONS, OPENAI_MODEL_OPTIONS } from '../../lib/llm/model-options';

type SettingsData = {
  issueCount: number;
  anthropicConfigured: boolean;
  anthropicDefaultModel: string;
  anthropicModelOptions: typeof ANTHROPIC_MODEL_OPTIONS;
  llmProvider: 'openai' | 'anthropic' | null;
  ok: boolean;
  openAiDefaultModel: string;
  openAiModelOptions: typeof OPENAI_MODEL_OPTIONS;
  openAiConfigured: boolean;
  spotifyConfigured: boolean;
} | null;

type PersonaOption = {
  id: string;
  name: string;
};

function StatusRow({ configured, label }: { configured: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/80 bg-white/40 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
          configured
            ? 'border-sky-300/40 bg-sky-100/70 text-sky-700'
            : 'border-rose-300/50 bg-rose-50 text-rose-700'
        }`}
      >
        {configured ? '已設定' : '未設定'}
      </span>
    </div>
  );
}

export default function SettingsClient({ initialData }: { initialData: SettingsData }) {
  const hasEnvIssues = !initialData?.ok;
  const [personaId, setPersonaId] = useState('midnight');
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaStatus, setPersonaStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/settings/persona', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { personaId?: unknown; personas?: unknown } | null) => {
        if (cancelled || !body) {
          return;
        }

        if (typeof body.personaId === 'string') {
          setPersonaId(body.personaId);
        }

        if (Array.isArray(body.personas)) {
          setPersonas(
            body.personas.filter(
              (persona): persona is PersonaOption =>
                typeof persona === 'object' &&
                persona !== null &&
                typeof (persona as PersonaOption).id === 'string' &&
                typeof (persona as PersonaOption).name === 'string',
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersonaStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePersona(nextPersonaId: string) {
    setPersonaId(nextPersonaId);
    setPersonaStatus('saving');

    try {
      const response = await fetch('/api/settings/persona', {
        body: JSON.stringify({ personaId: nextPersonaId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Persona update failed.');
      }

      setPersonaStatus('saved');
    } catch {
      setPersonaStatus('error');
    }
  }

  return (
    <div className="glass-panel space-y-5 rounded-lg p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Server environment</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Spotify 與 LLM secret 只能由 server environment variables 提供。
        </p>
      </div>

      <div className="space-y-3">
        <StatusRow
          configured={Boolean(initialData?.spotifyConfigured)}
          label="Spotify Client ID / Client Secret / Redirect URI"
        />
        <StatusRow configured={Boolean(initialData?.openAiConfigured)} label="OpenAI API key" />
        <StatusRow
          configured={Boolean(initialData?.anthropicConfigured)}
          label="Anthropic API key"
        />
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-white/40 px-4 py-3 text-sm leading-6 text-slate-500">
        <p>LLM provider：{initialData?.llmProvider ?? '未設定'}</p>
        <p className="mt-1">Server default model：{initialData?.openAiDefaultModel ?? 'gpt-4o'}</p>
        <p className="mt-1">
          Anthropic default model：{initialData?.anthropicDefaultModel ?? 'claude-sonnet-4-6'}
        </p>
        {hasEnvIssues ? (
          <p className="mt-1 text-rose-200">
            目前 server environment 有 {initialData?.issueCount ?? 1} 個缺漏或無效設定。
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-white/40 p-4">
        <LlmModelPicker />
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-white/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">DJ persona</h3>
            <p className="mt-1 text-sm text-slate-500">影響預生成串場詞的語氣與說話方式。</p>
          </div>
          <span className="text-xs text-slate-400">
            {personaStatus === 'saving'
              ? '儲存中'
              : personaStatus === 'saved'
                ? '已儲存'
                : personaStatus === 'error'
                  ? '儲存失敗'
                  : ''}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {personas.map((persona) => (
            <button
              className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${
                personaId === persona.id
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-300 bg-white/70 text-slate-700 hover:border-sky-500 hover:bg-sky-50'
              }`}
              key={persona.id}
              onClick={() => void updatePersona(persona.id)}
              type="button"
            >
              {persona.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
