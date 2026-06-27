import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'

const patchSchema = z.object({
  absenceId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'absences.view')

  const absences = await prisma.absence.findMany({
    where: { guildId: params['guildId'] },
    include: { member: true },
    orderBy: { createdAt: 'desc' },
  })

  return ok(absences)
})

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'absences.approve')

  const body = await req.json() as unknown
  const { absenceId, status } = patchSchema.parse(body)

  const absence = await prisma.absence.findFirst({
    where: { id: absenceId, guildId: params['guildId'] },
  })
  if (!absence) throw new ApiError('Absence introuvable', 404)

  const updated = await prisma.absence.update({
    where: { id: absenceId },
    data: { status, reviewedBy: member.id, reviewedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      guildId: params['guildId']!,
      adminId: member.id,
      action: `ABSENCE_${status}`,
      targetId: absenceId,
      targetType: 'Absence',
    },
  })

  return ok(updated)
})
