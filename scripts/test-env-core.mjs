import assert from 'node:assert/strict';

import { EnvValidationError, parseServerEnv, requireServerEnv } from '../lib/config/env-core.ts';

const validEnv = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/spotify_ai_dj',
  SPOTIFY_CLIENT_ID: 'spotify-client-id',
  SPOTIFY_CLIENT_SECRET: 'spotify-client-secret',
  SPOTIFY_REDIRECT_URI: 'http://localhost:3000/api/auth/spotify/callback',
  OPENAI_API_KEY: 'openai-api-key',
  ANTHROPIC_API_KEY: '',
  LLM_PROVIDER: 'openai',
  NEXTAUTH_SECRET: 'nextauth-secret',
  REDIS_URL: '',
  NODE_ENV: 'test',
};

function testValidEnv() {
  const result = parseServerEnv(validEnv);

  assert.equal(result.success, true);

  if (result.success) {
    assert.equal(result.data.LLM_PROVIDER, 'openai');
    assert.equal(result.data.ANTHROPIC_API_KEY, undefined);
    assert.equal(result.data.REDIS_URL, undefined);
  }
}

function testMissingRequiredFields() {
  const result = parseServerEnv({
    ...validEnv,
    SPOTIFY_CLIENT_SECRET: '',
    OPENAI_API_KEY: '',
  });

  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(result.issues.length, 2);
    assert.deepEqual(
      result.issues.map((issue) => issue.code),
      ['MISSING_REQUIRED_CONFIG', 'MISSING_REQUIRED_CONFIG'],
    );
    assert.equal(
      result.issues.some((issue) => JSON.stringify(issue).includes('OPENAI_API_KEY')),
      false,
    );
    assert.equal(
      result.issues.some((issue) => JSON.stringify(issue).includes('SPOTIFY_CLIENT_SECRET')),
      false,
    );
  }
}

function testStructuredError() {
  assert.throws(
    () =>
      requireServerEnv({
        ...validEnv,
        NEXT_PUBLIC_APP_URL: 'not-a-url',
      }),
    (error) => {
      assert.ok(error instanceof EnvValidationError);
      assert.deepEqual(error.issues, [
        {
          code: 'INVALID_CONFIG_VALUE',
          message: 'A server configuration value is invalid.',
        },
      ]);
      return true;
    },
  );
}

function testProductionRejectsLocalhostRedirectUri() {
  const result = parseServerEnv({
    ...validEnv,
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://spotify-ai-dj.example.com',
    SPOTIFY_REDIRECT_URI: 'http://localhost:3000/api/auth/spotify/callback',
  });

  assert.equal(result.success, false);

  if (!result.success) {
    assert.deepEqual(result.issues, [
      {
        code: 'INVALID_CONFIG_VALUE',
        message: 'A server configuration value is invalid.',
      },
    ]);
  }
}

testValidEnv();
testMissingRequiredFields();
testStructuredError();
testProductionRejectsLocalhostRedirectUri();

console.log('env-core tests passed');
