export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { execSync } = await import('child_process');
    try {
      execSync('node_modules/.bin/prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (e) {
      console.error('[instrumentation] Prisma migrate deploy failed:', e);
    }
  }
}
