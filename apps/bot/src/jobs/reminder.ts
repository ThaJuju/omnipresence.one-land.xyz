import { prisma } from '@repo/db'
import { client } from '../client'
import { logger } from '../logger'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export async function runReminder(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.presenceChannelId) return
    if (!guild.config.presenceEnabled) return
    if (!guild.config.reminderEnabled) return

    const t = getBotT(guild.config.botLanguage)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const pendingLogs = await prisma.presenceLog.findMany({
      where: { guildId, date: today, status: 'PENDING' },
      include: { member: true },
    })

    if (pendingLogs.length === 0) return

    const channel = await client.channels.fetch(guild.config.presenceChannelId)
    if (!isSendableChannel(channel)) return

    const mentions = pendingLogs.map((l) => `<@${l.member.discordUserId}>`).join(' ')
    await channel.send(t.reminder.message(pendingLogs.length, mentions))

    logger.info({ guildId, count: pendingLogs.length }, 'Reminder sent')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to run reminder')
  }
}
