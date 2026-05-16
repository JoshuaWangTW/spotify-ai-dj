import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = mkdtempSync(join(tmpdir(), 'spotify-ai-dj-radio-tests-'));
const tscBin = join(process.cwd(), 'node_modules/typescript/bin/tsc');

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: join(process.cwd(), 'node_modules'),
    },
    shell: false,
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    if (result.error) {
      console.error(result.error);
    }
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} failed`);
  }
}

try {
  run(process.execPath, [
    tscBin,
    '--target',
    'ES2020',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--strict',
    '--rootDir',
    '.',
    '--outDir',
    tempDir,
    'scripts/test-dj-cache.ts',
    'scripts/test-dj-scheduler.ts',
    'scripts/test-radio.ts',
  ]);
  run(process.execPath, [join(tempDir, 'scripts/test-dj-cache.js')]);
  run(process.execPath, [join(tempDir, 'scripts/test-dj-scheduler.js')]);
  run(process.execPath, [join(tempDir, 'scripts/test-radio.js')]);
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
