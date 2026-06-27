import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { z } from 'zod'
import type { PanelRole } from '@repo/db'
import { resolvePanelRole } from '@/lib/auth'

const schema = z.object({
  discordUserId: z.string(),
  discordGuildId: z.string(),
  discordUsername: z.string(),
  discordAvatar: z.string().nullable().optional(),
  discordNickname: z.string().nullable().optional(),
  discordRoleIds: z.array(z.string()),
  isAdministrator: z.boolean().optional(),
})

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const data = schema.parse(body)

  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: data.discordGuildId },
  })
  if (!guild) return ok({ error: 'Guild not found' })

  const panelRole = await resolvePanelRole(data.discordUserId, guild.id, data.discordRoleIds, data.isAdministrator)

  const member = await prisma.member.upsert({
    where: { guildId_discordUserId: { guildId: guild.id, discordUserId: data.discordUserId } },
    update: {
      discordUsername: data.discordUsername,
      discordAvatar: data.discordAvatar ?? null,
      discordNickname: data.discordNickname ?? null,
      panelRole,
      lastSeenAt: new Date(),
      isActive: true,
    },
    create: {
      guildId: guild.id,
      discordUserId: data.discordUserId,
      discordUsername: data.discordUsername,
      discordAvatar: data.discordAvatar ?? null,
      discordNickname: data.discordNickname ?? null,
      panelRole,
    },
  })

  return ok(member)
})
