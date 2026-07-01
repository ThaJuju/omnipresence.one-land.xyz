import { prisma } from '@repo/db'
import { logger } from '../logger'

/** Relie chaque groupe superadmin à tout serveur dont le nom contient le nom du groupe. Additif uniquement. */
export async function runSuperAdminGroupSync() {
  try {
    const groups = await prisma.superAdminGroup.findMany({ select: { id: true, name: true } })
    let linked = 0

    for (const group of groups) {
      const name = group.name.trim()
      if (!name) continue

      const matches = await prisma.guildInstance.findMany({
        where: { discordGuildName: { contains: name, mode: 'insensitive' } },
        select: { id: true },
      })
      if (matches.length === 0) continue

      const result = await prisma.superAdminGroupGuild.createMany({
        data: matches.map((g) => ({ groupId: group.id, guildId: g.id })),
        skipDuplicates: true,
      })
      linked += result.count
    }

    if (linked > 0) logger.info({ linked }, 'Superadmin group auto-match: linked new guilds')
  } catch (error) {
    logger.error({ error }, 'Failed to run superadmin group sync')
  }
}
