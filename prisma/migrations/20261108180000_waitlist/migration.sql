-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_languageCode_idx" ON "WaitlistEntry"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_languageCode_email_key" ON "WaitlistEntry"("languageCode", "email");
