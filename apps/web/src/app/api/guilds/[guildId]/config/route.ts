import { prisma } from '@repo/db'
import { ok, err, getSessionOrThrow, getGuildMember, requirePermission, withApiHandler } from '@/lib/api'
import { z } from 'zod'

const patchSchema = z.object({
  panelName: z.string().min(1).max(50).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().optional(),
  presenceMessageTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  warningCheckTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  presenceEnabled: z.boolean().optional(),
  warningEnabled: z.boolean().optional(),
  contributionEnabled: z.boolean().optional(),
  accountingEnabled: z.boolean().optional(),
  vdaEnabled: z.boolean().optional(),
  presenceChannelId: z.string().nullable().optional(),
  warningChannelId: z.string().nullable().optional(),
  notificationChannelId: z.string().nullable().optional(),
  logChannelId: z.string().nullable().optional(),
  contributionAmount: z.number().positive().nullable().optional(),
  contributionCurrency: z.string().length(3).optional(),
})

export const GET = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'settings.view')

  const config = await prisma.guildConfig.findUnique({ where: { guildId: params['guildId'] } })
  return ok(config)
})

export const PATCH = withApiHandler(async (req, { params }) => {
  const session = await getSessionOrThrow()
  const member = await getGuildMember(params['guildId']!, session.user.discordId)
  requirePermission(member.panelRole, 'settings.edit')

  const body = await req.json() as unknown
  const data = patchSchema.parse(body)

  const config = await prisma.guildConfig.upsert({
    where: { guildId: params['guildId'] },
    update: data,
    create: { guildId: params['guildId']!, ...data },
  })

  await prisma.auditLog.create({
    data: {
      guildId: params['guildId']!,
      adminId: member.id,
      action: 'CONFIG_UPDATED',
      after: data as never,
    },
  })

  return ok(config)
})
