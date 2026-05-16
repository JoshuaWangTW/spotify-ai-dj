-- AlterTable
ALTER TABLE "User" ADD COLUMN "djPersonaId" TEXT;

-- CreateTable
CREATE TABLE "DjScriptCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DjScriptCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TtsAudioCache" (
    "id" TEXT NOT NULL,
    "scriptHash" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TtsAudioCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DjScriptCache_cacheKey_key" ON "DjScriptCache"("cacheKey");

-- CreateIndex
CREATE INDEX "DjScriptCache_userId_lastUsedAt_idx" ON "DjScriptCache"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TtsAudioCache_scriptHash_key" ON "TtsAudioCache"("scriptHash");

-- CreateIndex
CREATE INDEX "TtsAudioCache_lastUsedAt_idx" ON "TtsAudioCache"("lastUsedAt");

-- AddForeignKey
ALTER TABLE "DjScriptCache" ADD CONSTRAINT "DjScriptCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
