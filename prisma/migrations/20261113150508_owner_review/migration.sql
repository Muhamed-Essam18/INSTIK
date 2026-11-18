-- CreateEnum
CREATE TYPE "PauseKind" AS ENUM ('PAUSED', 'RESUMED');

-- CreateEnum
CREATE TYPE "EmailOutcome" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "TranscriptSegment" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pausedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "reviewChecks" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "CreatorPauseEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PauseKind" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPauseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionEmail" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "outcome" "EmailOutcome" NOT NULL,
    "failure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorPauseEvent_userId_createdAt_idx" ON "CreatorPauseEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionEmail_eventId_key" ON "DecisionEmail"("eventId");

-- AddForeignKey
ALTER TABLE "CreatorPauseEvent" ADD CONSTRAINT "CreatorPauseEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPauseEvent" ADD CONSTRAINT "CreatorPauseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
