import { z } from 'zod';

const optionalSecretSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const optionalNumberSchema = z.preprocess((value) => {
  if (value === '' || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value;
}, z.number().optional());

const serverEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SPOTIFY_CLIENT_ID: z.string().min(1),
    SPOTIFY_CLIENT_SECRET: z.string().min(1),
    SPOTIFY_REDIRECT_URI: z.string().url(),
    OPENAI_API_KEY: optionalSecretSchema,
    OPENAI_MODEL: z.string().trim().min(1).max(80).optional(),
    ANTHROPIC_API_KEY: optionalSecretSchema,
    ANTHROPIC_MODEL: z.string().trim().min(1).max(80).optional(),
    LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
    NEXTAUTH_SECRET: z.string().min(1),
    REDIS_URL: optionalUrlSchema,
    TTS_PROVIDER: z.enum(['edge-tts', 'azure', 'browser-only']).default('browser-only'),
    AZURE_SPEECH_KEY: optionalSecretSchema,
    AZURE_SPEECH_REGION: z.string().trim().min(1).max(80).optional(),
    AUDIO_STORAGE_PROVIDER: z.enum(['zeabur-volume', 'r2', 'vercel-blob']).default('zeabur-volume'),
    DJ_AUDIO_CACHE_DIR: z.string().trim().min(1).max(260).optional(),
    R2_ACCOUNT_ID: optionalSecretSchema,
    R2_ACCESS_KEY_ID: optionalSecretSchema,
    R2_SECRET_ACCESS_KEY: optionalSecretSchema,
    R2_BUCKET_NAME: z.string().trim().min(1).max(120).optional(),
    DJ_CACHE_TTL_DAYS: optionalNumberSchema.pipe(z.number().int().min(1).max(365).default(30)),
    DJ_PREFETCH_TRIGGER_RATIO: optionalNumberSchema.pipe(
      z.number().min(0.1).max(0.95).default(0.5),
    ),
    ADMIN_CLEANUP_TOKEN: optionalSecretSchema,
    QIAOMU_GENRE_DB_DIR: z.string().trim().min(1).max(260).optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    const redirectUri = new URL(env.SPOTIFY_REDIRECT_URI);

    if (redirectUri.hostname === 'localhost' || redirectUri.hostname === '127.0.0.1') {
      context.addIssue({
        code: 'custom',
        message: 'Production Spotify redirect URI must not use localhost.',
        path: ['SPOTIFY_REDIRECT_URI'],
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationIssue = {
  code: 'MISSING_REQUIRED_CONFIG' | 'INVALID_CONFIG_VALUE';
  message: string;
};

export class EnvValidationError extends Error {
  readonly issues: EnvValidationIssue[];

  constructor(issues: EnvValidationIssue[]) {
    super('Server environment validation failed.');
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function formatEnvIssues(error: z.ZodError): EnvValidationIssue[] {
  return error.issues.map((issue) => {
    const code =
      issue.code === 'invalid_type' || issue.code === 'too_small'
        ? 'MISSING_REQUIRED_CONFIG'
        : 'INVALID_CONFIG_VALUE';

    return {
      code,
      message:
        code === 'MISSING_REQUIRED_CONFIG'
          ? 'A required server configuration value is missing.'
          : 'A server configuration value is invalid.',
    };
  });
}

export function parseServerEnv(
  env: Record<string, string | undefined>,
): { success: true; data: ServerEnv } | { success: false; issues: EnvValidationIssue[] } {
  const parsed = serverEnvSchema.safeParse(env);

  if (!parsed.success) {
    return {
      success: false,
      issues: formatEnvIssues(parsed.error),
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

export function requireServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const parsed = parseServerEnv(env);

  if (!parsed.success) {
    throw new EnvValidationError(parsed.issues);
  }

  return parsed.data;
}
