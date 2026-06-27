ALTER TABLE "GuildConfig"
  ADD COLUMN "reportChannelId" TEXT,
  ADD COLUMN "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "monthlyReportEnabled" BOOLEAN NOT NULL DEFAULT false;
