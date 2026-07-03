import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { botClient } from '@/lib/bot-client'
import { avatarUrl } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  discordUserId: z.string(),
  discordGuildId: z.string(),
  reason: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
})

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const { discordUserId, discordGuildId, reason, startDate, endDate } = schema.parse(body)

  const guild = await prisma.guildInstance.findUnique({ where: { discordGuildId } })
  if (!guild) return ok({ error: 'Guild not found' })

  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId: guild.id, discordUserId } },
  })
  if (!member) return ok({ error: 'Member not found' })

  const start = new Date(startDate)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setUTCHours(0, 0, 0, 0)

  const absence = await prisma.absence.create({
    data: {
      guildId: guild.id,
      memberId: member.id,
      reason,
      startDate: start,
      endDate: end,
      status: 'PENDING',
      source: 'discord',
    },
  })

  await prisma.presenceLog.upsert({
    where: { memberId_date: { memberId: member.id, date: start } },
    update: { status: 'ABSENT', source: 'discord' },
    create: {
      guildId: guild.id,
      memberId: member.id,
      date: start,
      status: 'ABSENT',
      source: 'discord',
    },
  })

  // Notification Discord (silencieuse si canal non configuré ou bot hors ligne)
  try {
    await botClient.notifyAbsence({
      guildId: guild.id,
      absenceId: absence.id,
      memberName: member.discordNickname ?? member.discordUsername,
      memberAvatarUrl: avatarUrl(member.discordUserId, member.discordAvatar),
      reason,
      startDate: start.toISOString().split('T')[0]!,
      endDate: end.toISOString().split('T')[0]!,
      source: 'discord',
    })
  } catch { /* bot hors ligne ou canal non configuré */ }

  return ok(absence, 201)
})
