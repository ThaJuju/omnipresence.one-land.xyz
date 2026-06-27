import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, '*')

  const guildId = params['guildId']!
  const { discordGuildId } = member.guild

  const affectedMemberIds = await prisma.warning.findMany({
    where: { guildId, isActive: true },
    select: { memberId: true },
    distinct: ['memberId'],
  })

  const memberIds = affectedMemberIds.map((w) => w.memberId)

  await prisma.warning.updateMany({
    where: { guildId, isActive: true },
    data: {
      isActive: false,
      revokedBy: member.id,
      revokedAt: new Date(),
      revokeNote: 'Réinitialisation globale',
    },
  })

  const [thresholds, config, affectedMembers] = await Promise.all([
    prisma.warningThreshold.findMany({ where: { guildId }, select: { discordRoleId: true } }),
    prisma.guildConfig.findUnique({ where: { guildId }, select: { warningRoleId: true } }),
    prisma.member.findMany({
      where: { id: { in: memberIds }, guildId },
      select: { discordUserId: true },
    }),
  ])

  const roleIdsToRemove = [
    ...thresholds.map((t) => t.discordRoleId),
    ...(config?.warningRoleId ? [config.warningRoleId] : []),
  ]

  if (roleIdsToRemove.length > 0 && affectedMembers.length > 0) {
    const { botClient } = await import('@/lib/bot-client')
    for (const m of affectedMembers) {
      for (const roleId of roleIdsToRemove) {
        try {
          await botClient.removeRole(discordGuildId, m.discordUserId, roleId)
        } catch { /* bot offline or member left */ }
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      guildId,
      adminId: member.id,
      action: 'WARNINGS_RESET',
      targetType: 'Guild',
      after: { membersAffected: memberIds.length },
    },
  })

  return ok({ reset: memberIds.length })
})
