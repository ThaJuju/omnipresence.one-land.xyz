import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { prisma } from '@repo/db'
import { getBotT } from '../i18n/botTranslations'

export const data = new SlashCommandBuilder()
  .setName('monstatus')
  .setDescription('Afficher votre statut du jour')
  .setDescriptionLocalizations({
    'en-US': 'Show your status for today',
    'en-GB': 'Show your status for today',
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

  const member = await prisma.member.findUnique({
    where: { guildId_discordUserId: { guildId: guild.id, discordUserId: interaction.user.id } },
    include: {
      grade: true,
      warnings: { where: { isActive: true } },
    },
  })

  if (!member) {
    await interaction.reply({ content: t.common.notRegistered, ephemeral: true })
    return
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const todayLog = await prisma.presenceLog.findUnique({
    where: { memberId_date: { memberId: member.id, date: today } },
  })

  const statusEmoji: Record<string, string> = { PRESENT: '✅', ABSENT: '❌', PENDING: '⏳', LATE: '⏰' }

  const embed = new EmbedBuilder()
    .setTitle(t.status.title)
    .setColor(0x5865F2)
    .addFields(
      {
        name: t.status.todayField,
        value: todayLog
          ? `${statusEmoji[todayLog.status]} ${t.status.labels[todayLog.status]}`
          : t.status.notRecorded,
        inline: true,
      },
      {
        name: t.status.gradeField,
        value: member.grade?.name ?? t.status.noGrade,
        inline: true,
      },
      {
        name: t.status.warningsField,
        value: member.warnings.length.toString(),
        inline: true,
      }
    )
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}
