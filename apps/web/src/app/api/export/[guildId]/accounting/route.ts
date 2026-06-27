import { prisma } from '@repo/db'
import { getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'
import { NextResponse } from 'next/server'

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'accounting.view')

  const url = new URL(req.url)
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : new Date().getFullYear()

  const entries = await prisma.accountingEntry.findMany({
    where: {
      guildId: params['guildId'],
      date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
    orderBy: { date: 'desc' },
  })

  const TYPE_FR: Record<string, string> = { INCOME: 'Recette', EXPENSE: 'Dépense' }

  const rows = [
    ['Date', 'Type', 'Catégorie', 'Libellé', 'Montant (€)', 'Note'],
    ...entries.map((e) => [
      e.date.toISOString().split('T')[0]!,
      TYPE_FR[e.type] ?? e.type,
      e.category,
      e.label,
      (e.type === 'EXPENSE' ? -e.amount : e.amount).toFixed(2),
      e.note ?? '',
    ]),
  ]

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptabilite_${year}.csv"`,
    },
  })
})
