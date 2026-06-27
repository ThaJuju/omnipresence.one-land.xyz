import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
  discordGuildId: z.string(),
  memberIds: z.array(z.string()),
  reason: z.string().default('Absence non déclarée'),
  date: z.string(),
})

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const { discordGuildId, memberIds, reason, date } = schema.parse(body)

  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId },
    include: {
      config: true,
      warningThresholds: { orderBy: { threshold: 'asc' } },
    },
  })
  if (!guild) return ok({ error: 'Guild not found' })

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, guildId: guild.id },
  })

  await prisma.warning.createMany({
    data: members.map((m) => ({
      guildId: guild.id,
      memberId: m.id,
      reason,
      isAuto: true,
      issuedBy: 'SYSTEM',
    })),
  })

  const presenceDate = new Date(date)
  presenceDate.setUTCHours(0, 0, 0, 0)

  const thresholds = guild.warningThresholds
  const hasThresholds = thresholds.length > 0

  for (const member of members) {
    await prisma.presenceLog.upsert({
      where: { memberId_date: { memberId: member.id, date: presenceDate } },
      update: { status: 'ABSENT' },
      create: {
        guildId: guild.id,
        memberId: member.id,
        date: presenceDate,
        status: 'ABSENT',
        source: 'discord',
      },
    })

    // Count active warnings after adding the new one
    const activeCount = await prisma.warning.count({
      where: { memberId: member.id, guildId: guild.id, isActive: true },
    })

    try {
      const { botClient } = await import('@/lib/bot-client')

      if (hasThresholds) {
        // Apply all roles whose threshold has been reached
        for (const t of thresholds) {
          if (activeCount >= t.threshold) {
            await botClient.assignRole(discordGuildId, member.discordUserId, t.discordRoleId)
          }
        }
      } else if (guild.config?.warningRoleId) {
        // Legacy: single warning role
        await botClient.assignRole(discordGuildId, member.discordUserId, guild.config.warningRoleId)
      }
    } catch { /* bot may be offline */ }
  }

  return ok({ created: members.length })
})
