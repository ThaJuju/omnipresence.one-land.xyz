import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
  discordUserId: z.string(),
  discordGuildId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
  date: z.string().optional(),
  delayMinutes: z.number().int().positive().optional(),
})

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const { discordUserId, discordGuildId, status, date, delayMinutes } = schema.parse(body)

  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId },
  })
  if (!guild) return ok({ error: 'Guild not found' })

  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId: guild.id, discordUserId } },
  })
  if (!member) return ok({ error: 'Member not found' })

  const presenceDate = date ? new Date(date) : new Date()
  presenceDate.setUTCHours(0, 0, 0, 0)

  const log = await prisma.presenceLog.upsert({
    where: { memberId_date: { memberId: member.id, date: presenceDate } },
    update: { status, delayMinutes: delayMinutes ?? null, source: 'discord' },
    create: {
      guildId: guild.id,
      memberId: member.id,
      date: presenceDate,
      status,
      delayMinutes: delayMinutes ?? null,
      source: 'discord',
    },
  })

  return ok(log)
})
