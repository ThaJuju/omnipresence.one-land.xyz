-- AlterTable
ALTER TABLE "GuildConfig" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Backfill: les configs déjà existantes ont déjà été configurées manuellement,
-- on ne veut pas leur imposer l'assistant de configuration rapide au prochain chargement.
UPDATE "GuildConfig" SET "onboardingCompletedAt" = "updatedAt" WHERE "onboardingCompletedAt" IS NULL;
