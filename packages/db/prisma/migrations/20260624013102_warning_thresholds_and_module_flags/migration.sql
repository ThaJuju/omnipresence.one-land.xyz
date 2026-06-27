-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN     "absenceEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoWarningEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WarningThreshold" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "discordRoleId" TEXT NOT NULL,

    CONSTRAINT "WarningThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarningThreshold_guildId_threshold_key" ON "WarningThreshold"("guildId", "threshold");

-- AddForeignKey
ALTER TABLE "WarningThreshold" ADD CONSTRAINT "WarningThreshold_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
