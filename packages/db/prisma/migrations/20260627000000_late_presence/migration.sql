-- AlterEnum
ALTER TYPE "PresenceStatus" ADD VALUE 'LATE';

-- AlterTable
ALTER TABLE "PresenceLog" ADD COLUMN "delayMinutes" INTEGER;
