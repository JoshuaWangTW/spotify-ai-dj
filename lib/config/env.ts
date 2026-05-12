import 'server-only';

import {
  parseServerEnv,
  requireServerEnv,
  type EnvValidationIssue,
  type ServerEnv,
} from './env-core';

export { EnvValidationError, type EnvValidationIssue, type ServerEnv } from './env-core';

export function getServerEnv(): ServerEnv {
  return requireServerEnv(process.env);
}

export function validateServerEnv():
  | { success: true; data: ServerEnv }
  | { success: false; issues: EnvValidationIssue[] } {
  return parseServerEnv(process.env);
}
