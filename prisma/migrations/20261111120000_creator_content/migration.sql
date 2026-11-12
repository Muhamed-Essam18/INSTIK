-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEARNER', 'CREATOR');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'UPLOADING', 'PROCESSING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "VideoAccess" AS ENUM ('FREE', 'FULL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'LEARNER';

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameArabic" TEXT,
    "story" TEXT NOT NULL,
    "topics" TEXT[],
    "photo" TEXT,
    "order" INTEGER NOT NULL,
    "userId" TEXT,
    "sample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleArabic" TEXT,
    "stage" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "access" "VideoAccess" NOT NULL,
    "playbackId" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "sample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "end" DOUBLE PRECISION NOT NULL,
    "script" TEXT NOT NULL,
    "transliteration" TEXT,
    "english" TEXT,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryEntry" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "audio" TEXT,

    CONSTRAINT "GlossaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoStatusEvent" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "fromStatus" "VideoStatus",
    "toStatus" "VideoStatus" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorInvite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CreatorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Host_userId_key" ON "Host"("userId");

-- CreateIndex
CREATE INDEX "Host_languageCode_idx" ON "Host"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "Host_languageCode_slug_key" ON "Host"("languageCode", "slug");

-- CreateIndex
CREATE INDEX "Video_languageCode_status_idx" ON "Video"("languageCode", "status");

-- CreateIndex
CREATE INDEX "Video_hostId_idx" ON "Video"("hostId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_languageCode_slug_key" ON "Video"("languageCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptSegment_videoId_position_key" ON "TranscriptSegment"("videoId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryEntry_languageCode_entryKey_key" ON "GlossaryEntry"("languageCode", "entryKey");

-- CreateIndex
CREATE INDEX "VideoStatusEvent_videoId_createdAt_idx" ON "VideoStatusEvent"("videoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorInvite_tokenHash_key" ON "CreatorInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CreatorInvite_email_idx" ON "CreatorInvite"("email");

-- AddForeignKey
ALTER TABLE "Host" ADD CONSTRAINT "Host_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStatusEvent" ADD CONSTRAINT "VideoStatusEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoStatusEvent" ADD CONSTRAINT "VideoStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInvite" ADD CONSTRAINT "CreatorInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInvite" ADD CONSTRAINT "CreatorInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Status history is append-only: refuse any UPDATE or DELETE of a status event, so the rule holds even for code outside the app.
-- (A whole video can only disappear by cascade if this trigger is dropped on purpose; no code path deletes videos.)
CREATE OR REPLACE FUNCTION "refuse_status_event_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'VideoStatusEvent is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "VideoStatusEvent_append_only"
BEFORE UPDATE OR DELETE ON "VideoStatusEvent"
FOR EACH ROW EXECUTE FUNCTION "refuse_status_event_change"();
