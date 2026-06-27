import { prisma } from '@repo/db'
import { client } from '../client'
import { logger } from '../logger'
import { EmbedBuilder } from 'discord.js'
import { isSendableChannel } from '../channel-utils'
import { getBotT } from '../i18n/botTranslations'

export async function runMonthlyReport(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.monthlyReportEnabled) return
    const channelId = guild.config.reportChannelId ?? guild.config.logChannelId
    if (!channelId) return

    const t = getBotT(guild.config.botLanguage)
    const now = new Date()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const startOfMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)
    const endOfMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59)

    const [presenceLogs, absencesMonth, warningsMonth, contributionsMonth, accountingMonth, membersCount] = await Promise.all([
      prisma.presenceLog.findMany({
        where: { guildId, date: { gte: startOfMonth, lte: endOfMonth } },
        include: { member: { select: { discordNickname: true, discordUsername: true } } },
      }),
      prisma.absence.count({ where: { guildId, createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.warning.count({ where: { guildId, createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
      prisma.contribution.findMany({
        where: { guildId, month: prevMonth.getMonth() + 1, year: prevMonth.getFullYear() },
        select: { amount: true, currency: true },
      }),
      prisma.accountingEntry.findMany({
        where: { guildId, date: { gte: startOfMonth, lte: endOfMonth } },
        select: { type: true, amount: true },
      }),
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
      .map((m) => `${m.name} — ${m.present}/${m.total} (${Math.round((m.present / (m.total || 1)) * 100)}%)`)
      .join('\n')

    const income = accountingMonth.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
    const expense = accountingMonth.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
    const balance = income - expense
    const contribTotal = contributionsMonth.reduce((s, c) => s + c.amount, 0)
    const currency = contributionsMonth[0]?.currency ?? 'EUR'

    const monthName = startOfMonth.toLocaleDateString(t.presence.dateLocale, { month: 'long', year: 'numeric' })

    const financesLines = [
      contributionsMonth.length > 0 ? t.reports.contribLine(contribTotal, currency, contributionsMonth.length) : null,
      accountingMonth.length > 0 ? [
        t.reports.incomeLine(income),
        t.reports.expenseLine(expense),
        t.reports.balanceLine(balance),
      ].join('\n') : null,
    ].filter(Boolean).join('\n') || t.reports.noFinances

    const embed = new EmbedBuilder()
      .setTitle(t.reports.monthlyTitle)
      .setDescription(`**${monthName[0]!.toUpperCase() + monthName.slice(1)}**`)
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
          inline: false,
        },
        {
          name: t.reports.absencesField,
          value: t.reports.absencesMonth(absencesMonth),
          inline: true,
        },
        {
          name: t.reports.warningsField,
          value: t.reports.warningsMonth(warningsMonth),
          inline: true,
        },
        {
          name: t.reports.financesField,
          value: financesLines,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: guild.config.panelName ?? guild.discordGuildName })

    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) return
    await channel.send({ embeds: [embed] })
    logger.info({ guildId }, 'Monthly report sent')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to send monthly report')
  }
}
