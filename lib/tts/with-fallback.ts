import 'server-only';

import type { ServerEnv } from '../config/env';
import { AzureSpeechProvider } from './azure-speech';
import { EdgeTtsProvider } from './edge-tts';
import type { TtsSynthesizeOutput } from './index';

export type TtsFallbackResult = {
  provider: 'edge-tts' | 'azure' | 'browser-only';
  result: TtsSynthesizeOutput | null;
};

export async function synthesizeWithFallback(input: {
  env: ServerEnv;
  text: string;
  timeoutMs?: number;
  voiceId: string;
}): Promise<TtsFallbackResult> {
  if (input.env.TTS_PROVIDER === 'browser-only') {
    return { provider: 'browser-only', result: null };
  }

  if (input.env.TTS_PROVIDER === 'edge-tts') {
    try {
      return {
        provider: 'edge-tts',
        result: await new EdgeTtsProvider().synthesize(input),
      };
    } catch {
      // Continue to Azure if configured.
    }
  }

  if (input.env.AZURE_SPEECH_KEY) {
    try {
      return {
        provider: 'azure',
        result: await new AzureSpeechProvider({
          apiKey: input.env.AZURE_SPEECH_KEY,
          region: input.env.AZURE_SPEECH_REGION,
        }).synthesize(input),
      };
    } catch {
      // Browser speech is the final fallback and runs on the client.
    }
  }

  return { provider: 'browser-only', result: null };
}
