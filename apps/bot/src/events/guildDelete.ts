import { Guild } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'

export async function onGuildDelete(guild: Guild) {
  logger.info({ guildId: guild.id }, 'Bot left guild')
  try {
    await callWeb('/api/internal/guild/delete', { discordGuildId: guild.id })
  } catch (error) {
    logger.error({ error, guildId: guild.id }, 'Failed to deactivate guild')
  }
}
