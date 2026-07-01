-- CreateTable
CREATE TABLE "SuperAdminGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminGroupGuild" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,

    CONSTRAINT "SuperAdminGroupGuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminGroupGuild_groupId_guildId_key" ON "SuperAdminGroupGuild"("groupId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminGroupMember_groupId_discordUserId_key" ON "SuperAdminGroupMember"("groupId", "discordUserId");

-- AddForeignKey
ALTER TABLE "SuperAdminGroupGuild" ADD CONSTRAINT "SuperAdminGroupGuild_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SuperAdminGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminGroupGuild" ADD CONSTRAINT "SuperAdminGroupGuild_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminGroupMember" ADD CONSTRAINT "SuperAdminGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SuperAdminGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
