-- AlterTable: add auth and credential fields to User, make spotifyUserId and spotifyRefreshToken nullable
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "spotifyClientId" TEXT;
ALTER TABLE "User" ADD COLUMN "spotifyClientSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "openaiApiKey" TEXT;

-- Make spotifyUserId nullable (drop old unique constraint, alter column, recreate unique index)
DROP INDEX "User_spotifyUserId_key";
ALTER TABLE "User" ALTER COLUMN "spotifyUserId" DROP NOT NULL;
CREATE UNIQUE INDEX "User_spotifyUserId_key" ON "User"("spotifyUserId");

-- Make spotifyRefreshToken nullable
ALTER TABLE "User" ALTER COLUMN "spotifyRefreshToken" DROP NOT NULL;

-- CreateIndex for email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
