-- CreateEnum
CREATE TYPE "RevenueSourceKind" AS ENUM ('MANUAL', 'GATEWAY');

-- CreateEnum
CREATE TYPE "MonthStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('PAID', 'REVERSAL');

-- CreateEnum
CREATE TYPE "GrantKind" AS ENUM ('GRANTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "GrantReason" AS ENUM ('TESTING', 'CREATOR', 'GIFT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "manualAccessAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CountedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "videoId" TEXT NOT NULL,
    "creatorId" TEXT,
    "day" DATE NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL,
    "monthKey" TEXT NOT NULL,
    "warsawDay" DATE NOT NULL,

    CONSTRAINT "CountedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRevenue" (
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL,
    "refundsCents" INTEGER NOT NULL,
    "source" "RevenueSourceKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRevenue_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "RevenueChange" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL,
    "refundsCents" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueAdjustment" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningsMonth" (
    "month" TEXT NOT NULL,
    "status" "MonthStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "currency" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL,
    "refundsCents" INTEGER NOT NULL,
    "adjustmentsCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "poolCents" INTEGER NOT NULL,
    "instikCents" INTEGER NOT NULL,
    "totalViews" INTEGER NOT NULL,

    CONSTRAINT "EarningsMonth_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "CreatorEarning" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "creatorId" TEXT,
    "creatorName" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "earningsCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "CreatorEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "creatorId" TEXT,
    "kind" "PayoutKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesId" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrantEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GrantKind" NOT NULL,
    "reason" "GrantReason" NOT NULL,
    "note" TEXT,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGrantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRequest" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ContentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountedView_creatorId_monthKey_idx" ON "CountedView"("creatorId", "monthKey");

-- CreateIndex
CREATE INDEX "CountedView_creatorId_warsawDay_idx" ON "CountedView"("creatorId", "warsawDay");

-- CreateIndex
CREATE INDEX "CountedView_videoId_monthKey_idx" ON "CountedView"("videoId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "CountedView_userId_videoId_day_key" ON "CountedView"("userId", "videoId", "day");

-- CreateIndex
CREATE INDEX "RevenueChange_month_at_idx" ON "RevenueChange"("month", "at");

-- CreateIndex
CREATE INDEX "RevenueAdjustment_month_at_idx" ON "RevenueAdjustment"("month", "at");

-- CreateIndex
CREATE INDEX "CreatorEarning_creatorId_idx" ON "CreatorEarning"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorEarning_month_creatorId_key" ON "CreatorEarning"("month", "creatorId");

-- CreateIndex
CREATE INDEX "Payout_month_creatorId_idx" ON "Payout"("month", "creatorId");

-- CreateIndex
CREATE INDEX "AccessGrantEvent_userId_at_idx" ON "AccessGrantEvent"("userId", "at");

-- CreateIndex
CREATE INDEX "ContentRequest_status_createdAt_idx" ON "ContentRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CountedView" ADD CONSTRAINT "CountedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountedView" ADD CONSTRAINT "CountedView_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantEvent" ADD CONSTRAINT "AccessGrantEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantEvent" ADD CONSTRAINT "AccessGrantEvent_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
