import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
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

  const guild = await prisma.guildInstance.upsert({
    where: { discordGuildId: data.discordGuildId },
    update: {
      discordGuildName: data.discordGuildName,
      discordGuildIcon: data.discordGuildIcon ?? null,
      ownerId: data.ownerId,
      isActive: true,
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

  return ok(guild, 201)
})
