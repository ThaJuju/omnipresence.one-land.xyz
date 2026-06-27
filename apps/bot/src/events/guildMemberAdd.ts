import { GuildMember, PermissionFlagsBits } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'

export async function onGuildMemberAdd(member: GuildMember) {
  if (member.user.bot) return
  try {
    await callWeb('/api/internal/member/sync', {
      discordUserId: member.user.id,
      discordGuildId: member.guild.id,
      discordUsername: member.user.username,
      discordAvatar: member.user.avatar,
      discordNickname: member.displayName,
      discordRoleIds: member.roles.cache.map((r) => r.id),
      isAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
    })
  } catch (error) {
    logger.error({ error }, 'Failed to sync new member')
  }
}
