-- AlterTable
ALTER TABLE "GuildConfig"
ADD COLUMN     "presenceEmbedTime" TEXT,
ADD COLUMN     "presencePingRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing single ping role into the new array column before dropping it
UPDATE "GuildConfig"
SET "presencePingRoleIds" = ARRAY["presencePingRoleId"]
WHERE "presencePingRoleId" IS NOT NULL;

ALTER TABLE "GuildConfig" DROP COLUMN "presencePingRoleId";
