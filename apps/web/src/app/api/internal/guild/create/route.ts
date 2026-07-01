import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { autoLinkGuildToMatchingGroups } from '@/lib/superadmin-group-match'
import { z } from 'zod'

const schema = z.object({
  discordGuildId: z.string(),
  discordGuildName: z.string(),
  discordGuildIcon: z.string().nullable().optional(),
  ownerId: z.string(),
})

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const data = schema.parse(body)

  const existing = await prisma.guildInstance.findUnique({
    where: { discordGuildId: data.discordGuildId },
    select: { id: true },
  })

  const guild = await prisma.guildInstance.upsert({
    where: { discordGuildId: data.discordGuildId },
    update: {
      discordGuildName: data.discordGuildName,
      discordGuildIcon: data.discordGuildIcon ?? null,
      ownerId: data.ownerId,
      isActive: true,
      deactivatedAt: null,
      isBanned: false,
    },
    create: {
      discordGuildId: data.discordGuildId,
      discordGuildName: data.discordGuildName,
      discordGuildIcon: data.discordGuildIcon ?? null,
      ownerId: data.ownerId,
    },
  })

  await prisma.guildConfig.upsert({
    where: { guildId: guild.id },
    update: {},
    create: { guildId: guild.id },
  })

  if (!existing) {
    await autoLinkGuildToMatchingGroups(guild.id, guild.discordGuildName)
  }

  return ok(guild, 201)
})
