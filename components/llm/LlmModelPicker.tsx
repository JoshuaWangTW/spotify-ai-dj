'use client';

import { useEffect, useState } from 'react';

import {
  ANTHROPIC_MODEL_OPTIONS,
  OPENAI_MODEL_OPTIONS,
  llmModelSchema,
} from '../../lib/llm/model-options';
import { useLlmModelPreference } from './useLlmModelPreference';

type Props = {
  compact?: boolean;
};

export default function LlmModelPicker({ compact = false }: Props) {
  const { llmModel, llmProvider, setLlmModel, setLlmProvider, setLlmSelection } =
    useLlmModelPreference();
  const [customModel, setCustomModel] = useState(llmModel);
  const [error, setError] = useState<string | null>(null);
  const modelOptions = llmProvider === 'anthropic' ? ANTHROPIC_MODEL_OPTIONS : OPENAI_MODEL_OPTIONS;

  useEffect(() => {
    setCustomModel(llmModel);
  }, [llmModel]);

  function saveModel(nextModel: string) {
    const parsed = llmModelSchema.safeParse(nextModel);

    if (!parsed.success) {
      setError('Model id 只能包含英數字、-、_、.、:');
      return;
    }

    setError(null);
    setLlmModel(parsed.data);
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">LLM provider / model</p>
          {!compact ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              使用 server environment 裡的 API key；这里只保存 provider 與 model id。
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
          {llmProvider} / {llmModel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'openai', label: 'OpenAI' },
          { id: 'anthropic', label: 'Anthropic' },
        ].map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              setError(null);
              setLlmProvider(provider.id);
            }}
            className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
              llmProvider === provider.id
                ? 'border-sky-700 bg-sky-700 text-white'
                : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-400'
            }`}
          >
            {provider.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {modelOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setError(null);
              setLlmSelection(option.provider, option.id);
            }}
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              llmModel === option.id
                ? 'border-sky-700 bg-sky-700 text-white'
                : 'border-slate-200 bg-white/70 text-slate-700 hover:border-sky-400'
            }`}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={customModel}
          onChange={(event) => setCustomModel(event.target.value)}
          maxLength={80}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
          placeholder="自訂 model id"
        />
        <button
          type="button"
          onClick={() => saveModel(customModel)}
          className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-600 hover:bg-sky-50 hover:text-sky-800"
        >
          Save
        </button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
