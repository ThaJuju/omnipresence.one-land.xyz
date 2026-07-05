import { prisma } from '@repo/db'
import { EmbedBuilder } from 'discord.js'
import { callWeb } from '../web-client'
import { client } from '../client'
import { isSendableChannel } from '../channel-utils'
import { logger } from '../logger'
import { getBotT, type BotTranslations } from '../i18n/botTranslations'

export async function runWarningCheck(guildId: string) {
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })
    if (!guild?.config?.warningEnabled) return
    if (!guild.config.autoWarningEnabled) return

    const t = getBotT(guild.config.botLanguage)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const pendingLogs = await prisma.presenceLog.findMany({
      where: { guildId, date: today, status: 'PENDING' },
      include: { member: { include: { grade: true } } },
    })

    if (pendingLogs.length === 0) return

    const approvedAbsences = await prisma.absence.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
        memberId: { in: pendingLogs.map((l) => l.member.id) },
      },
      select: { memberId: true },
    })

    const absentMemberIds = new Set(approvedAbsences.map((a) => a.memberId))

    const warnedMembers = pendingLogs
      .filter((l) => l.member.grade?.discordRoleId != null)
      .map((l) => l.member)
      .filter((m) => !absentMemberIds.has(m.id))

    if (warnedMembers.length === 0) return

    await callWeb('/api/internal/warning/bulk', {
      discordGuildId: guild.discordGuildId,
      memberIds: warnedMembers.map((m) => m.id),
      reason: t.warning.autoReason,
      date: today.toISOString(),
    })

    logger.info({ guildId, count: warnedMembers.length }, 'Auto-warnings created')

    await notifyAutoWarnings(guild.config, guild.discordGuildName, warnedMembers, today, t)
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to run warning check')
  }
}

type WarnedMember = { discordUserId: string; discordUsername: string; discordNickname: string | null }
type WarningNotifConfig = {
  guildId: string
  warningChannelId: string | null
  notificationChannelId: string | null
  panelName: string | null
}

const MAX_LISTED_MEMBERS = 25

async function notifyAutoWarnings(
  config: WarningNotifConfig,
  guildName: string,
  members: WarnedMember[],
  date: Date,
  t: BotTranslations
) {
  const channelId = config.warningChannelId ?? config.notificationChannelId
  if (!channelId) return

  try {
    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) return

    const dateStr = date.toLocaleDateString(t.presence.dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const listed = members.slice(0, MAX_LISTED_MEMBERS)
    const lines = listed.map((m) => `• <@${m.discordUserId}> (${m.discordNickname ?? m.discordUsername})`)
    if (members.length > listed.length) {
      lines.push(t.warning.notifMoreMembers(members.length - listed.length))
    }

    const embed = new EmbedBuilder()
      .setTitle(t.warning.notifTitle)
      .setDescription(t.warning.notifDesc(members.length, dateStr))
      .setColor(0xff3860)
      .addFields({ name: t.warning.notifMembersField, value: lines.join('\n') })
      .setTimestamp()
      .setFooter({ text: config.panelName ?? guildName })

    await channel.send({ embeds: [embed] })
    logger.info({ guildId: config.guildId, channelId }, 'Auto-warning notification sent')
  } catch (error) {
    logger.error({ error, guildId: config.guildId, channelId }, 'Failed to send auto-warning notification')
  }
}
