import { ModalSubmitInteraction } from 'discord.js'
import { callWeb } from '../web-client'
import { logger } from '../logger'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export async function handleLateModal(interaction: ModalSubmitInteraction, guildId: string) {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { botLanguage: true },
  })
  const t = getBotT(config?.botLanguage ?? 'fr')

  const delayStr = interaction.fields.getTextInputValue('delayMinutes').trim()
  const delayMinutes = parseInt(delayStr, 10)

  if (isNaN(delayMinutes) || delayMinutes <= 0) {
    await interaction.reply({ content: t.presence.lateErrInvalid, ephemeral: true })
    return
  }

  try {
    await callWeb('/api/internal/presence', {
      discordUserId: interaction.user.id,
      discordGuildId: interaction.guildId!,
      status: 'LATE',
      delayMinutes,
    })
    await interaction.reply({ content: t.presence.lateSuccess(delayMinutes), ephemeral: true })
  } catch (error) {
    logger.error({ error }, 'Failed to register late presence')
    await interaction.reply({ content: t.presence.lateErrGeneral, ephemeral: true })
  }
}
