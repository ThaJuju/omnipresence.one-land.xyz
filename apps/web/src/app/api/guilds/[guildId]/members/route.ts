import { NextRequest } from 'next/server'
import { prisma } from '@repo/db'
import { ok, err, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'
import { z } from 'zod'

const getHandler = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'members.view')

  const members = await prisma.member.findMany({
    where: { guildId: params['guildId'] },
    include: { grade: true },
    orderBy: { discordUsername: 'asc' },
  })

  return ok(members)
})

export const GET = getHandler
