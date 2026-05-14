#!/bin/sh
set -e
echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy
echo "Migrations complete. Starting Next.js..."
exec node_modules/.bin/next start
