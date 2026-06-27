import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import { prisma } from '@repo/db'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { resolvePanelRole } from './helpers'

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Resynchroniser les membres du serveur')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  try {
    const discordGuild = await interaction.guild!.fetch()
    const members = await discordGuild.members.fetch()

    let synced = 0
    for (const [, guildMember] of members) {
      if (guildMember.user.bot) continue

      await callWeb('/api/internal/member/sync', {
        discordUserId: guildMember.user.id,
        discordGuildId: discordGuild.id,
        discordUsername: guildMember.user.username,
        discordAvatar: guildMember.user.avatar,
        discordNickname: guildMember.displayName,
        discordRoleIds: guildMember.roles.cache.map((r) => r.id),
        isAdministrator: guildMember.permissions.has(PermissionFlagsBits.Administrator),
      })
      synced++
    }

    await interaction.editReply(`✅ ${synced} membre(s) synchronisé(s).`)
  } catch (error) {
    logger.error({ error }, 'sync command failed')
    await interaction.editReply('❌ Erreur lors de la synchronisation.')
  }
}
