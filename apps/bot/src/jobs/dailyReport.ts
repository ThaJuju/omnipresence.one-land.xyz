import { prisma } from '@repo/db'
import { client } from '../client'
import { logger } from '../logger'
import { EmbedBuilder } from 'discord.js'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export async function runDailyReport(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.dailyReportEnabled) return
    const channelId = guild.config.reportChannelId ?? guild.config.logChannelId
    if (!channelId) return

    const t = getBotT(guild.config.botLanguage)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const [presenceLogs, pendingAbsences, activeWarnings, membersCount] = await Promise.all([
      prisma.presenceLog.findMany({ where: { guildId, date: today } }),
      prisma.absence.count({ where: { guildId, status: 'PENDING' } }),
      prisma.warning.count({ where: { guildId, isActive: true } }),
      prisma.member.count({ where: { guildId, isActive: true } }),
    ])

    const present = presenceLogs.filter((l) => l.status === 'PRESENT').length
    const absent = presenceLogs.filter((l) => l.status === 'ABSENT').length
    const pending = presenceLogs.filter((l) => l.status === 'PENDING').length
    const total = presenceLogs.length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    const rateBar = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10))
    const rateColor = rate >= 80 ? 0x23d160 : rate >= 50 ? 0xffdd57 : 0xff3860

    const dateStr = today.toLocaleDateString(t.presence.dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    const embed = new EmbedBuilder()
      .setTitle(t.reports.dailyTitle)
      .setDescription(`**${dateStr}**`)
      .setColor(rateColor)
      .addFields(
        {
          name: t.reports.presenceField,
          value: t.reports.presenceValue(rateBar, rate, present, total, membersCount),
          inline: false,
        },
        {
          name: t.reports.absencesField,
          value: t.reports.absencesValue(pendingAbsences),
          inline: true,
        },
        {
          name: t.reports.warningsField,
          value: t.reports.warningsValue(activeWarnings),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: guild.config.panelName ?? guild.discordGuildName })

    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) return
    await channel.send({ embeds: [embed] })
    logger.info({ guildId }, 'Daily report sent')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to send daily report')
  }
}
