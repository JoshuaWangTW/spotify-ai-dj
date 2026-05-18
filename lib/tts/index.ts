export type TtsProviderId = 'edge-tts' | 'azure' | 'openai' | 'browser-only';

export type TtsSynthesizeInput = {
  text: string;
  timeoutMs?: number;
  voiceId: string;
};

export type TtsSynthesizeOutput = {
  audioBuffer: Buffer;
  byteSize: number;
  contentType: 'audio/mpeg';
  duration: number;
};

export interface TtsProvider {
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput>;
}

export class TtsProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TtsProviderError';
    this.code = code;
  }
}

export function estimateSpeechDurationMs(text: string): number {
  const chineseChars = Array.from(text.trim()).filter((char) =>
    /\p{Script=Han}/u.test(char),
  ).length;
  const otherChars = Math.max(0, text.trim().length - chineseChars);

  return Math.max(800, Math.round(chineseChars * 240 + otherChars * 85));
}
