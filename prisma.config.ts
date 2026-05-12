import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
