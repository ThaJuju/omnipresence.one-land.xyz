import { Events } from 'discord.js'
import { client } from './client'
import { logger } from './logger'
import { prisma } from '@repo/db'
import { getBotT } from './i18n/botTranslations'
import { startHttpServer } from './httpServer'
import { onReady } from './events/ready'
import { onGuildCreate } from './events/guildCreate'
import { onGuildDelete } from './events/guildDelete'
import { onGuildMemberAdd } from './events/guildMemberAdd'
import { onGuildMemberRemove } from './events/guildMemberRemove'
import { onGuildMemberUpdate } from './events/guildMemberUpdate'
import { handlePresenceButton } from './interactions/presenceButton'
import { handleAbsenceModal } from './interactions/absenceModal'
import { handleAbsenceButton } from './interactions/absenceButton'
import { handleAbsenceReviewButton } from './interactions/absenceReview'
import { handleLateModal } from './interactions/lateModal'
import * as presenceCmd from './commands/presence'
import * as absenceCmd from './commands/absence'
import * as monstatusCmd from './commands/monstatus'
import * as syncCmd from './commands/sync'
import * as rapportCmd from './commands/rapport'

const commands = new Map([
  ['presence', presenceCmd],
  ['absence', absenceCmd],
  ['monstatus', monstatusCmd],
  ['sync', syncCmd],
  ['rapport', rapportCmd],
])

client.once(Events.ClientReady, (c) => onReady(c))

client.on(Events.GuildCreate, onGuildCreate)
client.on(Events.GuildDelete, onGuildDelete)
client.on(Events.GuildMemberAdd, onGuildMemberAdd)
client.on(Events.GuildMemberRemove, onGuildMemberRemove)
client.on(Events.GuildMemberUpdate, onGuildMemberUpdate)

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName)
    if (!command) return
    try {
      await command.execute(interaction)
    } catch (error) {
      logger.error({ error, command: interaction.commandName }, 'Command error')
      const config = interaction.guildId
        ? await prisma.guildConfig.findFirst({
            where: { guild: { discordGuildId: interaction.guildId } },
            select: { botLanguage: true },
          }).catch(() => null)
        : null
      const reply = { content: getBotT(config?.botLanguage ?? 'fr').common.errOccurred, ephemeral: true }
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply)
      } else {
        await interaction.reply(reply)
      }
    }
  }

  if (interaction.isButton()) {
    const [type, action, guildId] = interaction.customId.split(':')
    if (type === 'presence' && action && guildId) {
      await handlePresenceButton(interaction, action, guildId)
    } else if (type === 'absence-btn' && action) {
      // action is the internal guildId (absence-btn:internalGuildId)
      await handleAbsenceButton(interaction, action)
    } else if (type === 'absence-review' && (action === 'approve' || action === 'reject') && guildId) {
      // guildId slot holds the absenceId here (absence-review:approve|reject:absenceId)
      await handleAbsenceReviewButton(interaction, action, guildId)
    }
  }

  if (interaction.isModalSubmit()) {
    const [type, guildId] = interaction.customId.split(':')
    if (type === 'absence-modal' && guildId) {
      await handleAbsenceModal(interaction, guildId)
    } else if (type === 'late-modal' && guildId) {
      await handleLateModal(interaction, guildId)
    }
  }
})

client.on(Events.Error, (error) => {
  logger.error({ error }, 'Discord client error')
})

const botPort = parseInt(process.env['BOT_HTTP_PORT'] ?? '3001', 10)
startHttpServer(botPort)

client.login(process.env['DISCORD_BOT_TOKEN']).catch((error) => {
  logger.error({ error }, 'Failed to login to Discord')
  process.exit(1)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down bot...')
  await client.destroy()
  process.exit(0)
})

process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled rejection')
})
