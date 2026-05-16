import { z } from 'zod';

export const openAiTtsVoiceSchema = z.enum(['nova', 'shimmer', 'coral', 'marin']);

export type OpenAiTtsVoice = z.infer<typeof openAiTtsVoiceSchema>;

export const DEFAULT_OPENAI_TTS_VOICE: OpenAiTtsVoice = 'nova';

export const OPENAI_TTS_VOICE_OPTIONS: Array<{
  description: string;
  label: string;
  value: OpenAiTtsVoice;
}> = [
  {
    description: '溫暖清楚，適合日常 DJ 導聆。',
    label: 'Nova',
    value: 'nova',
  },
  {
    description: '柔和明亮，適合夜晚與輕鬆情境。',
    label: 'Shimmer',
    value: 'shimmer',
  },
  {
    description: '表情較明顯，適合有主持感的串場。',
    label: 'Coral',
    value: 'coral',
  },
  {
    description: '自然細緻，適合長一點的導聆。',
    label: 'Marin',
    value: 'marin',
  },
];
