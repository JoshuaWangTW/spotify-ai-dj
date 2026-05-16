import { cleanupDjCaches } from '../lib/dj/cache-cleanup';
import { prisma } from '../lib/db/prisma';

function readTtlDays(): number {
  const raw = process.env.DJ_CACHE_TTL_DAYS;

  if (!raw) {
    return 30;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : 30;
}

async function main() {
  const result = await cleanupDjCaches({ ttlDays: readTtlDays() });

  console.log(
    JSON.stringify(
      {
        ok: true,
        result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
