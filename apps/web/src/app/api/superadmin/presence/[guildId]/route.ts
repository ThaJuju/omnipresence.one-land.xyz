import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'

export async function GET(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (session.user.discordId !== process.env['SUPERADMIN_DISCORD_ID']) {
    return NextResponse.json({ error: 'Interdit' }, { status: 403 })
  }

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Paramètre date invalide' }, { status: 400 })
  }

  const dayStart = new Date(date + 'T00:00:00.000Z')
  const dayEnd   = new Date(date + 'T23:59:59.999Z')

  // Fetch all active members + their log for that day (same logic as normal presences dashboard)
  const members = await prisma.member.findMany({
    where: { guildId: params.guildId, isActive: true },
    select: {
      id: true,
      discordUsername: true,
      discordNickname: true,
      discordAvatar: true,
      discordUserId: true,
      presenceLogs: {
        where: { date: { gte: dayStart, lte: dayEnd } },
        select: { status: true },
        take: 1,
      },
    },
    orderBy: { discordUsername: 'asc' },
  })

  type Entry = { id: string; name: string; avatar: string | null }
  const present: Entry[] = []
  const absent:  Entry[] = []
  const pending: Entry[] = []

  for (const m of members) {
    const entry: Entry = {
      id:     m.id,
      name:   m.discordNickname ?? m.discordUsername,
      avatar: m.discordAvatar,
    }
    const status = m.presenceLogs[0]?.status ?? 'PENDING'
    if (status === 'PRESENT') present.push(entry)
    else if (status === 'ABSENT') absent.push(entry)
    else pending.push(entry)
  }

  return NextResponse.json({ present, absent, pending })
}
