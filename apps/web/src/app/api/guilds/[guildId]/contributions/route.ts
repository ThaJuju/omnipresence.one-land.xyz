import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'

const createSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  note: z.string().optional(),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'contributions.view')

  const contributions = await prisma.contribution.findMany({
    where: { guildId: params['guildId'] },
    include: { member: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  return ok(contributions)
})

export const POST = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'contributions.add')

  const body = await req.json() as unknown
  const data = createSchema.parse(body)

  const contribution = await prisma.contribution.create({
    data: {
      guildId: params['guildId']!,
      ...data,
      createdBy: member.id,
    },
  })

  return ok(contribution, 201)
})

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'contributions.delete')

  const body = await req.json() as unknown
  const { contributionId } = z.object({ contributionId: z.string() }).parse(body)

  const contribution = await prisma.contribution.findFirst({
    where: { id: contributionId, guildId: params['guildId'] },
  })
  if (!contribution) throw new ApiError('Cotisation introuvable', 404)

  await prisma.contribution.delete({ where: { id: contributionId } })

  return ok({ deleted: true })
})
