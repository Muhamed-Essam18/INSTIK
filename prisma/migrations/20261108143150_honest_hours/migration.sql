-- AlterTable
ALTER TABLE "LearnerLanguage" ADD COLUMN     "chimedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "countedUntil" TIMESTAMP(3),
ADD COLUMN     "doneBlocks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "doneDay" DATE,
ADD COLUMN     "lateSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateWindowStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hourSound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remindersOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timeZone" TEXT;

-- CreateTable
CREATE TABLE "WatchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "videoSlug" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "seconds" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTime" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "videoSlug" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchSession_userId_languageCode_day_idx" ON "WatchSession"("userId", "languageCode", "day");

-- CreateIndex
CREATE UNIQUE INDEX "WatchSession_userId_languageCode_videoSlug_day_key" ON "WatchSession"("userId", "languageCode", "videoSlug", "day");

-- CreateIndex
CREATE INDEX "ManualTime_userId_languageCode_day_idx" ON "ManualTime"("userId", "languageCode", "day");

-- CreateIndex
CREATE INDEX "VideoProgress_userId_languageCode_updatedAt_idx" ON "VideoProgress"("userId", "languageCode", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoProgress_userId_languageCode_videoSlug_key" ON "VideoProgress"("userId", "languageCode", "videoSlug");

-- AddForeignKey
ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTime" ADD CONSTRAINT "ManualTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
