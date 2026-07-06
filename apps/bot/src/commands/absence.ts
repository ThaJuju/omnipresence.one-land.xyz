import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export const data = new SlashCommandBuilder()
  .setName('absence')
  .setDescription("Déclarer une absence")
  .setDescriptionLocalizations({
    'en-US': 'Declare an absence',
    'en-GB': 'Declare an absence',
  })

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!

  // Fetch guild accent color if configured
  const config = await prisma.guildConfig.findFirst({
    where: { guild: { discordGuildId: guildId } },
    select: { accentColor: true, panelName: true, botLanguage: true },
  })
  const t = getBotT(config?.botLanguage ?? 'fr')
  const colorHex = (config?.accentColor ?? '#5865F2').replace('#', '')
  const color = parseInt(colorHex, 16)

  const dbGuild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: guildId },
    select: { id: true },
  })

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(t.absence.embedTitle)
    .setDescription(`${t.absence.embedBody}\n\n${t.absence.cmdRequiredInfo}`)
    .setFooter({ text: config?.panelName ?? interaction.guild?.name ?? 'Gestion' })
    .setTimestamp()

  const button = new ButtonBuilder()
    .setCustomId(`absence-btn:${dbGuild?.id ?? guildId}`)
    .setLabel(t.absence.buttonLabel)
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝')

  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    ephemeral: true,
  })
}
