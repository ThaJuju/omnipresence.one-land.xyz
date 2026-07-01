import { prisma } from '@repo/db'

export type SuperAdminAccess =
  | { isDev: true; guildIds: null }
  | { isDev: false; guildIds: string[] }

export async function getSuperAdminAccess(discordId: string | undefined): Promise<SuperAdminAccess | null> {
  if (!discordId) return null
  if (discordId === process.env['SUPERADMIN_DISCORD_ID']) return { isDev: true, guildIds: null }

  const memberships = await prisma.superAdminGroupMember.findMany({
    where: { discordUserId: discordId },
    select: { group: { select: { guilds: { select: { guildId: true } } } } },
  })
  const guildIds = [...new Set(memberships.flatMap((m) => m.group.guilds.map((g) => g.guildId)))]
  return guildIds.length > 0 ? { isDev: false, guildIds } : null
}
