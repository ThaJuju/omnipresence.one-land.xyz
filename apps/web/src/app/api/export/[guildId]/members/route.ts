import { prisma } from '@repo/db'
import { getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'
import { NextResponse } from 'next/server'
import { getLocale } from '@/i18n/server'
import { getT } from '@/i18n/translations'

export const GET = withApiHandler(async (_req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'members.view')

  const members = await prisma.member.findMany({
    where: { guildId: params['guildId'] },
    include: { grade: true },
    orderBy: [{ isActive: 'desc' }, { discordUsername: 'asc' }],
  })

  const csvT = getT(getLocale()).csv

  const rows = [
    csvT.memberHeaders,
    ...members.map((m) => [
      m.discordUsername,
      m.discordNickname ?? '',
      m.panelRole,
      m.grade?.name ?? '',
      m.isActive ? csvT.active : csvT.inactive,
      m.joinedAt.toISOString().split('T')[0]!,
    ]),
  ]

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="membres_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
})
