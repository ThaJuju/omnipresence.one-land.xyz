import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export const data = new SlashCommandBuilder()
  .setName('presence')
  .setDescription('Confirmer votre présence ou absence du jour')
  .setDescriptionLocalizations({
    'en-US': 'Confirm your presence or absence for today',
    'en-GB': 'Confirm your presence or absence for today',
  })

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = await prisma.guildInstance.findUnique({
    where: { discordGuildId: interaction.guildId! },
    include: { config: { select: { botLanguage: true } } },
  })
  const t = getBotT(guild?.config?.botLanguage ?? 'fr')
  if (!guild) {
    await interaction.reply({ content: t.common.serverNotConfigured, ephemeral: true })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle(t.presence.cmdTitle)
    .setDescription(t.presence.cmdDesc)
    .setColor(0x5865F2)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`presence:present:${guild.id}`)
      .setLabel(t.presence.btnPresent)
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`presence:late:${guild.id}`)
      .setLabel(t.presence.btnLate)
      .setEmoji('⏰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`presence:absent:${guild.id}`)
      .setLabel(t.presence.btnAbsent)
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  )

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })
}
