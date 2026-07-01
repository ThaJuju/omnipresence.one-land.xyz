import { prisma } from '@repo/db'
import { logger } from '../logger'

const GRACE_PERIOD_DAYS = 14

/** Supprime définitivement (cascade) les serveurs sans le bot depuis plus de GRACE_PERIOD_DAYS. */
export async function runCleanupStaleGuilds() {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS)

    const staleGuilds = await prisma.guildInstance.findMany({
      where: { isActive: false, deactivatedAt: { lte: cutoff } },
      select: { id: true, discordGuildId: true, discordGuildName: true, deactivatedAt: true },
    })

    for (const guild of staleGuilds) {
      await prisma.guildInstance.delete({ where: { id: guild.id } })
      logger.warn(
        { guildId: guild.id, discordGuildId: guild.discordGuildId, name: guild.discordGuildName, deactivatedAt: guild.deactivatedAt },
        'Permanently deleted stale guild (bot absent for over 14 days)'
      )
    }

    if (staleGuilds.length > 0) {
      logger.info({ count: staleGuilds.length }, 'Stale guild cleanup complete')
    }
  } catch (error) {
    logger.error({ error }, 'Failed to run stale guild cleanup')
  }
}
