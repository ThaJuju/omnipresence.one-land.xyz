import { Client, REST, Routes } from 'discord.js'
import { logger } from '../logger'
import { initScheduler } from '../jobs/scheduler'
import { onGuildCreate } from './guildCreate'
import * as presenceCmd from '../commands/presence'
import * as absenceCmd from '../commands/absence'
import * as monstatusCmd from '../commands/monstatus'
import * as syncCmd from '../commands/sync'
import * as rapportCmd from '../commands/rapport'

export async function onReady(client: Client) {
  logger.info(`Bot connecté en tant que ${client.user?.tag}`)

  const commands = [
    presenceCmd.data.toJSON(),
    absenceCmd.data.toJSON(),
    monstatusCmd.data.toJSON(),
    syncCmd.data.toJSON(),
    rapportCmd.data.toJSON(),
  ]

  const rest = new REST().setToken(process.env['DISCORD_BOT_TOKEN']!)

  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands })
    logger.info('Slash commands registered globally')
  } catch (error) {
    logger.error({ error }, 'Failed to register slash commands')
  }

  // Sync all guilds the bot is already in (handles restarts and missed guildCreate events)
  for (const [, guild] of client.guilds.cache) {
    await onGuildCreate(guild).catch((error) =>
      logger.error({ error, guildId: guild.id }, 'Failed to sync existing guild on ready')
    )
  }

  await initScheduler()
}
