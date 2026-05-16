'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_ANTHROPIC_MODEL,
  LLM_MODEL_STORAGE_KEY,
  LLM_PROVIDER_STORAGE_KEY,
  llmModelSchema,
  llmProviderSchema,
  resolveLlmModel,
  resolveLlmProvider,
  type LlmModel,
  type LlmProvider,
} from '../../lib/llm/model-options';

export type StoredLlmSelection = {
  llmModel: LlmModel;
  llmProvider: LlmProvider;
};

export function readStoredLlmSelection(): StoredLlmSelection {
  if (typeof window === 'undefined') {
    return {
      llmModel: resolveLlmModel(null, 'openai'),
      llmProvider: 'openai',
    };
  }

  const llmProvider = resolveLlmProvider(window.localStorage.getItem(LLM_PROVIDER_STORAGE_KEY));
  const llmModel = resolveLlmModel(window.localStorage.getItem(LLM_MODEL_STORAGE_KEY), llmProvider);

  return { llmModel, llmProvider };
}

export function readStoredLlmModel(): LlmModel {
  return readStoredLlmSelection().llmModel;
}

export function useLlmModelPreference() {
  const [llmProvider, setLlmProviderState] = useState<LlmProvider>('openai');
  const [llmModel, setLlmModelState] = useState<LlmModel>(resolveLlmModel(null, 'openai'));

  useEffect(() => {
    const stored = readStoredLlmSelection();
    setLlmProviderState(stored.llmProvider);
    setLlmModelState(stored.llmModel);
  }, []);

  const setLlmSelection = useCallback((nextProvider: string, nextModel: string) => {
    const parsedProvider = llmProviderSchema.safeParse(nextProvider);
    const parsedModel = llmModelSchema.safeParse(nextModel);

    if (!parsedProvider.success || !parsedModel.success) {
      return false;
    }

    window.localStorage.setItem(LLM_PROVIDER_STORAGE_KEY, parsedProvider.data);
    window.localStorage.setItem(LLM_MODEL_STORAGE_KEY, parsedModel.data);
    setLlmProviderState(parsedProvider.data);
    setLlmModelState(parsedModel.data);
    window.dispatchEvent(
      new CustomEvent('spotify-ai-dj:llm-model-changed', {
        detail: { model: parsedModel.data, provider: parsedProvider.data },
      }),
    );

    return true;
  }, []);

  const setLlmProvider = useCallback(
    (nextProvider: string) => {
      const parsed = llmProviderSchema.safeParse(nextProvider);

      if (!parsed.success) {
        return false;
      }

      const nextModel =
        parsed.data === 'anthropic' && llmProvider !== 'anthropic'
          ? DEFAULT_ANTHROPIC_MODEL
          : resolveLlmModel(llmModel, parsed.data);

      return setLlmSelection(parsed.data, nextModel);
    },
    [llmModel, llmProvider, setLlmSelection],
  );

  const setLlmModel = useCallback(
    (nextModel: string) => setLlmSelection(llmProvider, nextModel),
    [llmProvider, setLlmSelection],
  );

  return { llmModel, llmProvider, setLlmModel, setLlmProvider, setLlmSelection };
}
