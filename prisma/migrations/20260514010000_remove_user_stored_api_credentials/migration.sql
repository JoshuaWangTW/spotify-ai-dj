-- Server API credentials must come from environment variables, not user records.
ALTER TABLE "User" DROP COLUMN IF EXISTS "spotifyClientId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "spotifyClientSecret";
ALTER TABLE "User" DROP COLUMN IF EXISTS "openaiApiKey";
