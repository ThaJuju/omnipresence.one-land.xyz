import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export async function handleAbsenceButton(interaction: ButtonInteraction, guildId: string) {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { absenceEmbedLang: true, botLanguage: true },
  })
  const lang = config?.absenceEmbedLang ?? config?.botLanguage ?? 'fr'
  const t = getBotT(lang)

  const today = new Date()
  const todayStr = [
    today.getDate().toString().padStart(2, '0'),
    (today.getMonth() + 1).toString().padStart(2, '0'),
    today.getFullYear(),
  ].join('/')

  const modal = new ModalBuilder()
    .setCustomId(`absence-modal:${guildId}`)
    .setTitle(t.absence.modalTitle.slice(0, 45))

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel(t.absence.reasonLabel.slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(t.absence.reasonPlaceholder.slice(0, 100))
        .setRequired(true)
        .setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('startDate')
        .setLabel(t.absence.startLabel.slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setValue(todayStr)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('endDate')
        .setLabel(t.absence.endLabel.slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setValue(todayStr)
        .setRequired(true)
    )
  )

  await interaction.showModal(modal)
}
