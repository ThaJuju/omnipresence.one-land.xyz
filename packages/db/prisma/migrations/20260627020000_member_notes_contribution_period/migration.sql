-- AlterTable Member: add notes field
ALTER TABLE "Member"
  ADD COLUMN "notes" TEXT;

-- AlterTable Contribution: add periodType, week, day fields
ALTER TABLE "Contribution"
  ADD COLUMN "periodType" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN "week"       INTEGER,
  ADD COLUMN "day"        INTEGER;
