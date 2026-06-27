import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'

const createSchema = z.object({
  discordRoleId: z.string().min(1),
  panelRole: z.enum(['ADMIN', 'DIRECTION', 'RESPONSABLE', 'MODERATEUR', 'MEMBRE']),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'settings.view')

  const bindings = await prisma.discordRoleBinding.findMany({
    where: { guildId: params['guildId'] },
    orderBy: { panelRole: 'asc' },
  })

  return ok(bindings)
})

export const POST = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'settings.discord')

  const body = await req.json() as unknown
  const { discordRoleId, panelRole } = createSchema.parse(body)

  const binding = await prisma.discordRoleBinding.upsert({
    where: { guildId_discordRoleId: { guildId: params['guildId']!, discordRoleId } },
    update: { panelRole },
    create: { guildId: params['guildId']!, discordRoleId, panelRole },
  })

  return ok(binding, 201)
})

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'settings.discord')

  const body = await req.json() as unknown
  const { discordRoleId } = z.object({ discordRoleId: z.string() }).parse(body)

  const existing = await prisma.discordRoleBinding.findUnique({
    where: { guildId_discordRoleId: { guildId: params['guildId']!, discordRoleId } },
  })
  if (!existing) throw new ApiError('Binding introuvable', 404)

  await prisma.discordRoleBinding.delete({
    where: { guildId_discordRoleId: { guildId: params['guildId']!, discordRoleId } },
  })

  return ok({ deleted: true })
})
