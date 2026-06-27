import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { prisma } from '@repo/db'

export const data = new SlashCommandBuilder()
  .setName('presence')
  .setDescription('Confirmer votre présence ou absence du jour')

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: interaction.guildId! },
  })
  if (!guild) {
    await interaction.reply({ content: 'Ce serveur n\'est pas configuré.', ephemeral: true })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('Confirmation de présence')
    .setDescription('Confirmez votre statut pour aujourd\'hui.')
    .setColor(0x5865F2)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`presence:present:${guild.id}`)
      .setLabel('Présent')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`presence:late:${guild.id}`)
      .setLabel('En retard')
      .setEmoji('⏰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`presence:absent:${guild.id}`)
      .setLabel('Absent')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  )

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })
}
