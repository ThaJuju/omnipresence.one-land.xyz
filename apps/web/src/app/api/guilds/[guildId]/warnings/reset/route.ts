import { prisma } from '@repo/db'
import { getSessionOrThrow, getGuildMember, requirePermission, ApiError } from '@/lib/api'

export const DELETE = async (req: Request, { params }: { params: { guildId: string } }) => {
  try {
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

    await prisma.auditLog.create({
      data: {
        guildId,
        adminId: member.id,
        action: 'WARNINGS_RESET',
        targetType: 'Guild',
        after: { membersAffected: memberIds.length },
      },
    })

    const roleIdsToRemove = [
      ...thresholds.map((t) => t.discordRoleId),
      ...(config?.warningRoleId ? [config.warningRoleId] : []),
    ]

    const encoder = new TextEncoder()
    const send = (controller: ReadableStreamDefaultController, data: object) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          send(controller, { type: 'start', total: affectedMembers.length })

          if (roleIdsToRemove.length > 0 && affectedMembers.length > 0) {
            const { botClient } = await import('@/lib/bot-client')
            let done = 0
            for (const m of affectedMembers) {
              for (const roleId of roleIdsToRemove) {
                try {
                  await botClient.removeRole(discordGuildId, m.discordUserId, roleId)
                } catch { /* bot offline ou membre parti */ }
                await new Promise((r) => setTimeout(r, 400))
              }
              done++
              send(controller, { type: 'progress', done, total: affectedMembers.length })
            }
          }

          send(controller, { type: 'done', reset: memberIds.length })
        } catch (error) {
          send(controller, { type: 'error', message: String(error) })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status })
    }
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), { status: 500 })
  }
}
