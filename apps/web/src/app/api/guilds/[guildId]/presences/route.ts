import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'presences.view')

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  const presences = await prisma.presenceLog.findMany({
    where: {
      guildId: params['guildId'],
      ...(from && { date: { gte: new Date(from) } }),
      ...(to && { date: { lte: new Date(to) } }),
    },
    include: { member: { select: { id: true, discordUsername: true, discordNickname: true, discordAvatar: true, discordUserId: true } } },
    orderBy: { date: 'desc' },
  })

  return ok(presences)
})
