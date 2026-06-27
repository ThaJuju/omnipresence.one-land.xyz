import express from 'express'
import { client } from './client'
import { logger } from './logger'
import { z } from 'zod'
import { isSendableChannel } from './channel-utils'
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, DiscordAPIError } from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT } from './i18n/botTranslations'

function discordErrorMessage(error: unknown): string {
  if (error instanceof DiscordAPIError) {
    switch (error.code) {
      case 50001:
        return "Le bot n'a pas accès à ce canal. Vérifiez qu'il est bien membre du serveur et que les permissions de lecture sont accordées."
      case 50013:
        return "Le bot n'a pas les permissions suffisantes pour envoyer des messages dans ce canal (permission « Envoyer des messages » requise)."
      case 50007:
        return "Impossible d'envoyer un message à cet utilisateur (messages privés désactivés)."
      case 10003:
        return "Canal introuvable. Vérifiez que l'identifiant du canal est correct et que le bot est dans le serveur."
      case 10008:
        return "Message introuvable. Il a probablement été supprimé — un nouvel embed sera publié."
      case 50035:
        return "Données invalides envoyées à Discord. Vérifiez le titre et la description de l'embed."
      default:
        return `Erreur Discord ${error.code} : ${error.message}`
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
    res.status(500).json({ error: discordErrorMessage(error) })
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
    res.status(500).json({ error: discordErrorMessage(error) })
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
      return res.status(400).json({ error: "Ce canal ne supporte pas l'envoi de messages." })
    }
    await channel.send(content)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'send-message failed')
    res.status(500).json({ error: discordErrorMessage(error) })
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
      return res.status(400).json({ error: "Ce canal ne supporte pas l'envoi de messages." })
    }
    const mentions = discordUserIds.map((id) => `<@${id}>`).join(' ')
    await channel.send(`${mentions}${content ? ` — ${content}` : ''}`)
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'mention-members failed')
    res.status(500).json({ error: discordErrorMessage(error) })
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

    const sourceLabel = data.source === 'discord'
      ? (config.botLanguage === 'en' ? 'Via Discord' : 'Via Discord')
      : (config.botLanguage === 'en' ? 'Via Panel' : 'Via Panel')

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(config.botLanguage === 'en' ? '📋 New absence request' : "📋 Nouvelle demande d'absence")
      .setDescription(`**${data.memberName}** ${config.botLanguage === 'en' ? 'has submitted an absence request.' : 'a soumis une demande d\'absence.'}`)
      .addFields(
        {
          name: config.botLanguage === 'en' ? 'Reason' : 'Motif',
          value: data.reason,
          inline: false,
        },
        {
          name: config.botLanguage === 'en' ? 'Period' : 'Période',
          value: `${fmt(data.startDate)} → ${fmt(data.endDate)}`,
          inline: true,
        },
        {
          name: 'Source',
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

    await channel.send({ embeds: [embed] })
    res.json({ success: true })
  } catch (error) {
    logger.error({ error }, 'notify-absence failed')
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
      return res.status(400).json({ error: discordErrorMessage(error) })
    }

    if (!isSendableChannel(channel)) {
      return res.status(400).json({ error: "Ce canal ne supporte pas l'envoi de messages (type invalide)." })
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
    res.status(500).json({ error: discordErrorMessage(error) })
  }
})

export function startHttpServer(port: number) {
  app.listen(port, () => {
    logger.info(`Bot HTTP server listening on port ${port}`)
  })
}
