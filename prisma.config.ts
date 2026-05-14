import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types prisma/seed.ts',
  },
});
