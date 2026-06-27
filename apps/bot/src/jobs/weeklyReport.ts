import { prisma } from '@repo/db'
import { client } from '../client'
import { logger } from '../logger'
import { EmbedBuilder } from 'discord.js'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export async function runWeeklyReport(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.weeklyReportEnabled) return
    const channelId = guild.config.reportChannelId ?? guild.config.logChannelId
    if (!channelId) return

    const t = getBotT(guild.config.botLanguage)
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setUTCHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const [presenceLogs, absencesThisWeek, warningsThisWeek, membersCount] = await Promise.all([
      prisma.presenceLog.findMany({
        where: { guildId, date: { gte: monday, lte: sunday } },
        include: { member: { select: { discordNickname: true, discordUsername: true } } },
      }),
      prisma.absence.count({ where: { guildId, createdAt: { gte: monday, lte: sunday } } }),
      prisma.warning.count({ where: { guildId, createdAt: { gte: monday, lte: sunday } } }),
      prisma.member.count({ where: { guildId, isActive: true } }),
    ])

    const present = presenceLogs.filter((l) => l.status === 'PRESENT').length
    const total = presenceLogs.length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    const rateColor = rate >= 80 ? 0x23d160 : rate >= 50 ? 0xffdd57 : 0xff3860
    const rateBar = '█'.repeat(Math.round(rate / 10)) + '░'.repeat(10 - Math.round(rate / 10))

    const memberPresence = new Map<string, { name: string; present: number; total: number }>()
    for (const log of presenceLogs) {
      const name = log.member.discordNickname ?? log.member.discordUsername
      const cur = memberPresence.get(name) ?? { name, present: 0, total: 0 }
      cur.total++
      if (log.status === 'PRESENT') cur.present++
      memberPresence.set(name, cur)
    }
    const topMembers = [...memberPresence.values()]
      .sort((a, b) => b.present / (b.total || 1) - a.present / (a.total || 1))
      .slice(0, 5)
      .map((m) => `${m.name} — ${m.present}/${m.total}`)
      .join('\n')

    const mondayStr = monday.toLocaleDateString(t.presence.dateLocale, { day: 'numeric', month: 'short' })
    const sundayStr = sunday.toLocaleDateString(t.presence.dateLocale, { day: 'numeric', month: 'short' })

    const embed = new EmbedBuilder()
      .setTitle(t.reports.weeklyTitle)
      .setDescription(`**${mondayStr} – ${sundayStr}**`)
      .setColor(rateColor)
      .addFields(
        {
          name: t.reports.presenceField,
          value: t.reports.presenceValue(rateBar, rate, present, total, membersCount),
          inline: false,
        },
        {
          name: t.reports.topField,
          value: topMembers || t.reports.noData,
          inline: true,
        },
        {
          name: t.reports.absencesField,
          value: t.reports.absencesValue(absencesThisWeek),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: guild.config.panelName ?? guild.discordGuildName })

    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) return
    await channel.send({ embeds: [embed] })
    logger.info({ guildId }, 'Weekly report sent')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to send weekly report')
  }
}
