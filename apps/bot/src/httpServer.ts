import express from 'express'
import { client } from './client'
import { logger } from './logger'
import { z } from 'zod'
import { isSendableChannel } from './channel-utils'
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, DiscordAPIError } from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT, type BotTranslations } from './i18n/botTranslations'

async function langForDiscordGuild(discordGuildId?: unknown): Promise<string> {
  if (typeof discordGuildId !== 'string' || !discordGuildId) return 'fr'
  try {
    const config = await prisma.guildConfig.findFirst({
      where: { guild: { discordGuildId } },
      select: { botLanguage: true },
    })
    return config?.botLanguage ?? 'fr'
  } catch {
    return 'fr'
  }
}

async function langForGuild(guildId?: unknown): Promise<string> {
  if (typeof guildId !== 'string' || !guildId) return 'fr'
  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { botLanguage: true },
    })
    return config?.botLanguage ?? 'fr'
  } catch {
    return 'fr'
  }
}

function discordErrorMessage(error: unknown, t: BotTranslations = getBotT('fr')): string {
  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50001:
        return t.discordErrors.noAccess
      case 50013:
        return t.discordErrors.noPermission
      case 50007:
        return t.discordErrors.dmClosed
      case 10003:
        return t.discordErrors.channelNotFound
      case 10008:
        return t.discordErrors.messageNotFound
      case 50035:
        return t.discordErrors.invalidData
      default:
        return t.discordErrors.generic(error.code, error.message)
    }
  }
  if (error instanceof Error) return error.message
  return String(error)
}

const app = express()
app.use(express.json())

function verifySecret(req: express.Request, res: express.Response): boolean {
  const secret = req.headers['x-internal-secret']
  if (secret !== process.env['BOT_INTERNAL_SECRET']) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

const assignRoleSchema = z.object({
  discordGuildId: z.string(),
  discordUserId: z.string(),
  discordRoleId: z.string(),
})

app.post('/assign-role', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { discordGuildId, discordUserId, discordRoleId } = assignRoleSchema.parse(req.body)
    const guild = await client.guilds.fetch(discordGuildId)
    const member = await guild.members.fetch(discordUserId)
    await member.roles.add(discordRoleId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'assign-role failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForDiscordGuild(req.body?.discordGuildId))) })
  }
})

app.post('/remove-role', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { discordGuildId, discordUserId, discordRoleId } = assignRoleSchema.parse(req.body)
    const guild = await client.guilds.fetch(discordGuildId)
    const member = await guild.members.fetch(discordUserId)
    await member.roles.remove(discordRoleId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'remove-role failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForDiscordGuild(req.body?.discordGuildId))) })
  }
})

const sendMessageSchema = z.object({
  discordGuildId: z.string(),
  channelId: z.string(),
  content: z.string(),
})

app.post('/send-message', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { channelId, content } = sendMessageSchema.parse(req.body)
    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) {
      const t = getBotT(await langForDiscordGuild(req.body?.discordGuildId))
      return res.status(400).json({ error: t.discordErrors.notSendable })
    }
    await channel.send(content)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'send-message failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForDiscordGuild(req.body?.discordGuildId))) })
  }
})

const mentionSchema = z.object({
  discordGuildId: z.string(),
  channelId: z.string(),
  discordUserIds: z.array(z.string()),
  content: z.string().optional(),
})

app.post('/mention-members', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { channelId, discordUserIds, content } = mentionSchema.parse(req.body)
    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) {
      const t = getBotT(await langForDiscordGuild(req.body?.discordGuildId))
      return res.status(400).json({ error: t.discordErrors.notSendable })
    }
    const mentions = discordUserIds.map((id) => `<@${id}>`).join(' ')
    await channel.send(`${mentions}${content ? ` — ${content}` : ''}`)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'mention-members failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForDiscordGuild(req.body?.discordGuildId))) })
  }
})

const reloadConfigSchema = z.object({ discordGuildId: z.string() })

app.post('/reload-config', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { discordGuildId } = reloadConfigSchema.parse(req.body)
    const { reloadGuildSchedule } = await import('./jobs/scheduler')
    await reloadGuildSchedule(discordGuildId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'reload-config failed')
    res.status(500).json({ error: String(error) })
  }
})

const triggerSchema = z.object({ guildId: z.string() })

app.post('/trigger-presence', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { guildId } = triggerSchema.parse(req.body)
    const { runDailyPresence } = await import('./jobs/dailyPresence')
    await runDailyPresence(guildId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'trigger-presence failed')
    res.status(500).json({ error: String(error) })
  }
})

app.post('/trigger-reminder', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { guildId } = triggerSchema.parse(req.body)
    const { runReminder } = await import('./jobs/reminder')
    await runReminder(guildId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'trigger-reminder failed')
    res.status(500).json({ error: String(error) })
  }
})

app.post('/trigger-warning', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { guildId } = triggerSchema.parse(req.body)
    const { runWarningCheck } = await import('./jobs/warningCheck')
    await runWarningCheck(guildId)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'trigger-warning failed')
    res.status(500).json({ error: String(error) })
  }
})

const syncGuildSchema = z.object({ discordGuildId: z.string() })

app.post('/sync-guild', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { discordGuildId } = syncGuildSchema.parse(req.body)
    const { onGuildCreate } = await import('./events/guildCreate')
    const guild = await client.guilds.fetch(discordGuildId)
    await onGuildCreate(guild)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'sync-guild failed')
    res.status(500).json({ error: String(error) })
  }
})

const notifyAbsenceSchema = z.object({
  guildId: z.string(),
  absenceId: z.string(),
  memberName: z.string(),
  memberAvatarUrl: z.string().nullable().optional(),
  reason: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  source: z.enum(['discord', 'panel']),
})

app.post('/notify-absence', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const data = notifyAbsenceSchema.parse(req.body)

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: data.guildId },
      select: { absenceNotifChannelId: true, accentColor: true, panelName: true, botLanguage: true },
    })

    if (!config?.absenceNotifChannelId) return res.json({ success: true, skipped: true })

    const t = getBotT(config.botLanguage ?? 'fr')
    const colorHex = (config.accentColor ?? '#f59e0b').replace('#', '')
    const color = parseInt(colorHex, 16)

    const fmt = (d: string) => {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    }

    const sourceLabel = data.source === 'discord' ? t.absence.viaDiscord : t.absence.viaPanel

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(t.absence.notifTitle)
      .setDescription(t.absence.notifDesc(data.memberName))
      .addFields(
        {
          name: t.absence.reasonLabel,
          value: data.reason,
          inline: false,
        },
        {
          name: t.absence.periodField,
          value: `${fmt(data.startDate)} → ${fmt(data.endDate)}`,
          inline: true,
        },
        {
          name: t.absence.sourceField,
          value: sourceLabel,
          inline: true,
        }
      )
      .setFooter({
        text: config.panelName ?? 'Gestion',
        iconURL: data.memberAvatarUrl ?? undefined,
      })
      .setTimestamp()

    if (data.memberAvatarUrl) {
      embed.setThumbnail(data.memberAvatarUrl)
    }

    const channel = await client.channels.fetch(config.absenceNotifChannelId)
    if (!isSendableChannel(channel)) return res.json({ success: true, skipped: true })

    const approveBtn = new ButtonBuilder()
      .setCustomId(`absence-review:approve:${data.absenceId}`)
      .setLabel(t.absence.approveBtn)
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
    const rejectBtn = new ButtonBuilder()
      .setCustomId(`absence-review:reject:${data.absenceId}`)
      .setLabel(t.absence.rejectBtn)
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn)

    const message = await channel.send({ embeds: [embed], components: [row] })

    await prisma.absence.update({
      where: { id: data.absenceId },
      data: { notifChannelId: channel.id, notifMessageId: message.id },
    })

    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'notify-absence failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForGuild(req.body?.guildId))) })
  }
})

const notifyWarningSchema = z.object({
  guildId: z.string(),
  action: z.enum(['ISSUED', 'REVOKED']),
  memberName: z.string(),
  memberAvatarUrl: z.string().nullable().optional(),
  discordUserId: z.string(),
  reason: z.string(),
  actorName: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

app.post('/notify-warning', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const data = notifyWarningSchema.parse(req.body)

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: data.guildId },
      select: { warningChannelId: true, notificationChannelId: true, panelName: true, botLanguage: true },
    })

    const channelId = config?.warningChannelId ?? config?.notificationChannelId
    if (!channelId) return res.json({ success: true, skipped: true })

    const channel = await client.channels.fetch(channelId)
    if (!isSendableChannel(channel)) return res.json({ success: true, skipped: true })

    const t = getBotT(config?.botLanguage ?? 'fr')
    const issued = data.action === 'ISSUED'

    const embed = new EmbedBuilder()
      .setColor(issued ? 0xff3860 : 0x23d160)
      .setTitle(issued ? t.warning.issuedTitle : t.warning.revokedTitle)
      .addFields(
        {
          name: t.warning.memberField,
          value: `<@${data.discordUserId}> (${data.memberName})`,
          inline: true,
        },
        {
          name: issued ? t.warning.issuedByField : t.warning.revokedByField,
          value: data.actorName ?? 'SYSTEM',
          inline: true,
        },
        {
          name: t.warning.reasonField,
          value: data.reason,
          inline: false,
        }
      )
      .setFooter({ text: config?.panelName ?? 'Gestion' })
      .setTimestamp()

    if (data.note) {
      embed.addFields({ name: t.warning.noteField, value: data.note, inline: false })
    }
    if (data.memberAvatarUrl) {
      embed.setThumbnail(data.memberAvatarUrl)
    }

    await channel.send({ embeds: [embed] })
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'notify-warning failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForGuild(req.body?.guildId))) })
  }
})

const updateAbsenceStatusSchema = z.object({
  absenceId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewerName: z.string().nullable().optional(),
})

app.post('/update-absence-status', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { absenceId, status, reviewerName } = updateAbsenceStatusSchema.parse(req.body)

    const absence = await prisma.absence.findUnique({ where: { id: absenceId } })
    if (!absence?.notifChannelId || !absence?.notifMessageId) {
      return res.json({ success: true, skipped: true })
    }

    const channel = await client.channels.fetch(absence.notifChannelId)
    if (!isSendableChannel(channel)) return res.json({ success: true, skipped: true })

    let message
    try {
      message = await channel.messages.fetch(absence.notifMessageId)
    } catch {
      return res.json({ success: true, skipped: true })
    }

    const t = getBotT(await langForGuild(absence.guildId))
    const approved = status === 'APPROVED'
    const existingEmbed = message.embeds[0]
    const embed = existingEmbed ? EmbedBuilder.from(existingEmbed) : new EmbedBuilder()
    embed.setColor(approved ? 0x22c55e : 0xef4444)
    embed.addFields({
      name: t.absence.statusField,
      value: approved
        ? t.absence.reviewApproved(reviewerName)
        : t.absence.reviewRejected(reviewerName),
    })

    await message.edit({ embeds: [embed], components: [] })
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'update-absence-status failed')
    res.status(500).json({ error: discordErrorMessage(error) })
  }
})

const postAbsenceEmbedSchema = z.object({ guildId: z.string() })

app.post('/post-absence-embed', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { guildId } = postAbsenceEmbedSchema.parse(req.body)

    const guild = await prisma.guildInstance.findUnique({
      where: { id: guildId },
      include: { config: true },
    })

    if (!guild?.config?.absenceChannelId) {
      return res.status(400).json({ error: 'No absence channel configured' })
    }

    const config = guild.config
    const t = getBotT(config.botLanguage ?? 'fr')

    const title = config.absenceEmbedTitle || t.absence.embedTitle
    const description = config.absenceEmbedBody || t.absence.embedBody
    const colorHex = (config.accentColor ?? '#5865F2').replace('#', '')
    const color = parseInt(colorHex, 16)

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: config.panelName ?? guild.discordGuildName })
      .setTimestamp()

    const button = new ButtonBuilder()
      .setCustomId(`absence-btn:${guildId}`)
      .setLabel(t.absence.buttonLabel)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

    let channel
    try {
      channel = await client.channels.fetch(config.absenceChannelId!)
    } catch (error) {
      return res.status(400).json({ error: discordErrorMessage(error, t) })
    }

    if (!isSendableChannel(channel)) {
      return res.status(400).json({ error: t.discordErrors.notSendableType })
    }

    let messageId: string

    if (config.absenceEmbedMessageId) {
      try {
        const existing = await channel.messages.fetch(config.absenceEmbedMessageId)
        await existing.edit({ embeds: [embed], components: [row] })
        messageId = existing.id
      } catch {
        // Message deleted — post a new one
        const msg = await channel.send({ embeds: [embed], components: [row] })
        messageId = msg.id
      }
    } else {
      const msg = await channel.send({ embeds: [embed], components: [row] })
      messageId = msg.id
    }

    await prisma.guildConfig.update({
      where: { guildId },
      data: { absenceEmbedMessageId: messageId },
    })

    res.json({ success: true, messageId })
  } catch (error) {
    logger.error({ error }, 'post-absence-embed failed')
    res.status(500).json({ error: discordErrorMessage(error, getBotT(await langForGuild(req.body?.guildId))) })
  }
})

app.get('/bot-profile', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const application = await client.application?.fetch()
    const profile = await prisma.botProfile.findUnique({ where: { id: 'default' } })
    res.json({
      username: client.user?.username ?? null,
      avatarUrl: client.user?.displayAvatarURL({ size: 128 }) ?? null,
      description: application?.description ?? null,
      customStatus: profile?.customStatus ?? null,
    })
  } catch (error) {
    logger.error({ error }, 'get bot-profile failed')
    res.status(500).json({ error: discordErrorMessage(error) })
  }
})

const botProfileSchema = z.object({
  description: z.string().max(400).nullable().optional(),
  customStatus: z.string().max(128).nullable().optional(),
})

app.post('/bot-profile', async (req, res) => {
  if (!verifySecret(req, res)) return
  try {
    const { description, customStatus } = botProfileSchema.parse(req.body)

    if (description !== undefined) {
      await client.application?.edit({ description: description ?? '' })
    }
    if (customStatus !== undefined) {
      const { applyCustomStatus } = await import('./bot-profile')
      applyCustomStatus(customStatus ?? null)
    }

    await prisma.botProfile.upsert({
      where: { id: 'default' },
      update: {
        ...(description !== undefined ? { description } : {}),
        ...(customStatus !== undefined ? { customStatus } : {}),
      },
      create: {
        id: 'default',
        description: description ?? null,
        customStatus: customStatus ?? null,
      },
    })

    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'update bot-profile failed')
    res.status(500).json({ error: discordErrorMessage(error) })
  }
})

export function startHttpServer(port: number) {
  app.listen(port, () => {
    logger.info(`Bot HTTP server listening on port ${port}`)
  })
}
