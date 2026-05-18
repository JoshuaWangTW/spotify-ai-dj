import 'server-only';

import { estimateSpeechDurationMs, TtsProviderError, type TtsProvider } from './index';

const DEFAULT_TIMEOUT_MS = 8_000;

const VOICE_MAP: Record<string, string> = {
  coral: 'coral',
  marin: 'nova',
  nova: 'nova',
  shimmer: 'shimmer',
};

export class OpenAiTtsProvider implements TtsProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(input: { text: string; timeoutMs?: number; voiceId: string }): Promise<{
    audioBuffer: Buffer;
    byteSize: number;
    contentType: 'audio/mpeg';
    duration: number;
  }> {
    const voice = VOICE_MAP[input.voiceId] ?? 'nova';
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        body: JSON.stringify({
          input: input.text,
          model: 'tts-1-hd',
          response_format: 'mp3',
          voice,
        }),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new TtsProviderError('OPENAI_TTS_REQUEST_FAILED', 'OpenAI TTS synthesis failed.');
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      return {
        audioBuffer,
        byteSize: audioBuffer.byteLength,
        contentType: 'audio/mpeg',
        duration: estimateSpeechDurationMs(input.text),
      };
    } catch (error) {
      if (error instanceof TtsProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TtsProviderError('OPENAI_TTS_TIMEOUT', 'OpenAI TTS synthesis timed out.');
      }

      throw new TtsProviderError('OPENAI_TTS_REQUEST_FAILED', 'OpenAI TTS synthesis failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
