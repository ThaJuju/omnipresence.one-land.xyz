import { prisma } from '@repo/db'
import { getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'
import { NextResponse } from 'next/server'

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'presences.view')

  const url = new URL(req.url)
  const monthsBack = Math.min(parseInt(url.searchParams.get('months') ?? '3'), 12)
  const since = new Date()
  since.setMonth(since.getMonth() - monthsBack)

  const logs = await prisma.presenceLog.findMany({
    where: { guildId: params['guildId'], date: { gte: since } },
    include: { member: { select: { discordUsername: true, discordNickname: true } } },
    orderBy: [{ date: 'desc' }, { memberId: 'asc' }],
  })

  const STATUS_FR: Record<string, string> = { PRESENT: 'Présent', ABSENT: 'Absent', PENDING: 'En attente' }

  const rows = [
    ['Date', 'Nom Discord', 'Surnom', 'Statut'],
    ...logs.map((l) => [
      l.date.toISOString().split('T')[0]!,
      l.member.discordUsername,
      l.member.discordNickname ?? '',
      STATUS_FR[l.status] ?? l.status,
    ]),
  ]

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="presences_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
})
