import { ActivityType } from 'discord.js'
import { prisma } from '@repo/db'
import { client } from './client'
import { logger } from './logger'

export function applyCustomStatus(status: string | null) {
  if (!client.user) return
  if (status) {
    client.user.setPresence({
      activities: [{ name: 'custom', type: ActivityType.Custom, state: status }],
    })
  } else {
    client.user.setPresence({ activities: [] })
  }
}

// Le statut personnalisé est perdu à chaque reconnexion — on le restaure depuis la base
export async function restoreBotProfile() {
  try {
    const profile = await prisma.botProfile.findUnique({ where: { id: 'default' } })
    if (profile?.customStatus) {
      applyCustomStatus(profile.customStatus)
      logger.info('Custom status restored from database')
    }
  } catch (error) {
    logger.error({ error }, 'Failed to restore bot profile')
  }
}
