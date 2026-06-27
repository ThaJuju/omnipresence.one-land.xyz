import { GuildMember, PartialGuildMember } from 'discord.js'
import { prisma } from '@repo/db'
import { logger } from '../logger'

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  if (member.user?.bot) return
  try {
    const guild = await prisma.guildInstance.findUnique({
      where: { discordGuildId: member.guild.id },
    })
    if (!guild) return

    await prisma.member.updateMany({
      where: { guildId: guild.id, discordUserId: member.user!.id },
      data: { isActive: false },
    })
  } catch (error) {
    logger.error({ error }, 'Failed to deactivate member')
  }
}
