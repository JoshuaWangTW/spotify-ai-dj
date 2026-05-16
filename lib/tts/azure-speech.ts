import 'server-only';

import { estimateSpeechDurationMs, TtsProviderError, type TtsProvider } from './index';

const DEFAULT_TIMEOUT_MS = 6_000;
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

function escapeSsml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml(input: { text: string; voiceId: string }): string {
  return [
    '<speak version="1.0" xml:lang="zh-TW">',
    `<voice xml:lang="zh-TW" name="${escapeSsml(input.voiceId)}">`,
    escapeSsml(input.text),
    '</voice>',
    '</speak>',
  ].join('');
}

export class AzureSpeechProvider implements TtsProvider {
  private readonly apiKey: string;
  private readonly region: string;

  constructor(input: { apiKey?: string; region?: string }) {
    if (!input.apiKey) {
      throw new TtsProviderError('AZURE_SPEECH_KEY_MISSING', 'Azure Speech key is not configured.');
    }

    this.apiKey = input.apiKey;
    this.region = input.region || 'eastasia';
  }

  async synthesize(input: { text: string; timeoutMs?: number; voiceId: string }): Promise<{
    audioBuffer: Buffer;
    byteSize: number;
    contentType: 'audio/mpeg';
    duration: number;
  }> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          body: buildSsml(input),
          headers: {
            'Content-Type': 'application/ssml+xml',
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'User-Agent': 'spotify-ai-dj',
            'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
          },
          method: 'POST',
          signal: abortController.signal,
        },
      );

      if (!response.ok) {
        throw new TtsProviderError('AZURE_SPEECH_REQUEST_FAILED', 'Azure Speech synthesis failed.');
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
        throw new TtsProviderError('AZURE_SPEECH_TIMEOUT', 'Azure Speech synthesis timed out.');
      }

      throw new TtsProviderError('AZURE_SPEECH_REQUEST_FAILED', 'Azure Speech synthesis failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
