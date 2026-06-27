import { Guild, PermissionFlagsBits } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { reloadGuildSchedule } from '../jobs/scheduler'

export async function onGuildCreate(guild: Guild) {
  logger.info({ guildId: guild.id }, 'Bot joined guild')

  try {
    await callWeb('/api/internal/guild/create', {
      discordGuildId: guild.id,
      discordGuildName: guild.name,
      discordGuildIcon: guild.icon,
      ownerId: guild.ownerId,
    })

    const members = await guild.members.fetch()
    for (const [, member] of members) {
      if (member.user.bot) continue
      await callWeb('/api/internal/member/sync', {
        discordUserId: member.user.id,
        discordGuildId: guild.id,
        discordUsername: member.user.username,
        discordAvatar: member.user.avatar,
        discordNickname: member.displayName,
        discordRoleIds: member.roles.cache.map((r) => r.id),
        isAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
      })
    }

    await reloadGuildSchedule(guild.id)
    logger.info({ guildId: guild.id }, 'Guild setup complete')
  } catch (error) {
    logger.error({ error, guildId: guild.id }, 'Failed to setup guild')
  }
}
