import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { prisma } from '@repo/db'

export const data = new SlashCommandBuilder()
  .setName('monstatus')
  .setDescription('Afficher votre statut du jour')

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: interaction.guildId! },
  })
  if (!guild) {
    await interaction.reply({ content: 'Serveur non configuré.', ephemeral: true })
    return
  }

  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId: guild.id, discordUserId: interaction.user.id } },
    include: {
      grade: true,
      warnings: { where: { isActive: true } },
    },
  })

  if (!member) {
    await interaction.reply({ content: 'Vous n\'êtes pas enregistré sur ce serveur.', ephemeral: true })
    return
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const todayLog = await prisma.presenceLog.findUnique({
    where: { memberId_date: { memberId: member.id, date: today } },
  })

  const statusEmoji = { PRESENT: '✅', ABSENT: '❌', PENDING: '⏳', LATE: '⏰' }
  const statusLabel = { PRESENT: 'Présent', ABSENT: 'Absent', PENDING: 'En attente', LATE: 'En retard' }

  const embed = new EmbedBuilder()
    .setTitle('Mon statut')
    .setColor(0x5865F2)
    .addFields(
      {
        name: 'Présence aujourd\'hui',
        value: todayLog
          ? `${statusEmoji[todayLog.status]} ${statusLabel[todayLog.status]}`
          : '❓ Non enregistré',
        inline: true,
      },
      {
        name: 'Grade',
        value: member.grade?.name ?? 'Aucun',
        inline: true,
      },
      {
        name: 'Avertissements actifs',
        value: member.warnings.length.toString(),
        inline: true,
      }
    )
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}
