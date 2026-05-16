import 'server-only';

import { TtsProviderError, type TtsProvider, type TtsSynthesizeInput } from './index';

export class EdgeTtsProvider implements TtsProvider {
  synthesize(_input: TtsSynthesizeInput): Promise<never> {
    return Promise.reject(
      new TtsProviderError(
        'EDGE_TTS_UNAVAILABLE',
        'edge-tts is not installed in this deployment; falling back to the next provider.',
      ),
    );
  }
}
