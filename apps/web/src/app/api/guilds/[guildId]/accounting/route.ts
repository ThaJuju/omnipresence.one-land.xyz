import { prisma } from '@repo/db'
import { ok, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler, ApiError } from '@/lib/api'
import { z } from 'zod'

const createSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  category: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  date: z.string(),
  note: z.string().optional(),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'accounting.view')

  const url = new URL(req.url)
  const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : undefined

  const entries = await prisma.accountingEntry.findMany({
    where: {
      guildId: params['guildId'],
      ...(year && {
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      }),
    },
    orderBy: { date: 'desc' },
  })

  return ok(entries)
})

export const POST = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'accounting.edit')

  const body = await req.json() as unknown
  const data = createSchema.parse(body)

  const entry = await prisma.accountingEntry.create({
    data: {
      guildId: params['guildId']!,
      ...data,
      date: new Date(data.date),
      createdBy: member.id,
    },
  })

  return ok(entry, 201)
})

export const DELETE = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'accounting.edit')

  const body = await req.json() as unknown
  const { entryId } = z.object({ entryId: z.string() }).parse(body)

  const entry = await prisma.accountingEntry.findFirst({
    where: { id: entryId, guildId: params['guildId'] },
  })
  if (!entry) throw new ApiError('Écriture introuvable', 404)

  await prisma.accountingEntry.delete({ where: { id: entryId } })

  return ok({ deleted: true })
})
