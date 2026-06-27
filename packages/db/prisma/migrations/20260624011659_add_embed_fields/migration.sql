-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "embedColor" TEXT NOT NULL DEFAULT '#5865F2',
ADD COLUMN     "embedDescription" TEXT,
ADD COLUMN     "embedTitle" TEXT NOT NULL DEFAULT '✅ Confirmation de présence',
ADD COLUMN     "presencePingRoleId" TEXT;
