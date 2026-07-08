import { Guild } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'

export async function onGuildUpdate(oldGuild: Guild, newGuild: Guild) {
  if (oldGuild.name === newGuild.name && oldGuild.icon === newGuild.icon) return

  logger.info({ guildId: newGuild.id }, 'Guild updated, syncing name/icon')

  try {
    await callWeb('/api/internal/guild/create', {
      discordGuildId: newGuild.id,
      discordGuildName: newGuild.name,
      discordGuildIcon: newGuild.icon,
      ownerId: newGuild.ownerId,
    })
  } catch (error) {
    logger.error({ error, guildId: newGuild.id }, 'Failed to sync guild update')
  }
}
