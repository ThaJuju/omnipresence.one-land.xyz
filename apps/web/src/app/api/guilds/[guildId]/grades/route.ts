import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'
import { botClient } from '@/lib/bot-client'
import { logger } from '@/lib/logger'

const assignSchema = z.object({
  memberId: z.string(),
  gradeId: z.string().nullable(),
  note: z.string().optional(),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'members.view')

  const grades = await prisma.grade.findMany({
    where: { guildId: params['guildId'] },
    include: { category: true, members: { select: { id: true } } },
    orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }],
  })

  return ok(grades)
})

export const POST = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const actor = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(actor.panelRole, 'members.grade.assign')

  const body = await req.json() as unknown
  const { memberId, gradeId, note } = assignSchema.parse(body)

  const targetMember = await prisma.member.findFirst({
    where: { id: memberId, guildId: params['guildId'] },
    include: { grade: true },
  })
  if (!targetMember) throw new ApiError('Membre introuvable', 404)

  const oldGrade = targetMember.grade
  const newGrade = gradeId
    ? await prisma.grade.findFirst({ where: { id: gradeId, guildId: params['guildId'] } })
    : null

  await prisma.member.update({ where: { id: memberId }, data: { gradeId } })

  if (gradeId) {
    await prisma.gradeHistory.create({
      data: { memberId, gradeId, assignedBy: actor.id, note },
    })
  }

  const guild = await prisma.guildInstance.findUnique({ where: { id: params['guildId'] } })
  if (guild) {
    try {
      if (oldGrade?.discordRoleId) {
        await botClient.removeRole(guild.discordGuildId, targetMember.discordUserId, oldGrade.discordRoleId)
      }
      if (newGrade?.discordRoleId) {
        await botClient.assignRole(guild.discordGuildId, targetMember.discordUserId, newGrade.discordRoleId)
      }
    } catch (error) {
      logger.error({ error }, 'Failed to sync grade role with Discord bot')
      await prisma.auditLog.create({
        data: {
          guildId: params['guildId']!,
          adminId: actor.id,
          action: 'GRADE_ROLE_SYNC_FAILED',
          targetId: memberId,
          after: { error: String(error) },
        },
      })
    }
  }

  await prisma.auditLog.create({
    data: {
      guildId: params['guildId']!,
      adminId: actor.id,
      action: 'GRADE_ASSIGNED',
      targetId: memberId,
      targetType: 'Member',
      before: { gradeId: oldGrade?.id },
      after: { gradeId },
    },
  })

  return ok({ success: true })
})
