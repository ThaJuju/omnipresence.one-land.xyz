import { GuildMember, PartialGuildMember, PermissionFlagsBits } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'

export async function onGuildMemberUpdate(
  _oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  if (newMember.user.bot) return
  try {
    await callWeb('/api/internal/member/sync', {
      discordUserId: newMember.user.id,
      discordGuildId: newMember.guild.id,
      discordUsername: newMember.user.username,
      discordAvatar: newMember.user.avatar,
      discordNickname: newMember.displayName,
      discordRoleIds: newMember.roles.cache.map((r) => r.id),
      isAdministrator: newMember.permissions.has(PermissionFlagsBits.Administrator),
    })
  } catch (error) {
    logger.error({ error }, 'Failed to sync member update')
  }
}
