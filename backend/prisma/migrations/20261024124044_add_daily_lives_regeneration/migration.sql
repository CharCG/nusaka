-- AlterTable
ALTER TABLE "UserStats" ADD COLUMN     "lastLivesRegenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "UserStats_lastLivesRegenAt_userId_idx" ON "UserStats"("lastLivesRegenAt", "userId");
