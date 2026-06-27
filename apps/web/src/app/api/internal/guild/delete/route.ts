import { prisma } from '@repo/db'
import { ok, verifyInternalSecret, withApiHandler } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({ discordGuildId: z.string() })

export const POST = withApiHandler(async (req) => {
  await verifyInternalSecret(req)

  const body = await req.json() as unknown
  const { discordGuildId } = schema.parse(body)

  await prisma.guildInstance.updateMany({
    where: { discordGuildId },
    data: { isActive: false },
  })

  return ok({ deactivated: true })
})
