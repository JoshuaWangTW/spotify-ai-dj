import 'server-only';

import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __spotifyAiDjPrisma?: PrismaClient;
};

const globalPrisma = globalThis as GlobalWithPrisma;

export const prisma = globalPrisma.__spotifyAiDjPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalPrisma.__spotifyAiDjPrisma = prisma;
}
