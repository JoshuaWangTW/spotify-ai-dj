-- CreateTable
CREATE TABLE "RadioSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mode" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "programmingContext" JSONB NOT NULL,
    "currentSegmentIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadioSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadioSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "djIntro" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "trackQueries" TEXT[],
    "queuedTrackUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadioEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "segmentId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadioSession_userId_status_idx" ON "RadioSession"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RadioSegment_sessionId_index_key" ON "RadioSegment"("sessionId", "index");

-- CreateIndex
CREATE INDEX "RadioSegment_sessionId_idx" ON "RadioSegment"("sessionId");

-- CreateIndex
CREATE INDEX "RadioEvent_sessionId_createdAt_idx" ON "RadioEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RadioEvent_segmentId_idx" ON "RadioEvent"("segmentId");

-- AddForeignKey
ALTER TABLE "RadioSession" ADD CONSTRAINT "RadioSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadioSegment" ADD CONSTRAINT "RadioSegment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RadioSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadioEvent" ADD CONSTRAINT "RadioEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RadioSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadioEvent" ADD CONSTRAINT "RadioEvent_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "RadioSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
