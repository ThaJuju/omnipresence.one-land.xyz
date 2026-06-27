import { auth } from '@/lib/auth'
import { prisma } from '@repo/db'
import { NextRequest, NextResponse } from 'next/server'
import { getGuildMember } from '@/lib/api'
import { avatarUrl } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { guildId: string } }) {
  const session = await auth()
  if (!session?.user?.discordId) return NextResponse.json([], { status: 401 })

  const { guildId } = params
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  try {
    await getGuildMember(guildId, session.user.discordId)
  } catch {
    return NextResponse.json([], { status: 403 })
  }

  const members = await prisma.member.findMany({
    where: {
      guildId,
      isActive: true,
      OR: [
        { discordUsername: { contains: q, mode: 'insensitive' } },
        { discordNickname: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      discordUserId: true,
      discordUsername: true,
      discordNickname: true,
      discordAvatar: true,
      panelRole: true,
    },
    take: 8,
  })

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      username: m.discordUsername,
      nickname: m.discordNickname,
      avatar: avatarUrl(m.discordUserId, m.discordAvatar),
      panelRole: m.panelRole,
    }))
  )
}
