import { ModalSubmitInteraction } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

function parseDate(str: string): Date | null {
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  const d = new Date(`${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`)
  if (isNaN(d.getTime())) return null
  return d
}

export async function handleAbsenceModal(interaction: ModalSubmitInteraction, guildId: string) {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { absenceEmbedLang: true, botLanguage: true },
  })
  const lang = config?.absenceEmbedLang ?? config?.botLanguage ?? 'fr'
  const t = getBotT(lang)

  const reason = interaction.fields.getTextInputValue('reason')
  const startStr = interaction.fields.getTextInputValue('startDate')
  const endStr = interaction.fields.getTextInputValue('endDate')

  const startDate = parseDate(startStr)
  const endDate = parseDate(endStr)

  if (!startDate || !endDate) {
    await interaction.reply({ content: t.absence.errFormat, ephemeral: true })
    return
  }

  if (endDate < startDate) {
    await interaction.reply({ content: t.absence.errDates, ephemeral: true })
    return
  }

  try {
    await callWeb('/api/internal/absence', {
      discordUserId: interaction.user.id,
      discordGuildId: interaction.guildId!,
      reason,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })

    await interaction.reply({
      content: t.absence.success(startStr, endStr),
      ephemeral: true,
    })
  } catch (error) {
    logger.error({ error }, 'Failed to register absence from modal')
    await interaction.reply({ content: t.absence.errGeneral, ephemeral: true })
  }
}
