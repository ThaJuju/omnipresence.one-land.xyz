import { prisma } from '@repo/db'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { getBotT } from '../i18n/botTranslations'

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
      include: { member: true },
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

    const memberIds = pendingLogs
      .map((l) => l.member.id)
      .filter((id) => !absentMemberIds.has(id))

    if (memberIds.length === 0) return

    await callWeb('/api/internal/warning/bulk', {
      discordGuildId: guild.discordGuildId,
      memberIds,
      reason: t.warning.autoReason,
      date: today.toISOString(),
    })

    logger.info({ guildId, count: memberIds.length }, 'Auto-warnings created')
  } catch (error) {
    logger.error({ error, guildId }, 'Failed to run warning check')
  }
}
