-- AlterTable: absence embed fields, contribution period, bot language
ALTER TABLE "GuildConfig"
  ADD COLUMN "absenceChannelId"      TEXT,
  ADD COLUMN "absenceEmbedMessageId" TEXT,
  ADD COLUMN "absenceEmbedTitle"     TEXT,
  ADD COLUMN "absenceEmbedBody"      TEXT,
  ADD COLUMN "absenceEmbedLang"      TEXT NOT NULL DEFAULT 'fr',
  ADD COLUMN "absenceNotifChannelId" TEXT,
  ADD COLUMN "contributionPeriod"    TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN "botLanguage"           TEXT NOT NULL DEFAULT 'fr';
