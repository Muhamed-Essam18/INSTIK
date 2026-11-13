-- Creator upload (spec 9): creator-supplied details, the current and pending video host files, submission flags and soft delete.
-- The append-only trigger on "VideoStatusEvent" from the creator content migration is deliberately untouched.

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "assetReadyAt" TIMESTAMP(3),
ADD COLUMN     "checklistAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "muxAssetId" TEXT,
ADD COLUMN     "muxUploadId" TEXT,
ADD COLUMN     "pendingAssetId" TEXT,
ADD COLUMN     "pendingDurationSeconds" INTEGER,
ADD COLUMN     "pendingFailure" TEXT,
ADD COLUMN     "pendingPlaybackId" TEXT,
ADD COLUMN     "pendingReadyAt" TIMESTAMP(3),
ADD COLUMN     "pendingStartedAt" TIMESTAMP(3),
ADD COLUMN     "pendingUploadId" TEXT,
ADD COLUMN     "proposedStage" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "uploadStartedAt" TIMESTAMP(3),
ALTER COLUMN "title" SET DEFAULT '',
ALTER COLUMN "stage" DROP NOT NULL,
ALTER COLUMN "topic" DROP NOT NULL,
ALTER COLUMN "durationSeconds" DROP NOT NULL,
ALTER COLUMN "access" SET DEFAULT 'FULL';

-- CreateIndex
CREATE INDEX "Video_hostId_updatedAt_idx" ON "Video"("hostId", "updatedAt");

