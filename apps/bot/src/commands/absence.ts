import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js'
import { prisma } from '@repo/db'

export const data = new SlashCommandBuilder()
  .setName('absence')
  .setDescription("Déclarer une absence")

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!

  // Fetch guild accent color if configured
  const config = await prisma.guildConfig.findFirst({
    where: { guild: { discordGuildId: guildId } },
    select: { accentColor: true, panelName: true },
  })
  const colorHex = (config?.accentColor ?? '#5865F2').replace('#', '')
  const color = parseInt(colorHex, 16)

  const dbGuild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: guildId },
    select: { id: true },
  })

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle("📋 Déclaration d'absence")
    .setDescription(
      "Vous souhaitez déclarer une absence ?\n\n" +
      "Cliquez sur le bouton ci-dessous pour ouvrir le formulaire. " +
      "Votre demande sera soumise **en attente de validation** par un responsable.\n\n" +
      "**Informations requises :**\n" +
      "• Motif de l'absence\n" +
      "• Date de début\n" +
      "• Date de fin"
    )
    .setFooter({ text: config?.panelName ?? interaction.guild?.name ?? 'Gestion' })
    .setTimestamp()

  const button = new ButtonBuilder()
    .setCustomId(`absence-btn:${dbGuild?.id ?? guildId}`)
    .setLabel("Déclarer une absence")
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝')

  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    ephemeral: true,
  })
}
