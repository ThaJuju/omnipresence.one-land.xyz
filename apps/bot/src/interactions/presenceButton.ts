import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export async function handlePresenceButton(interaction: ButtonInteraction, action: string, guildId: string) {
  if (action === 'present') {
    try {
      await callWeb('/api/internal/presence', {
        discordUserId: interaction.user.id,
        discordGuildId: interaction.guildId!,
        status: 'PRESENT',
      })
      await interaction.reply({ content: '✅ Présence confirmée !', ephemeral: true })
    } catch (error) {
      logger.error({ error }, 'Failed to register presence')
      await interaction.reply({ content: '❌ Erreur lors de l\'enregistrement.', ephemeral: true })
    }
  } else if (action === 'late') {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
      select: { botLanguage: true },
    })
    const t = getBotT(config?.botLanguage ?? 'fr')

    const modal = new ModalBuilder()
      .setCustomId(`late-modal:${guildId}`)
      .setTitle(t.presence.lateModalTitle)

    const delayInput = new TextInputBuilder()
      .setCustomId('delayMinutes')
      .setLabel(t.presence.lateDelayLabel)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(t.presence.lateDelayPlaceholder)
      .setMaxLength(4)

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(delayInput)
    )

    await interaction.showModal(modal)
  } else if (action === 'absent') {
    const today = new Date()
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`

    const modal = new ModalBuilder()
      .setCustomId(`absence-modal:${guildId}`)
      .setTitle('Déclaration d\'absence')

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Motif de l\'absence')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500)

    const startInput = new TextInputBuilder()
      .setCustomId('startDate')
      .setLabel('Date de début (JJ/MM/AAAA)')
      .setStyle(TextInputStyle.Short)
      .setValue(todayStr)
      .setRequired(true)

    const endInput = new TextInputBuilder()
      .setCustomId('endDate')
      .setLabel('Date de fin (JJ/MM/AAAA)')
      .setStyle(TextInputStyle.Short)
      .setValue(todayStr)
      .setRequired(true)

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(startInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(endInput)
    )

    await interaction.showModal(modal)
  }
}
