import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'

const createSchema = z.object({
  memberId: z.string(),
  reason: z.string().min(1),
})

const revokeSchema = z.object({
  warningId: z.string(),
  revokeNote: z.string().optional(),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'warnings.view')

  const warnings = await prisma.warning.findMany({
    where: { guildId: params['guildId'] },
    include: { member: true },
    orderBy: { createdAt: 'desc' },
  })

  return ok(warnings)
})

export const POST = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'warnings.issue')

  const body = await req.json() as unknown
  const { memberId, reason } = createSchema.parse(body)

  const target = await prisma.member.findFirst({
    where: { id: memberId, guildId: params['guildId'] },
  })
  if (!target) throw new ApiError('Membre introuvable', 404)

  const warning = await prisma.warning.create({
    data: {
      guildId: params['guildId']!,
      memberId,
      reason,
      issuedBy: member.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      guildId: params['guildId']!,
      adminId: member.id,
      action: 'WARNING_ISSUED',
      targetId: memberId,
      targetType: 'Member',
      after: { reason },
    },
  })

  return ok(warning, 201)
})

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'warnings.revoke')

  const body = await req.json() as unknown
  const { warningId, revokeNote } = revokeSchema.parse(body)

  const warning = await prisma.warning.findFirst({
    where: { id: warningId, guildId: params['guildId'] },
  })
  if (!warning) throw new ApiError('Avertissement introuvable', 404)

  const updated = await prisma.warning.update({
    where: { id: warningId },
    data: { isActive: false, revokedBy: member.id, revokedAt: new Date(), revokeNote },
  })

  await prisma.auditLog.create({
    data: {
      guildId: params['guildId']!,
      adminId: member.id,
      action: 'WARNING_REVOKED',
      targetId: warningId,
      targetType: 'Warning',
    },
  })

  return ok(updated)
})
